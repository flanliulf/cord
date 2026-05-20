import { describe, expect, it } from 'vitest';
import type { IGraphRepository, SyncState } from '../../../src/repositories/index.js';
import { RelationService } from '../../../src/services/relation-service.js';
import type { DocumentNode, RelationEdge, RelationType } from '../../../src/types/index.js';
import { RELATION_TYPES } from '../../../src/types/index.js';

class InMemoryRelationRepository implements IGraphRepository {
  private nextRelationId = 1;

  private readonly relationTimestampBaseMs = Date.parse('2026-05-14T00:00:00.000Z');

  private readonly documentsById = new Map<string, DocumentNode>();

  private readonly documentsByPath = new Map<string, DocumentNode>();

  private readonly relationsById = new Map<string, RelationEdge>();

  constructor(documents: DocumentNode[], relations: RelationEdge[] = []) {
    for (const document of documents) {
      this.documentsById.set(document.id, document);
      this.documentsByPath.set(document.path, document);
    }

    for (const relation of relations) {
      this.relationsById.set(relation.id, relation);
    }
  }

  addDocument(): DocumentNode {
    throw new Error('not implemented');
  }

  getDocumentById(id: string): DocumentNode | null {
    return this.documentsById.get(id) ?? null;
  }

  getDocumentByPath(path: string): DocumentNode | null {
    return this.documentsByPath.get(path) ?? null;
  }

  getAllDocuments(): DocumentNode[] {
    return [...this.documentsById.values()];
  }

  updateDocument(): DocumentNode {
    throw new Error('not implemented');
  }

  deleteDocument(): void {
    throw new Error('not implemented');
  }

  deleteAllDocuments(): void {
    this.documentsById.clear();
    this.documentsByPath.clear();
  }

  addRelation(rel: Omit<RelationEdge, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge {
    const timestamp = new Date(this.relationTimestampBaseMs + this.nextRelationId * 1000).toISOString();
    const relation: RelationEdge = {
      ...rel,
      id: `rel-${this.nextRelationId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.nextRelationId += 1;
    this.relationsById.set(relation.id, relation);
    return relation;
  }

  getRelationById(id: string): RelationEdge | null {
    return this.relationsById.get(id) ?? null;
  }

  getRelationsByDocId(docId: string, direction: 'source' | 'target' | 'both' = 'both'): RelationEdge[] {
    return [...this.relationsById.values()].filter((relation) => {
      if (direction === 'source') {
        return relation.sourceDocId === docId;
      }

      if (direction === 'target') {
        return relation.targetDocId === docId;
      }

      return relation.sourceDocId === docId || relation.targetDocId === docId;
    });
  }

  getRelationsByType(relationType: RelationType): RelationEdge[] {
    return [...this.relationsById.values()].filter((relation) => relation.relationType === relationType);
  }

  updateRelation(
    id: string,
    updates: Omit<Partial<RelationEdge>, 'id' | 'createdAt' | 'updatedAt'>,
  ): RelationEdge {
    const existing = this.getRelationById(id);

    if (existing === null) {
      throw new Error(`Relation not found: ${id}`);
    }

    const updated: RelationEdge = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date('2026-05-14T00:10:00.000Z').toISOString(),
    };

    this.relationsById.set(id, updated);
    return updated;
  }

  deleteRelation(id: string): void {
    this.relationsById.delete(id);
  }

  deleteRelationsByDocId(docId: string, direction: 'source' | 'target' | 'both' = 'both'): void {
    for (const relation of this.getRelationsByDocId(docId, direction)) {
      this.relationsById.delete(relation.id);
    }
  }

  getAllRelations(): RelationEdge[] {
    return [...this.relationsById.values()];
  }

  getSyncState(): SyncState | null {
    return null;
  }

  upsertSyncState(): void {
    throw new Error('not implemented');
  }

  getAllSyncStates(): SyncState[] {
    return [];
  }

  transaction<T>(fn: () => T): T {
    return fn();
  }

  getDocumentCount(): number {
    return this.documentsById.size;
  }

  getRelationCount(): number {
    return this.relationsById.size;
  }

  close(): void {
    // no-op
  }
}

function createDocument(id: string, path: string): DocumentNode {
  return {
    id,
    path,
    title: path,
    docType: 'story',
    metadata: {},
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
  };
}

function createRelation(overrides: Partial<RelationEdge> & Pick<RelationEdge, 'id' | 'sourceDocId' | 'targetDocId'>): RelationEdge {
  return {
    id: overrides.id,
    sourceDocId: overrides.sourceDocId,
    targetDocId: overrides.targetDocId,
    relationType: overrides.relationType ?? RELATION_TYPES.REFERENCES,
    confidence: overrides.confidence ?? 0.8,
    source: overrides.source ?? 'auto_scan',
    status: overrides.status ?? 'active',
    metadata: overrides.metadata,
    createdAt: overrides.createdAt ?? '2026-05-14T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-14T00:00:00.000Z',
  };
}

function createRepository(relations: RelationEdge[] = []): InMemoryRelationRepository {
  return new InMemoryRelationRepository(
    [
      createDocument('doc-a', 'docs/a.md'),
      createDocument('doc-b', 'docs/b.md'),
      createDocument('doc-c', 'docs/c.md'),
    ],
    relations,
  );
}

describe('RelationService', () => {
  it('手动添加关系时写入 manual 来源与 active 状态', () => {
    const repository = createRepository();
    const service = new RelationService(repository);

    const result = service.addRelation({
      sourcePath: 'docs/a.md',
      targetPath: 'docs/b.md',
      relationType: RELATION_TYPES.REFERENCES,
    });

    expect(result.sourceDocId).toBe('doc-a');
    expect(result.targetDocId).toBe('doc-b');
    expect(result.relationType).toBe(RELATION_TYPES.REFERENCES);
    expect(result.source).toBe('manual');
    expect(result.status).toBe('active');
    expect(repository.getRelationById(result.id)).toMatchObject({
      source: 'manual',
      status: 'active',
    });
  });

  it('源文档不存在时返回带错误码与建议的错误', () => {
    const service = new RelationService(createRepository());

    expect(() =>
      service.addRelation({
        sourcePath: 'docs/missing.md',
        targetPath: 'docs/b.md',
        relationType: RELATION_TYPES.REFERENCES,
      }),
    ).toThrow(/\[CORD_RELATION_001\].*请先运行 cord scan/);
  });

  it('重复关系检测忽略 relation source 与 status，返回明确提示', () => {
    const repository = createRepository([
      createRelation({
        id: 'rel-existing',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-b',
        relationType: RELATION_TYPES.REFERENCES,
        source: 'auto_scan',
        status: 'deprecated',
      }),
    ]);
    const service = new RelationService(repository);

    expect(() =>
      service.addRelation({
        sourcePath: 'docs/a.md',
        targetPath: 'docs/b.md',
        relationType: RELATION_TYPES.REFERENCES,
      }),
    ).toThrow(/\[CORD_RELATION_002\].*重复关系/);
  });

  it('连续添加 10 条以上关系时测试仓储仍生成有效时间戳', () => {
    const repository = createRepository();
    const relationPairs = [
      ['doc-a', 'doc-b'],
      ['doc-a', 'doc-c'],
      ['doc-b', 'doc-a'],
      ['doc-b', 'doc-c'],
      ['doc-c', 'doc-a'],
      ['doc-c', 'doc-b'],
    ] as const;
    const createdRelations: RelationEdge[] = [];

    for (let index = 0; index < 12; index += 1) {
      const [sourceDocId, targetDocId] = relationPairs[index % relationPairs.length];
      const relationType = Object.values(RELATION_TYPES)[index % Object.values(RELATION_TYPES).length];

      createdRelations.push(
        repository.addRelation({
          sourceDocId,
          targetDocId,
          relationType,
          confidence: 0.8,
          source: 'manual',
          status: 'active',
        }),
      );
    }

    expect(createdRelations).toHaveLength(12);
    expect(createdRelations[9]?.createdAt).toBe('2026-05-14T00:00:10.000Z');
    expect(createdRelations[11]?.createdAt).toBe('2026-05-14T00:00:12.000Z');
  });

  it('deprecateRelation 会将关系切换为 manual 并追加 metadata.history', () => {
    const repository = createRepository([
      createRelation({
        id: 'rel-active',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-b',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        source: 'auto_scan',
        status: 'active',
        metadata: { note: 'keep-me' },
      }),
    ]);
    const service = new RelationService(repository);

    const result = service.deprecateRelation({ relationId: 'rel-active' });

    expect(result.relationType).toBe(RELATION_TYPES.SYNC_REQUIRED);
    expect(result.source).toBe('manual');
    expect(result.status).toBe('deprecated');
    expect(result.metadata).toMatchObject({ note: 'keep-me' });
    expect(result.metadata).toMatchObject({
      history: [
        expect.objectContaining({
          action: 'deprecated',
          previousSource: 'auto_scan',
          nextSource: 'manual',
          previousStatus: 'active',
          nextStatus: 'deprecated',
        }),
      ],
    });
  });

  it('removeRelation 执行硬删除且不保留关系记录', () => {
    const repository = createRepository([
      createRelation({
        id: 'rel-remove',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-b',
      }),
    ]);
    const service = new RelationService(repository);

    service.removeRelation({ relationId: 'rel-remove' });

    expect(repository.getRelationById('rel-remove')).toBeNull();
  });
});
