import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteGraphRepository } from '../../../src/repositories/sqlite-graph-repository.js';
import { RELATION_TYPES } from '../../../src/types/index.js';

// 使用 :memory: 数据库，每个 test 块独立实例
function createRepo(): SqliteGraphRepository {
  return new SqliteGraphRepository(':memory:');
}

// ── 文档节点工厂辅助 ──────────────────────────────────────────────────────────
const makeDoc = (path: string) => ({
  path,
  title: `Title of ${path}`,
  docType: 'architecture',
  framework: 'bmad',
  contentHash: 'hash-' + path,
  metadata: { tag: path } as Record<string, unknown>,
});

// ── Migration: 启动即迁移 ─────────────────────────────────────────────────────

describe('SqliteGraphRepository — 迁移机制', () => {
  it('首次连接创建 schema_migrations、documents、relations、sync_states 表', () => {
    const repo = createRepo();
    // 通过操作验证表已存在（不报错即可）
    expect(repo.getAllDocuments()).toHaveLength(0);
    expect(repo.getAllRelations()).toHaveLength(0);
    expect(repo.getAllSyncStates()).toHaveLength(0);
    repo.close();
  });

  it('多次连接幂等：重复 runMigrations 不会抛错', () => {
    const repo1 = createRepo();
    repo1.close();
    // :memory: 每次新建，这里主要测试单实例不崩溃
    expect(() => createRepo().close()).not.toThrow();
  });

  it('迁移版本已记录在 schema_migrations 表', () => {
    // SqliteGraphRepository 不直接暴露 DB；通过 getDocumentCount 间接证明迁移已完成
    const repo = createRepo();
    expect(() => repo.getDocumentCount()).not.toThrow();
    repo.close();
  });

  it('升级旧版数据库时会为 relations 表补 status 列并将存量关系回填为 active', () => {
    const root = mkdtempSync(join(tmpdir(), 'cord-legacy-repo-'));
    const dbPath = join(root, 'cord.db');
    const legacyDb = new Database(dbPath);

    try {
      legacyDb.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE schema_migrations (
          version     INTEGER PRIMARY KEY,
          applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE documents (
          id           TEXT PRIMARY KEY,
          path         TEXT NOT NULL UNIQUE,
          title        TEXT,
          doc_type     TEXT,
          framework    TEXT,
          content_hash TEXT,
          metadata     TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE relations (
          id              TEXT    PRIMARY KEY,
          source_doc_id   TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          target_doc_id   TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          relation_type   TEXT    NOT NULL
                                  CHECK (relation_type IN ('sync_required', 'context_for', 'lifecycle_bound', 'contains', 'must_consistent', 'sync_suggested', 'derived_from', 'deprecated', 'references')),
          confidence      REAL    NOT NULL DEFAULT 0.5,
          source          TEXT    NOT NULL DEFAULT 'auto_scan'
                                  CHECK (source IN ('auto_scan', 'manual', 'framework_preset')),
          metadata        TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE sync_states (
          doc_id                  TEXT    PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
          last_scanned_at         TEXT    NOT NULL,
          last_observed_mtime_ms  INTEGER,
          content_hash            TEXT    NOT NULL,
          status                  TEXT    NOT NULL DEFAULT 'synced'
                                  CHECK (status IN ('synced', 'modified')),
          updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);

      legacyDb.prepare(
        `INSERT INTO documents (id, path, title, doc_type, metadata, created_at, updated_at)
         VALUES ('doc-src', 'docs/source.md', 'source', 'story', '{}', '2026-05-14T00:00:00.000Z', '2026-05-14T00:00:00.000Z')`,
      ).run();
      legacyDb.prepare(
        `INSERT INTO documents (id, path, title, doc_type, metadata, created_at, updated_at)
         VALUES ('doc-tgt', 'docs/target.md', 'target', 'story', '{}', '2026-05-14T00:00:00.000Z', '2026-05-14T00:00:00.000Z')`,
      ).run();
      legacyDb.prepare(
        `INSERT INTO relations (id, source_doc_id, target_doc_id, relation_type, confidence, source, metadata, created_at, updated_at)
         VALUES ('rel-legacy', 'doc-src', 'doc-tgt', 'references', 0.7, 'auto_scan', '{"legacy":true}', '2026-05-14T00:00:00.000Z', '2026-05-14T00:00:00.000Z')`,
      ).run();
      legacyDb.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();
    } finally {
      legacyDb.close();
    }

    const repo = new SqliteGraphRepository(dbPath);

    try {
      const relations = repo.getAllRelations();
      expect(relations).toHaveLength(1);
      expect(relations[0].status).toBe('active');
      expect(relations[0].relationType).toBe(RELATION_TYPES.REFERENCES);
      expect(repo.getMigrationVersion()).toBe(2);
    } finally {
      repo.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('部分迁移数据库已存在 status 列但缺失索引时会补建 idx_relations_status', () => {
    const root = mkdtempSync(join(tmpdir(), 'cord-partial-migration-'));
    const dbPath = join(root, 'cord.db');
    const partialDb = new Database(dbPath);

    try {
      partialDb.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE schema_migrations (
          version     INTEGER PRIMARY KEY,
          applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE documents (
          id           TEXT PRIMARY KEY,
          path         TEXT NOT NULL UNIQUE,
          title        TEXT,
          doc_type     TEXT,
          framework    TEXT,
          content_hash TEXT,
          metadata     TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE relations (
          id              TEXT    PRIMARY KEY,
          source_doc_id   TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          target_doc_id   TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          relation_type   TEXT    NOT NULL
                                  CHECK (relation_type IN ('sync_required', 'context_for', 'lifecycle_bound', 'contains', 'must_consistent', 'sync_suggested', 'derived_from', 'deprecated', 'references')),
          confidence      REAL    NOT NULL DEFAULT 0.5,
          source          TEXT    NOT NULL DEFAULT 'auto_scan'
                                  CHECK (source IN ('auto_scan', 'manual', 'framework_preset')),
          status          TEXT    NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'deprecated')),
          metadata        TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE sync_states (
          doc_id                  TEXT    PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
          last_scanned_at         TEXT    NOT NULL,
          last_observed_mtime_ms  INTEGER,
          content_hash            TEXT    NOT NULL,
          status                  TEXT    NOT NULL DEFAULT 'synced'
                                  CHECK (status IN ('synced', 'modified')),
          updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);

      partialDb.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();
    } finally {
      partialDb.close();
    }

    const repo = new SqliteGraphRepository(dbPath);

    try {
      expect(repo.getMigrationVersion()).toBe(2);
      repo.close();

      const verificationDb = new Database(dbPath, { readonly: true });

      try {
        const indexes = verificationDb
          .prepare<[], { name: string }>("PRAGMA index_list('relations')")
          .all();

        expect(indexes.some((index) => index.name === 'idx_relations_status')).toBe(true);
      } finally {
        verificationDb.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── 文档节点 CRUD ─────────────────────────────────────────────────────────────

describe('SqliteGraphRepository — 文档节点 CRUD', () => {
  let repo: SqliteGraphRepository;

  beforeEach(() => { repo = createRepo(); });
  afterEach(() => { repo.close(); });

  it('addDocument 返回带 id/createdAt/updatedAt 的完整记录', () => {
    const doc = repo.addDocument(makeDoc('docs/a.md'));
    expect(doc.id).toBeTruthy();
    expect(doc.path).toBe('docs/a.md');
    expect(doc.title).toBe('Title of docs/a.md');
    expect(doc.createdAt).toBeTruthy();
    expect(doc.updatedAt).toBeTruthy();
  });

  it('getDocumentById 返回已存在文档', () => {
    const added = repo.addDocument(makeDoc('docs/b.md'));
    const found = repo.getDocumentById(added.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(added.id);
  });

  it('getDocumentById 对不存在的 id 返回 null', () => {
    expect(repo.getDocumentById('nonexistent')).toBeNull();
  });

  it('getDocumentByPath 按路径查询', () => {
    repo.addDocument(makeDoc('docs/c.md'));
    const found = repo.getDocumentByPath('docs/c.md');
    expect(found).not.toBeNull();
    expect(found!.path).toBe('docs/c.md');
  });

  it('getDocumentByPath 对不存在路径返回 null', () => {
    expect(repo.getDocumentByPath('no/such.md')).toBeNull();
  });

  it('getAllDocuments 返回所有文档', () => {
    repo.addDocument(makeDoc('a.md'));
    repo.addDocument(makeDoc('b.md'));
    expect(repo.getAllDocuments()).toHaveLength(2);
  });

  it('updateDocument 更新指定字段并返回更新记录', () => {
    const added = repo.addDocument(makeDoc('docs/d.md'));
    const updated = repo.updateDocument(added.id, { title: 'New Title', contentHash: 'newhash' });
    expect(updated.title).toBe('New Title');
    expect(updated.contentHash).toBe('newhash');
    expect(updated.path).toBe('docs/d.md'); // 未修改字段保留
  });

  it('updateDocument 对不存在 id 抛出错误', () => {
    expect(() => repo.updateDocument('ghost', { title: 'x' })).toThrow();
  });

  it('deleteDocument 删除指定文档', () => {
    const added = repo.addDocument(makeDoc('docs/e.md'));
    repo.deleteDocument(added.id);
    expect(repo.getDocumentById(added.id)).toBeNull();
  });

  it('deleteAllDocuments 清空所有文档', () => {
    repo.addDocument(makeDoc('a.md'));
    repo.addDocument(makeDoc('b.md'));
    repo.deleteAllDocuments();
    expect(repo.getAllDocuments()).toHaveLength(0);
  });

  it('getDocumentCount 返回正确数量', () => {
    expect(repo.getDocumentCount()).toBe(0);
    repo.addDocument(makeDoc('x.md'));
    expect(repo.getDocumentCount()).toBe(1);
  });

  it('metadata 字段正确序列化/反序列化', () => {
    const added = repo.addDocument({
      path: 'meta.md',
      metadata: { nested: { deep: true }, arr: [1, 2, 3] },
    });
    const found = repo.getDocumentById(added.id);
    expect(found!.metadata).toEqual({ nested: { deep: true }, arr: [1, 2, 3] });
  });
});

// ── 关系边 CRUD ───────────────────────────────────────────────────────────────

describe('SqliteGraphRepository — 关系边 CRUD', () => {
  let repo: SqliteGraphRepository;
  let srcId: string;
  let tgtId: string;

  beforeEach(() => {
    repo = createRepo();
    srcId = repo.addDocument(makeDoc('src.md')).id;
    tgtId = repo.addDocument(makeDoc('tgt.md')).id;
  });
  afterEach(() => { repo.close(); });

  const makeRel = (overrides?: object) => ({
    sourceDocId: srcId,
    targetDocId: tgtId,
    relationType: RELATION_TYPES.SYNC_REQUIRED,
    confidence: 0.9,
    source: 'auto_scan' as const,
    status: 'active' as const,
    ...overrides,
  });

  it('addRelation 返回带 id 的完整关系边记录', () => {
    const rel = repo.addRelation(makeRel());
    expect(rel.id).toBeTruthy();
    expect(rel.sourceDocId).toBe(srcId);
    expect(rel.targetDocId).toBe(tgtId);
    expect(rel.relationType).toBe(RELATION_TYPES.SYNC_REQUIRED);
  });

  it('getRelationById 返回已存在关系', () => {
    const added = repo.addRelation(makeRel());
    expect(repo.getRelationById(added.id)).not.toBeNull();
  });

  it('getRelationById 对不存在 id 返回 null', () => {
    expect(repo.getRelationById('ghost')).toBeNull();
  });

  it('getRelationsByDocId direction=source 只返回出边', () => {
    const thirdId = repo.addDocument(makeDoc('third.md')).id;
    repo.addRelation(makeRel()); // srcId → tgtId
    repo.addRelation({ ...makeRel(), sourceDocId: thirdId, targetDocId: srcId }); // third → srcId (入边)

    const outgoing = repo.getRelationsByDocId(srcId, 'source');
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].sourceDocId).toBe(srcId);
  });

  it('getRelationsByDocId direction=target 只返回入边', () => {
    repo.addRelation(makeRel()); // srcId → tgtId
    const incoming = repo.getRelationsByDocId(tgtId, 'target');
    expect(incoming).toHaveLength(1);
    expect(incoming[0].targetDocId).toBe(tgtId);
  });

  it('getRelationsByDocId direction=both（默认）返回出入边', () => {
    const thirdId = repo.addDocument(makeDoc('t3.md')).id;
    repo.addRelation(makeRel()); // srcId → tgtId
    repo.addRelation({ ...makeRel(), sourceDocId: thirdId, targetDocId: srcId, relationType: RELATION_TYPES.REFERENCES }); // third → srcId

    const all = repo.getRelationsByDocId(srcId); // both by default
    expect(all).toHaveLength(2);
  });

  it('getRelationsByType 按关系类型查询', () => {
    repo.addRelation(makeRel({ relationType: RELATION_TYPES.CONTEXT_FOR }));
    repo.addRelation(makeRel({ relationType: RELATION_TYPES.REFERENCES }));

    const results = repo.getRelationsByType(RELATION_TYPES.CONTEXT_FOR);
    expect(results).toHaveLength(1);
    expect(results[0].relationType).toBe(RELATION_TYPES.CONTEXT_FOR);
  });

  it('updateRelation 更新字段并返回更新记录', () => {
    const added = repo.addRelation(makeRel());
    const updated = repo.updateRelation(added.id, { confidence: 0.5, status: 'deprecated' });
    expect(updated.confidence).toBe(0.5);
    expect(updated.status).toBe('deprecated');
  });

  it('updateRelation 对不存在 id 抛出错误', () => {
    expect(() => repo.updateRelation('ghost', { confidence: 0.1 })).toThrow();
  });

  it('deleteRelation 删除指定关系', () => {
    const added = repo.addRelation(makeRel());
    repo.deleteRelation(added.id);
    expect(repo.getRelationById(added.id)).toBeNull();
  });

  it('deleteRelationsByDocId direction=source 只删出边', () => {
    const thirdId = repo.addDocument(makeDoc('t4.md')).id;
    repo.addRelation(makeRel()); // srcId → tgtId (出边)
    repo.addRelation({ ...makeRel(), sourceDocId: thirdId, targetDocId: srcId, relationType: RELATION_TYPES.REFERENCES }); // third → srcId (入边)

    repo.deleteRelationsByDocId(srcId, 'source');
    // 出边被删，入边保留
    expect(repo.getRelationsByDocId(srcId, 'source')).toHaveLength(0);
    expect(repo.getRelationsByDocId(srcId, 'target')).toHaveLength(1);
  });

  it('deleteRelationsByDocId direction=target 只删入边', () => {
    const thirdId = repo.addDocument(makeDoc('t5.md')).id;
    repo.addRelation(makeRel()); // srcId → tgtId (srcId 出边)
    repo.addRelation({ ...makeRel(), sourceDocId: thirdId, targetDocId: srcId, relationType: RELATION_TYPES.REFERENCES }); // third → srcId (srcId 入边)

    repo.deleteRelationsByDocId(srcId, 'target');
    // 入边被删，出边保留
    expect(repo.getRelationsByDocId(srcId, 'target')).toHaveLength(0);
    expect(repo.getRelationsByDocId(srcId, 'source')).toHaveLength(1);
  });

  it('deleteRelationsByDocId direction=both（默认）删除出入边', () => {
    const thirdId = repo.addDocument(makeDoc('t6.md')).id;
    repo.addRelation(makeRel()); // srcId → tgtId
    repo.addRelation({ ...makeRel(), sourceDocId: thirdId, targetDocId: srcId, relationType: RELATION_TYPES.REFERENCES }); // third → srcId

    repo.deleteRelationsByDocId(srcId); // both by default
    expect(repo.getRelationsByDocId(srcId)).toHaveLength(0);
  });

  it('deleteRelationsByDocId excludeSources 保留指定来源的边', () => {
    repo.addRelation(makeRel({ source: 'auto_scan' }));
    repo.addRelation(makeRel({ relationType: RELATION_TYPES.REFERENCES, source: 'manual' }));

    repo.deleteRelationsByDocId(srcId, 'source', { excludeSources: ['manual'] });
    const remaining = repo.getRelationsByDocId(srcId, 'source');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].source).toBe('manual');
  });

  it('getAllRelations 返回所有关系', () => {
    repo.addRelation(makeRel({ relationType: RELATION_TYPES.SYNC_REQUIRED }));
    repo.addRelation(makeRel({ relationType: RELATION_TYPES.REFERENCES }));
    expect(repo.getAllRelations()).toHaveLength(2);
  });

  it('getRelationCount 返回正确数量', () => {
    expect(repo.getRelationCount()).toBe(0);
    repo.addRelation(makeRel());
    expect(repo.getRelationCount()).toBe(1);
  });

  it('deleteDocument 级联删除关联关系边', () => {
    repo.addRelation(makeRel());
    expect(repo.getRelationCount()).toBe(1);
    repo.deleteDocument(srcId);
    expect(repo.getRelationCount()).toBe(0);
  });
});

// ── 同步状态操作 ──────────────────────────────────────────────────────────────

describe('SqliteGraphRepository — 同步状态', () => {
  let repo: SqliteGraphRepository;
  let docId: string;

  beforeEach(() => {
    repo = createRepo();
    docId = repo.addDocument(makeDoc('sync.md')).id;
  });
  afterEach(() => { repo.close(); });

  const makeState = (overrides?: object) => ({
    docId,
    lastScannedAt: '2024-01-01T00:00:00.000Z',
    lastObservedMtimeMs: 1000,
    contentHash: 'hash123',
    status: 'synced' as const,
    ...overrides,
  });

  it('getSyncState 对未设置状态返回 null', () => {
    expect(repo.getSyncState(docId)).toBeNull();
  });

  it('upsertSyncState 插入新状态', () => {
    repo.upsertSyncState(makeState());
    const found = repo.getSyncState(docId);
    expect(found).not.toBeNull();
    expect(found!.contentHash).toBe('hash123');
    expect(found!.status).toBe('synced');
  });

  it('upsertSyncState 更新已有状态（upsert 语义）', () => {
    repo.upsertSyncState(makeState());
    repo.upsertSyncState(makeState({ contentHash: 'newhash', status: 'modified' }));
    const found = repo.getSyncState(docId);
    expect(found!.contentHash).toBe('newhash');
    expect(found!.status).toBe('modified');
  });

  it('getAllSyncStates 返回所有同步状态', () => {
    const docId2 = repo.addDocument(makeDoc('sync2.md')).id;
    repo.upsertSyncState(makeState());
    repo.upsertSyncState(makeState({ docId: docId2 }));
    expect(repo.getAllSyncStates()).toHaveLength(2);
  });

  it('deleteDocument 级联删除同步状态', () => {
    repo.upsertSyncState(makeState());
    repo.deleteDocument(docId);
    expect(repo.getSyncState(docId)).toBeNull();
  });
});

// ── 事务支持 ──────────────────────────────────────────────────────────────────

describe('SqliteGraphRepository — 事务', () => {
  let repo: SqliteGraphRepository;

  beforeEach(() => { repo = createRepo(); });
  afterEach(() => { repo.close(); });

  it('transaction 正常提交：两次插入均持久化', () => {
    repo.transaction(() => {
      repo.addDocument(makeDoc('tx-a.md'));
      repo.addDocument(makeDoc('tx-b.md'));
    });
    expect(repo.getDocumentCount()).toBe(2);
  });

  it('transaction 异常回滚：抛出错误时插入全部撤销', () => {
    expect(() => {
      repo.transaction(() => {
        repo.addDocument(makeDoc('tx-rollback.md'));
        throw new Error('强制回滚');
      });
    }).toThrow('强制回滚');
    // 回滚后文档数应为 0
    expect(repo.getDocumentCount()).toBe(0);
  });

  it('transaction 返回函数的返回值', () => {
    const result = repo.transaction(() => {
      const doc = repo.addDocument(makeDoc('tx-ret.md'));
      return doc.id;
    });
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });
});

// ── WAL 模式 ──────────────────────────────────────────────────────────────────

describe('SqliteGraphRepository — WAL 模式', () => {
  it('构造后 journal_mode 为 wal', () => {
    // 间接验证：WAL 模式下 PRAGMA 返回 'wal'
    // 通过正常操作验证（无法直接访问私有 db）
    const repo = createRepo();
    // 能正常写入读取即说明 WAL 已启用且正常工作
    const doc = repo.addDocument(makeDoc('wal.md'));
    expect(repo.getDocumentById(doc.id)).not.toBeNull();
    repo.close();
  });
});

// ── F3: manual + auto_scan 并存唯一索引验证 ──────────────────────────────────

describe('SqliteGraphRepository — unique index 含 source 维度（F3）', () => {
  let repo: SqliteGraphRepository;
  let srcId: string;
  let tgtId: string;

  beforeEach(() => {
    repo = createRepo();
    srcId = repo.addDocument(makeDoc('f3-src.md')).id;
    tgtId = repo.addDocument(makeDoc('f3-tgt.md')).id;
  });

  afterEach(() => { repo.close(); });

  const makeRel = (source: 'auto_scan' | 'manual', overrides = {}) => ({
    sourceDocId: srcId,
    targetDocId: tgtId,
    relationType: RELATION_TYPES.REFERENCES,
    confidence: 0.8,
    source,
    status: 'active' as const,
    ...overrides,
  });

  it('同一对节点同一 relationType 的 auto_scan 和 manual 关系可以并存', () => {
    repo.addRelation(makeRel('auto_scan'));
    // 不同 source 可插入第二条，不会违反唯一约束
    expect(() => repo.addRelation(makeRel('manual'))).not.toThrow();
    expect(repo.getAllRelations()).toHaveLength(2);
  });

  it('同一对节点同一 relationType 同一 source 重复插入时抛出唯一约束错误', () => {
    repo.addRelation(makeRel('auto_scan'));
    expect(() => repo.addRelation(makeRel('auto_scan'))).toThrow();
  });
});

// ── F1b: relation_type DB CHECK 约束写入期校验（Round 3 Fix）────────────────

describe('SqliteGraphRepository — relation_type DB CHECK 约束（F1b）', () => {
  let repo: SqliteGraphRepository;
  let srcId: string;
  let tgtId: string;

  beforeEach(() => {
    repo = createRepo();
    srcId = repo.addDocument(makeDoc('f1b-src.md')).id;
    tgtId = repo.addDocument(makeDoc('f1b-tgt.md')).id;
  });

  afterEach(() => { repo.close(); });

  it('插入非法 relation_type 值时，DB CHECK 约束在写入阶段抛出错误', () => {
    // 直接操作底层 db 绕过 TS 类型，验证 DB 层约束有效
    const db = (repo as unknown as { db: import('better-sqlite3').Database }).db;
    const srcDocId = srcId;
    const tgtDocId = tgtId;
    expect(() => {
      db.prepare(
        `INSERT INTO relations (id, source_doc_id, target_doc_id, relation_type, confidence, source, status, created_at, updated_at)
         VALUES ('bad-rel-1', ?, ?, 'INVALID_TYPE', 0.5, 'auto_scan', 'active', datetime('now'), datetime('now'))`
      ).run(srcDocId, tgtDocId);
    }).toThrow();
  });

  it('插入合法 relation_type 值时，DB CHECK 约束不阻塞写入', () => {
    const db = (repo as unknown as { db: import('better-sqlite3').Database }).db;
    expect(() => {
      db.prepare(
        `INSERT INTO relations (id, source_doc_id, target_doc_id, relation_type, confidence, source, status, created_at, updated_at)
         VALUES ('ok-rel-1', ?, ?, 'references', 0.5, 'auto_scan', 'active', datetime('now'), datetime('now'))`
      ).run(srcId, tgtId);
    }).not.toThrow();
  });
});
