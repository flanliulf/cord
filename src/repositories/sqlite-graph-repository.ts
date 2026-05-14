import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { DocumentNode, RelationEdge, RelationSource, RelationType } from '../types/index.js';
import type { IGraphRepository, SyncState } from './interfaces.js';
import {
  documentToRow,
  relationToRow,
  rowToDocument,
  rowToRelation,
  rowToSyncState,
  syncStateToRow,
} from './mappers.js';
import type { DocumentRow, RelationRow, SyncStateRow } from './mappers.js';
import { runMigrations } from './migrations/runner.js';

/**
 * SqliteGraphRepository 是 IGraphRepository 的 SQLite 同步实现。
 *
 * 构造时自动：
 * 1. 开启 WAL 模式（AC#7）
 * 2. 开启外键约束
 * 3. 运行所有未执行的迁移（AC#5）
 */
export class SqliteGraphRepository implements IGraphRepository {
  private readonly db: InstanceType<typeof Database>;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    // WAL 模式（AC#7）
    this.db.pragma('journal_mode = WAL');
    // 启用外键约束
    this.db.pragma('foreign_keys = ON');
    // 启动即迁移（AC#5，幂等）
    runMigrations(this.db);
  }

  // ── 文档节点 CRUD ──────────────────────────────────────────────────────────

  addDocument(doc: Omit<DocumentNode, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode {
    const now = new Date().toISOString();
    const id = randomUUID();
    const full: DocumentNode = { ...doc, id, createdAt: now, updatedAt: now };
    const row = documentToRow(full as DocumentNode & { createdAt: string; updatedAt: string });
    this.db
      .prepare<DocumentRow>(
        `INSERT INTO documents (id, path, title, doc_type, framework, content_hash, metadata, created_at, updated_at)
         VALUES ($id, $path, $title, $doc_type, $framework, $content_hash, $metadata, $created_at, $updated_at)`,
      )
      .run(row as unknown as DocumentRow);
    return full;
  }

  getDocumentById(id: string): DocumentNode | null {
    const row = this.db
      .prepare<[string], DocumentRow>('SELECT * FROM documents WHERE id = ?')
      .get(id);
    return row ? rowToDocument(row) : null;
  }

  getDocumentByPath(path: string): DocumentNode | null {
    const row = this.db
      .prepare<[string], DocumentRow>('SELECT * FROM documents WHERE path = ?')
      .get(path);
    return row ? rowToDocument(row) : null;
  }

  getAllDocuments(): DocumentNode[] {
    const rows = this.db.prepare<[], DocumentRow>('SELECT * FROM documents').all();
    return rows.map(rowToDocument);
  }

  updateDocument(
    id: string,
    updates: Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>,
  ): DocumentNode {
    const existing = this.getDocumentById(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }
    // 显式丢弃不可变字段（即使调用方传入也不生效）
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as Partial<DocumentNode>;
    void _id; void _ca; void _ua;
    const merged: DocumentNode = {
      ...existing,
      ...safeUpdates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const row = documentToRow(merged);
    this.db
      .prepare(
        `UPDATE documents
         SET path = $path, title = $title, doc_type = $doc_type, framework = $framework,
             content_hash = $content_hash, metadata = $metadata, updated_at = $updated_at
         WHERE id = $id`,
      )
      .run(row);
    return merged;
  }

  deleteDocument(id: string): void {
    this.db.prepare<[string]>('DELETE FROM documents WHERE id = ?').run(id);
  }

  deleteAllDocuments(): void {
    this.db.prepare('DELETE FROM documents').run();
  }

  // ── 关系边 CRUD ────────────────────────────────────────────────────────────

  addRelation(rel: Omit<RelationEdge, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge {
    const now = new Date().toISOString();
    const id = randomUUID();
    const full: RelationEdge = { ...rel, id, createdAt: now, updatedAt: now };
    const row = relationToRow(full as RelationEdge & { createdAt: string; updatedAt: string });
    this.db
      .prepare<RelationRow>(
        `INSERT INTO relations
           (id, source_doc_id, target_doc_id, relation_type, confidence, source, status, metadata, created_at, updated_at)
         VALUES
           ($id, $source_doc_id, $target_doc_id, $relation_type, $confidence, $source, $status, $metadata, $created_at, $updated_at)`,
      )
      .run(row as unknown as RelationRow);
    return full;
  }

  getRelationById(id: string): RelationEdge | null {
    const row = this.db
      .prepare<[string], RelationRow>('SELECT * FROM relations WHERE id = ?')
      .get(id);
    return row ? rowToRelation(row) : null;
  }

  getRelationsByDocId(
    docId: string,
    direction: 'source' | 'target' | 'both' = 'both',
  ): RelationEdge[] {
    let rows: RelationRow[];
    if (direction === 'source') {
      rows = this.db
        .prepare<[string], RelationRow>('SELECT * FROM relations WHERE source_doc_id = ?')
        .all(docId);
    } else if (direction === 'target') {
      rows = this.db
        .prepare<[string], RelationRow>('SELECT * FROM relations WHERE target_doc_id = ?')
        .all(docId);
    } else {
      rows = this.db
        .prepare<[string, string], RelationRow>(
          'SELECT * FROM relations WHERE source_doc_id = ? OR target_doc_id = ?',
        )
        .all(docId, docId);
    }
    return rows.map(rowToRelation);
  }

  getRelationsByType(relationType: RelationType): RelationEdge[] {
    const rows = this.db
      .prepare<[string], RelationRow>('SELECT * FROM relations WHERE relation_type = ?')
      .all(relationType);
    return rows.map(rowToRelation);
  }

  updateRelation(
    id: string,
    updates: Omit<Partial<RelationEdge>, 'id' | 'createdAt' | 'updatedAt'>,
  ): RelationEdge {
    const existing = this.getRelationById(id);
    if (!existing) {
      throw new Error(`Relation not found: ${id}`);
    }
    // 显式丢弃不可变字段
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as Partial<RelationEdge>;
    void _id; void _ca; void _ua;
    const merged: RelationEdge = {
      ...existing,
      ...safeUpdates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const row = relationToRow(merged);
    this.db
      .prepare(
        `UPDATE relations
         SET source_doc_id = $source_doc_id, target_doc_id = $target_doc_id,
             relation_type = $relation_type, confidence = $confidence,
             source = $source, status = $status, metadata = $metadata,
             updated_at = $updated_at
         WHERE id = $id`,
      )
      .run(row);
    return merged;
  }

  deleteRelation(id: string): void {
    this.db.prepare<[string]>('DELETE FROM relations WHERE id = ?').run(id);
  }

  deleteRelationsByDocId(
    docId: string,
    direction: 'source' | 'target' | 'both' = 'both',
    options?: { excludeSources?: RelationSource[] },
  ): void {
    const excludeSources = options?.excludeSources ?? [];

    // 构建 exclude 占位符
    const excludeClause =
      excludeSources.length > 0
        ? `AND source NOT IN (${excludeSources.map(() => '?').join(', ')})`
        : '';

    if (direction === 'source') {
      this.db
        .prepare(`DELETE FROM relations WHERE source_doc_id = ? ${excludeClause}`)
        .run(docId, ...excludeSources);
    } else if (direction === 'target') {
      this.db
        .prepare(`DELETE FROM relations WHERE target_doc_id = ? ${excludeClause}`)
        .run(docId, ...excludeSources);
    } else {
      this.db
        .prepare(
          `DELETE FROM relations WHERE (source_doc_id = ? OR target_doc_id = ?) ${excludeClause}`,
        )
        .run(docId, docId, ...excludeSources);
    }
  }

  getAllRelations(): RelationEdge[] {
    const rows = this.db.prepare<[], RelationRow>('SELECT * FROM relations').all();
    return rows.map(rowToRelation);
  }

  // ── 同步状态操作 ───────────────────────────────────────────────────────────

  getSyncState(docId: string): SyncState | null {
    const row = this.db
      .prepare<[string], SyncStateRow>('SELECT * FROM sync_states WHERE doc_id = ?')
      .get(docId);
    return row ? rowToSyncState(row) : null;
  }

  upsertSyncState(state: SyncState): void {
    const row = syncStateToRow(state);
    this.db
      .prepare(
        `INSERT INTO sync_states (doc_id, last_scanned_at, last_observed_mtime_ms, content_hash, status, updated_at)
         VALUES ($doc_id, $last_scanned_at, $last_observed_mtime_ms, $content_hash, $status, $updated_at)
         ON CONFLICT(doc_id) DO UPDATE SET
           last_scanned_at        = excluded.last_scanned_at,
           last_observed_mtime_ms = excluded.last_observed_mtime_ms,
           content_hash           = excluded.content_hash,
           status                 = excluded.status,
           updated_at             = excluded.updated_at`,
      )
      .run(row);
  }

  getAllSyncStates(): SyncState[] {
    const rows = this.db.prepare<[], SyncStateRow>('SELECT * FROM sync_states').all();
    return rows.map(rowToSyncState);
  }

  // ── 事务支持 ───────────────────────────────────────────────────────────────

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // ── 统计 ───────────────────────────────────────────────────────────────────

  getDocumentCount(): number {
    const result = this.db
      .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM documents')
      .get();
    return result?.count ?? 0;
  }

  getRelationCount(): number {
    const result = this.db
      .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM relations')
      .get();
    return result?.count ?? 0;
  }

  getMigrationVersion(): number {
    const result = this.db
      .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM schema_migrations')
      .get();
    return result?.count ?? 0;
  }

  // ── 生命周期 ───────────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
