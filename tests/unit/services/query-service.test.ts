import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteGraphRepository, type IGraphRepository, type SyncState } from '../../../src/repositories/index.js';
import { QueryService } from '../../../src/services/query-service.js';
import type { DocumentNode, RelationEdge, RelationType } from '../../../src/types/index.js';
import { RELATION_TYPES } from '../../../src/types/index.js';
import { QueryError } from '../../../src/utils/index.js';

const sqliteDisposables: Array<{ repository: SqliteGraphRepository; root: string }> = [];

afterEach(() => {
  for (const disposable of sqliteDisposables.splice(0)) {
    try {
      disposable.repository.close();
    } catch {
      // ignore repeated close during test cleanup
    }
    rmSync(disposable.root, { recursive: true, force: true });
  }
});

class InMemoryQueryRepository implements IGraphRepository {
  closed = false;

  private readonly documentsById: Map<string, DocumentNode>;

  private readonly documentsByPath: Map<string, DocumentNode>;

  private readonly relationsById: Map<string, RelationEdge>;

  private readonly relationsByDocId: Map<string, RelationEdge[]>;

  constructor(
    private readonly documents: DocumentNode[],
    private readonly relations: RelationEdge[],
  ) {
    this.documentsById = new Map(documents.map((document) => [document.id, document]));
    this.documentsByPath = new Map(documents.map((document) => [document.path, document]));
    this.relationsById = new Map(relations.map((relation) => [relation.id, relation]));
    this.relationsByDocId = new Map<string, RelationEdge[]>();

    for (const relation of relations) {
      this.pushRelation(relation.sourceDocId, relation);
      if (relation.targetDocId !== relation.sourceDocId) {
        this.pushRelation(relation.targetDocId, relation);
      }
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
    return this.relationsById.get(id) ?? null;
  }

  getRelationsByDocId(docId: string, direction: 'source' | 'target' | 'both' = 'both'): RelationEdge[] {
    const relations = this.relationsByDocId.get(docId) ?? [];

    if (direction === 'source') {
      return relations.filter((relation) => relation.sourceDocId === docId);
    }

    if (direction === 'target') {
      return relations.filter((relation) => relation.targetDocId === docId);
    }

    return [...relations];
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

  private pushRelation(docId: string, relation: RelationEdge): void {
    const existing = this.relationsByDocId.get(docId) ?? [];
    existing.push(relation);
    this.relationsByDocId.set(docId, existing);
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

function createMultiHopService(): QueryService {
  const documents = [
    createDocument('doc-a', 'docs/a.md'),
    createDocument('doc-b', 'docs/b.md'),
    createDocument('doc-c', 'docs/c.md'),
    createDocument('doc-d', 'docs/d.md'),
    createDocument('doc-e', 'docs/e.md'),
  ];
  const relations = [
    createRelation({
      id: 'rel-a-b',
      sourceDocId: 'doc-a',
      targetDocId: 'doc-b',
      relationType: RELATION_TYPES.REFERENCES,
    }),
    createRelation({
      id: 'rel-b-c',
      sourceDocId: 'doc-b',
      targetDocId: 'doc-c',
      relationType: RELATION_TYPES.CONTEXT_FOR,
    }),
    createRelation({
      id: 'rel-c-d',
      sourceDocId: 'doc-c',
      targetDocId: 'doc-d',
      relationType: RELATION_TYPES.SYNC_REQUIRED,
    }),
    createRelation({
      id: 'rel-c-a',
      sourceDocId: 'doc-c',
      targetDocId: 'doc-a',
      relationType: RELATION_TYPES.DERIVED_FROM,
    }),
    createRelation({
      id: 'rel-b-e',
      sourceDocId: 'doc-b',
      targetDocId: 'doc-e',
      relationType: RELATION_TYPES.MUST_CONSISTENT,
      status: 'deprecated',
    }),
  ];

  return new QueryService(new InMemoryQueryRepository(documents, relations));
}

function createLinearGraphService(documentCount: number): QueryService {
  const documents = Array.from({ length: documentCount }, (_, index) =>
    createDocument(`doc-${index}`, `docs/${index}.md`),
  );
  const relations = documents.slice(0, -1).map((document, index) =>
    createRelation({
      id: `rel-${index}-${index + 1}`,
      sourceDocId: document.id,
      targetDocId: documents[index + 1]?.id ?? document.id,
      relationType: RELATION_TYPES.REFERENCES,
    }),
  );

  return new QueryService(new InMemoryQueryRepository(documents, relations));
}

function createSqliteLinearGraphService(documentCount: number): QueryService {
  const root = mkdtempSync(join(tmpdir(), 'cord-query-service-'));
  const repository = new SqliteGraphRepository(join(root, 'cord.db'));
  const documents = repository.transaction(() => Array.from({ length: documentCount }, (_, index) =>
    repository.addDocument({
      path: `docs/${index}.md`,
      title: `Doc ${index}`,
      docType: 'story',
      metadata: {},
    })));

  repository.transaction(() => {
    for (let index = 0; index < documents.length - 1; index += 1) {
      const sourceDocument = documents[index];
      const targetDocument = documents[index + 1];

      if (sourceDocument === undefined || targetDocument === undefined) {
        continue;
      }

      repository.addRelation({
        sourceDocId: sourceDocument.id,
        targetDocId: targetDocument.id,
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.8,
        source: 'auto_scan',
        status: 'active',
      });
    }
  });

  sqliteDisposables.push({ repository, root });
  return new QueryService(repository);
}

function measureBatchP95(
  service: QueryService,
  input: { docPath: string; depth: number },
  options: { batchSize?: number; warmupIterations?: number; sampleCount?: number } = {},
): number {
  const batchSize = options.batchSize ?? 25;
  const warmupIterations = options.warmupIterations ?? 20;
  const sampleCount = options.sampleCount ?? 200;

  for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
    for (let batchIndex = 0; batchIndex < batchSize; batchIndex += 1) {
      service.query(input);
    }
  }

  const durations: number[] = [];

  for (let iteration = 0; iteration < sampleCount; iteration += 1) {
    const start = performance.now();

    for (let batchIndex = 0; batchIndex < batchSize; batchIndex += 1) {
      service.query(input);
    }

    durations.push(performance.now() - start);
  }

  durations.sort((left, right) => left - right);
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  return durations[p95Index] ?? Number.POSITIVE_INFINITY;
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
          hopDistance: 1,
        },
        {
          relationId: 'rel-2',
          targetPath: 'docs/c.md',
          relationType: RELATION_TYPES.CONTEXT_FOR,
          confidence: 0.8,
          source: 'manual',
          status: 'active',
          hopDistance: 1,
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
          hopDistance: 1,
        },
      ],
      totalCount: 1,
    });
  });

  it('ignores non-matching broken edges when the query neither outputs nor expands them', () => {
    const service = new QueryService(new InMemoryQueryRepository(
      [
        createDocument('doc-a', 'docs/a.md'),
        createDocument('doc-b', 'docs/b.md'),
      ],
      [
        createRelation({
          id: 'rel-match',
          sourceDocId: 'doc-a',
          targetDocId: 'doc-b',
          relationType: RELATION_TYPES.SYNC_REQUIRED,
        }),
        createRelation({
          id: 'rel-broken-non-match',
          sourceDocId: 'doc-a',
          targetDocId: 'doc-missing',
          relationType: RELATION_TYPES.REFERENCES,
        }),
      ],
    ));

    const result = service.query({
      docPath: 'docs/a.md',
      depth: 1,
      type: RELATION_TYPES.SYNC_REQUIRED,
    });

    expect(result).toEqual({
      relations: [
        {
          relationId: 'rel-match',
          targetPath: 'docs/b.md',
          relationType: RELATION_TYPES.SYNC_REQUIRED,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
      ],
      totalCount: 1,
    });
  });

  it('does not let type filtering block deeper matches reachable through non-matching edges', () => {
    const service = createMultiHopService();

    const result = service.query({
      docPath: 'docs/a.md',
      depth: 3,
      type: RELATION_TYPES.SYNC_REQUIRED,
    });

    expect(result).toEqual({
      relations: [
        {
          relationId: 'rel-c-d',
          targetPath: 'docs/d.md',
          relationType: RELATION_TYPES.SYNC_REQUIRED,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 2,
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
      hopDistance: 1,
    });
    expect(result.totalCount).toBe(3);
  });

  it('returns empty result for documents without one-hop relations', () => {
    const service = createService();

    const result = service.query({ docPath: 'docs/d.md' });

    expect(result).toEqual({ relations: [], totalCount: 0 });
  });

  it('returns multi-hop relations in BFS order and annotates hopDistance', () => {
    const service = createMultiHopService();

    const result = service.query({ docPath: 'docs/a.md', depth: 3 });

    expect(result).toEqual({
      relations: [
        {
          relationId: 'rel-a-b',
          targetPath: 'docs/b.md',
          relationType: RELATION_TYPES.REFERENCES,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
        {
          relationId: 'rel-c-a',
          targetPath: 'docs/c.md',
          relationType: RELATION_TYPES.DERIVED_FROM,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
        {
          relationId: 'rel-b-c',
          targetPath: 'docs/c.md',
          relationType: RELATION_TYPES.CONTEXT_FOR,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 2,
        },
        {
          relationId: 'rel-c-d',
          targetPath: 'docs/d.md',
          relationType: RELATION_TYPES.SYNC_REQUIRED,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 2,
        },
      ],
      totalCount: 4,
    });
  });

  it('respects the requested depth limit', () => {
    const service = createMultiHopService();

    const result = service.query({ docPath: 'docs/a.md', depth: 1 });

    expect(result).toEqual({
      relations: [
        {
          relationId: 'rel-a-b',
          targetPath: 'docs/b.md',
          relationType: RELATION_TYPES.REFERENCES,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
        {
          relationId: 'rel-c-a',
          targetPath: 'docs/c.md',
          relationType: RELATION_TYPES.DERIVED_FROM,
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
      ],
      totalCount: 2,
    });
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

  it('meets the three-hop query p95 performance target on in-memory data', () => {
    const service = createMultiHopService();

    for (let iteration = 0; iteration < 50; iteration += 1) {
      service.query({ docPath: 'docs/a.md', depth: 3 });
    }

    const durations: number[] = [];

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const start = performance.now();
      service.query({ docPath: 'docs/a.md', depth: 3 });
      durations.push(performance.now() - start);
    }

    durations.sort((left, right) => left - right);
    const p95Index = Math.ceil(durations.length * 0.95) - 1;
    const p95 = durations[p95Index] ?? Number.POSITIVE_INFINITY;

    expect(p95).toBeLessThan(5);
  });

  it('keeps three-hop traversal performance within 10% on indexed in-memory adjacency lookup', () => {
    const smallGraphService = createLinearGraphService(200);
    const largeGraphService = createLinearGraphService(2000);

    const smallGraphP95 = measureBatchP95(smallGraphService, { docPath: 'docs/0.md', depth: 3 });
    const largeGraphP95 = measureBatchP95(largeGraphService, { docPath: 'docs/0.md', depth: 3 });

    expect(largeGraphP95).toBeLessThanOrEqual(smallGraphP95 * 1.1);
  });

  it('keeps three-hop traversal performance within 10% on SQLite repository when scaling from 200 to 2000 documents', () => {
    const smallGraphService = createSqliteLinearGraphService(200);
    const largeGraphService = createSqliteLinearGraphService(2000);

    const smallGraphP95 = measureBatchP95(
      smallGraphService,
      { docPath: 'docs/0.md', depth: 3 },
      { batchSize: 200, warmupIterations: 10, sampleCount: 80 },
    );
    const largeGraphP95 = measureBatchP95(
      largeGraphService,
      { docPath: 'docs/0.md', depth: 3 },
      { batchSize: 200, warmupIterations: 10, sampleCount: 80 },
    );

    expect(largeGraphP95).toBeLessThanOrEqual(smallGraphP95 * 1.1);
  });
});