import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { IGraphRepository, SyncState } from '../../../src/repositories/index.js';
import { QueryService } from '../../../src/services/query-service.js';
import type { DocumentNode, RelationEdge, RelationType } from '../../../src/types/index.js';
import { RELATION_TYPES } from '../../../src/types/index.js';
import { QueryError } from '../../../src/utils/index.js';

class InMemoryQueryRepository implements IGraphRepository {
  closed = false;

  constructor(
    private readonly documents: DocumentNode[],
    private readonly relations: RelationEdge[],
  ) {}

  addDocument(): DocumentNode {
    throw new Error('not implemented');
  }

  getDocumentById(id: string): DocumentNode | null {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  getDocumentByPath(path: string): DocumentNode | null {
    return this.documents.find((document) => document.path === path) ?? null;
  }

  getAllDocuments(): DocumentNode[] {
    return [...this.documents];
  }

  updateDocument(): DocumentNode {
    throw new Error('not implemented');
  }

  deleteDocument(): void {
    throw new Error('not implemented');
  }

  deleteAllDocuments(): void {
    throw new Error('not implemented');
  }

  addRelation(): RelationEdge {
    throw new Error('not implemented');
  }

  getRelationById(id: string): RelationEdge | null {
    return this.relations.find((relation) => relation.id === id) ?? null;
  }

  getRelationsByDocId(docId: string, direction: 'source' | 'target' | 'both' = 'both'): RelationEdge[] {
    if (direction === 'source') {
      return this.relations.filter((relation) => relation.sourceDocId === docId);
    }

    if (direction === 'target') {
      return this.relations.filter((relation) => relation.targetDocId === docId);
    }

    return this.relations.filter(
      (relation) => relation.sourceDocId === docId || relation.targetDocId === docId,
    );
  }

  getRelationsByType(relationType: RelationType): RelationEdge[] {
    return this.relations.filter((relation) => relation.relationType === relationType);
  }

  updateRelation(): RelationEdge {
    throw new Error('not implemented');
  }

  deleteRelation(): void {
    throw new Error('not implemented');
  }

  deleteRelationsByDocId(): void {
    throw new Error('not implemented');
  }

  getAllRelations(): RelationEdge[] {
    return [...this.relations];
  }

  getSyncState(): SyncState | null {
    throw new Error('not implemented');
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
    return this.documents.length;
  }

  getRelationCount(): number {
    return this.relations.length;
  }

  close(): void {
    this.closed = true;
  }
}

function createDocument(id: string, path: string): DocumentNode {
  return {
    id,
    path,
    title: path,
    docType: 'story',
    metadata: {},
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
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
    createdAt: overrides.createdAt ?? '2026-05-09T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-09T00:00:00.000Z',
  };
}

function createService(): QueryService {
  const documents = [
    createDocument('doc-a', 'docs/a.md'),
    createDocument('doc-b', 'docs/b.md'),
    createDocument('doc-c', 'docs/c.md'),
    createDocument('doc-d', 'docs/d.md'),
  ];
  const relations = [
    createRelation({
      id: 'rel-1',
      sourceDocId: 'doc-a',
      targetDocId: 'doc-b',
      relationType: RELATION_TYPES.REFERENCES,
    }),
    createRelation({
      id: 'rel-2',
      sourceDocId: 'doc-c',
      targetDocId: 'doc-a',
      relationType: RELATION_TYPES.CONTEXT_FOR,
      source: 'manual',
    }),
    createRelation({
      id: 'rel-3',
      sourceDocId: 'doc-a',
      targetDocId: 'doc-d',
      relationType: RELATION_TYPES.SYNC_REQUIRED,
      status: 'deprecated',
      source: 'framework_preset',
    }),
  ];

  return new QueryService(new InMemoryQueryRepository(documents, relations));
}

describe('QueryService', () => {
  it('returns one-hop relations with relationId, targetPath and status, filtering deprecated by default', () => {
    const service = createService();

    const result = service.query({ docPath: 'docs/a.md' });

    expect(result).toEqual({
      relations: [
        {
          relationId: 'rel-1',
          targetPath: 'docs/b.md',
          relationType: RELATION_TYPES.REFERENCES,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
        },
        {
          relationId: 'rel-2',
          targetPath: 'docs/c.md',
          relationType: RELATION_TYPES.CONTEXT_FOR,
          confidence: 0.8,
          source: 'manual',
          status: 'active',
        },
      ],
      totalCount: 2,
    });
  });

  it('filters relations by type', () => {
    const service = createService();

    const result = service.query({
      docPath: 'docs/a.md',
      type: RELATION_TYPES.CONTEXT_FOR,
    });

    expect(result).toEqual({
      relations: [
        {
          relationId: 'rel-2',
          targetPath: 'docs/c.md',
          relationType: RELATION_TYPES.CONTEXT_FOR,
          confidence: 0.8,
          source: 'manual',
          status: 'active',
        },
      ],
      totalCount: 1,
    });
  });

  it('returns deprecated relations when includeDeprecated=true', () => {
    const service = createService();

    const result = service.query({
      docPath: 'docs/a.md',
      includeDeprecated: true,
    });

    expect(result.relations.map((relation) => relation.relationId)).toEqual(['rel-1', 'rel-2', 'rel-3']);
    expect(result.relations.at(-1)).toMatchObject({
      relationId: 'rel-3',
      targetPath: 'docs/d.md',
      status: 'deprecated',
    });
    expect(result.totalCount).toBe(3);
  });

  it('returns empty result for documents without one-hop relations', () => {
    const service = createService();

    const result = service.query({ docPath: 'docs/d.md' });

    expect(result).toEqual({ relations: [], totalCount: 0 });
  });

  it('throws QueryError with code and suggestion when the document does not exist', () => {
    const service = createService();

    expect(() => service.query({ docPath: 'docs/missing.md' })).toThrow(QueryError);

    try {
      service.query({ docPath: 'docs/missing.md' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(QueryError);
      expect(error).toMatchObject({
        code: 'CORD_QUERY_001',
        suggestion: '请先运行 cord scan 确认文档路径',
      });
    }
  });

  it('throws QueryError with code and suggestion when a relation endpoint document is missing', () => {
    const service = new QueryService(new InMemoryQueryRepository(
      [createDocument('doc-a', 'docs/a.md')],
      [createRelation({
        id: 'rel-missing-endpoint',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-missing',
        relationType: RELATION_TYPES.REFERENCES,
      })],
    ));

    expect(() => service.query({ docPath: 'docs/a.md' })).toThrow(QueryError);

    try {
      service.query({ docPath: 'docs/a.md' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(QueryError);
      expect(error).toMatchObject({
        code: 'CORD_QUERY_002',
        suggestion: '请重新运行 cord scan 重建关系图谱',
      });
    }
  });

  it('forwards close() to the underlying repository', () => {
    const repository = new InMemoryQueryRepository([], []);
    const service = new QueryService(repository);

    service.close();

    expect(repository.closed).toBe(true);
  });

  it('meets the one-hop query p95 performance target on in-memory data', () => {
    const service = createService();

    for (let iteration = 0; iteration < 50; iteration += 1) {
      service.query({ docPath: 'docs/a.md' });
    }

    const durations: number[] = [];

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const start = performance.now();
      service.query({ docPath: 'docs/a.md' });
      durations.push(performance.now() - start);
    }

    durations.sort((left, right) => left - right);
    const p95Index = Math.ceil(durations.length * 0.95) - 1;
    const p95 = durations[p95Index] ?? Number.POSITIVE_INFINITY;

    expect(p95).toBeLessThan(1);
  });
});