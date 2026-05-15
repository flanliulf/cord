import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteGraphRepository, type IGraphRepository, type SyncState } from '../../../src/repositories/index.js';
import { StatusService } from '../../../src/services/status-service.js';
import { RELATION_TYPES, type DocumentNode, type RelationEdge, type RelationType } from '../../../src/types/index.js';

type StatusRepository = IGraphRepository & {
  getMigrationVersion(): number;
};

class InMemoryStatusRepository implements StatusRepository {
  private readonly documentsById: Map<string, DocumentNode>;

  private readonly documentsByPath: Map<string, DocumentNode>;

  private readonly relationsById: Map<string, RelationEdge>;

  private readonly syncStatesByDocId: Map<string, SyncState>;

  constructor(
    private readonly documents: DocumentNode[],
    private readonly relations: RelationEdge[],
    syncStates: SyncState[] = [],
    private readonly migrationVersion = 0,
  ) {
    this.documentsById = new Map(documents.map((document) => [document.id, document]));
    this.documentsByPath = new Map(documents.map((document) => [document.path, document]));
    this.relationsById = new Map(relations.map((relation) => [relation.id, relation]));
    this.syncStatesByDocId = new Map(syncStates.map((state) => [state.docId, state]));
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
    return this.relations.filter((relation) => {
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

  getSyncState(docId: string): SyncState | null {
    return this.syncStatesByDocId.get(docId) ?? null;
  }

  upsertSyncState(): void {
    throw new Error('not implemented');
  }

  getAllSyncStates(): SyncState[] {
    return [...this.syncStatesByDocId.values()];
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

  getMigrationVersion(): number {
    return this.migrationVersion;
  }

  close(): void {}
}

class SnapshotAwareStatusRepository extends InMemoryStatusRepository {
  transactionCalls = 0;

  documentCountCalls = 0;

  relationCountCalls = 0;

  transaction<T>(fn: () => T): T {
    this.transactionCalls += 1;
    return super.transaction(fn);
  }

  getDocumentCount(): number {
    this.documentCountCalls += 1;
    return 999;
  }

  getRelationCount(): number {
    this.relationCountCalls += 1;
    return 888;
  }
}

function createDocument(id: string, path: string): DocumentNode {
  return {
    id,
    path,
    title: path,
    docType: 'story',
    framework: 'bmad',
    metadata: {},
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
  };
}

function createRelation(
  overrides: Partial<RelationEdge> & Pick<RelationEdge, 'id' | 'sourceDocId' | 'targetDocId'>,
): RelationEdge {
  return {
    id: overrides.id,
    sourceDocId: overrides.sourceDocId,
    targetDocId: overrides.targetDocId,
    relationType: overrides.relationType ?? RELATION_TYPES.REFERENCES,
    confidence: overrides.confidence ?? 0.8,
    source: overrides.source ?? 'auto_scan',
    status: overrides.status ?? 'active',
    metadata: overrides.metadata,
    createdAt: overrides.createdAt ?? '2026-05-12T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-12T00:00:00.000Z',
  };
}

function createSyncState(
  docId: string,
  overrides: Partial<SyncState> = {},
): SyncState {
  return {
    docId,
    lastScannedAt: overrides.lastScannedAt ?? '2026-05-12T08:00:00.000Z',
    lastObservedMtimeMs: overrides.lastObservedMtimeMs ?? Date.parse('2026-05-12T08:00:00.000Z'),
    contentHash: overrides.contentHash ?? `hash-${docId}`,
    status: overrides.status ?? 'synced',
  };
}

describe('StatusService', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns graph health metrics, config status, and migrationVersion', () => {
    const root = mkdtempSync(join(tmpdir(), 'cord-status-service-'));
    const projectRoot = join(root, 'project');
    const dataDir = join(projectRoot, '.cord');
    createdRoots.push(root);
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(projectRoot, 'cord.config.yaml'),
      [
        'framework: bmad',
        'scanPaths:',
        '  - docs',
        '  - _bmad-output',
        'excludePaths:',
        '  - node_modules/',
        '  - dist/',
        'confidenceThreshold: 0.72',
      ].join('\n'),
      'utf-8',
    );

    const repository = new SqliteGraphRepository(join(dataDir, 'cord.db'));
    const docA = repository.addDocument({
      path: 'docs/a.md',
      title: 'A',
      docType: 'story',
      framework: 'bmad',
      contentHash: 'hash-a',
      metadata: {},
    });
    const docB = repository.addDocument({
      path: 'docs/b.md',
      title: 'B',
      docType: 'story',
      framework: 'bmad',
      contentHash: 'hash-b',
      metadata: {},
    });
    const docC = repository.addDocument({
      path: 'docs/c.md',
      title: 'C',
      docType: 'story',
      framework: 'bmad',
      contentHash: 'hash-c',
      metadata: {},
    });

    repository.addRelation({
      sourceDocId: docA.id,
      targetDocId: docB.id,
      relationType: RELATION_TYPES.REFERENCES,
      confidence: 0.8,
      source: 'auto_scan',
      status: 'active',
      metadata: {},
    });
    repository.addRelation({
      sourceDocId: docB.id,
      targetDocId: docC.id,
      relationType: RELATION_TYPES.SYNC_REQUIRED,
      confidence: 0.95,
      source: 'manual',
      status: 'active',
      metadata: {},
    });

    repository.upsertSyncState(createSyncState(docA.id, { lastScannedAt: '2026-05-12T08:00:00.000Z' }));
    repository.upsertSyncState(createSyncState(docB.id, { lastScannedAt: '2026-05-12T09:00:00.000Z' }));
    repository.upsertSyncState(createSyncState(docC.id, { lastScannedAt: '2026-05-12T10:00:00.000Z' }));

    const service = new StatusService(repository);

    const result = service.getStatus({ projectRoot });

    expect(result).toEqual({
      documentCount: 3,
      relationCount: 2,
      relationsByType: {
        references: 1,
        sync_required: 1,
      },
      lastScanTime: '2026-05-12T10:00:00.000Z',
      migrationVersion: 2,
      staleRelations: 0,
      orphanedNodes: 0,
      danglingEdges: 0,
      configFilePath: join(projectRoot, 'cord.config.yaml'),
      framework: 'bmad',
      scanPaths: ['docs', '_bmad-output'],
      excludePaths: ['node_modules/', 'dist/'],
      confidenceThreshold: 0.72,
    });

    service.close();
  });

  it('counts stale relations and reports orphaned nodes plus dangling edges', () => {
    const documents = [
      createDocument('doc-a', 'docs/a.md'),
      createDocument('doc-b', 'docs/b.md'),
      createDocument('doc-orphan', 'docs/orphan.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-stale',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-b',
        relationType: RELATION_TYPES.MUST_CONSISTENT,
        createdAt: '2026-05-10T00:00:00.000Z',
      }),
      createRelation({
        id: 'rel-dangling',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-missing',
        relationType: RELATION_TYPES.REFERENCES,
        createdAt: '2026-05-12T00:00:00.000Z',
      }),
    ];
    const syncStates = [
      createSyncState('doc-a', { lastObservedMtimeMs: Date.parse('2026-05-11T00:00:00.000Z') }),
      createSyncState('doc-b', { lastObservedMtimeMs: Date.parse('2026-05-09T00:00:00.000Z') }),
      createSyncState('doc-orphan', { lastObservedMtimeMs: Date.parse('2026-05-12T12:00:00.000Z') }),
    ];
    const service = new StatusService(new InMemoryStatusRepository(documents, relations, syncStates, 4));

    const result = service.getStatus({ projectRoot: '/repo' });

    expect(result.staleRelations).toBe(1);
    expect(result.orphanedNodes).toBe(1);
    expect(result.danglingEdges).toBe(1);
    expect(result.relationsByType).toEqual({
      must_consistent: 1,
      references: 1,
    });
    expect(result.migrationVersion).toBe(4);
  });

  it('uses a single repository transaction and derives counts from the same snapshot arrays', () => {
    const documents = [
      createDocument('doc-a', 'docs/a.md'),
      createDocument('doc-b', 'docs/b.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-1',
        sourceDocId: 'doc-a',
        targetDocId: 'doc-b',
      }),
    ];
    const repository = new SnapshotAwareStatusRepository(documents, relations, [], 2);
    const service = new StatusService(repository);

    const result = service.getStatus({ projectRoot: '/repo' });

    expect(result.documentCount).toBe(2);
    expect(result.relationCount).toBe(1);
    expect(repository.transactionCalls).toBe(1);
    expect(repository.documentCountCalls).toBe(0);
    expect(repository.relationCountCalls).toBe(0);
  });

  it('counts a document with only dangling relations as orphaned', () => {
    const documents = [createDocument('doc-dangling-only', 'docs/dangling-only.md')];
    const relations = [
      createRelation({
        id: 'rel-dangling-only',
        sourceDocId: 'doc-dangling-only',
        targetDocId: 'doc-missing',
      }),
    ];
    const service = new StatusService(new InMemoryStatusRepository(documents, relations, [], 3));

    const result = service.getStatus({ projectRoot: '/repo' });

    expect(result.documentCount).toBe(1);
    expect(result.relationCount).toBe(1);
    expect(result.orphanedNodes).toBe(1);
    expect(result.danglingEdges).toBe(1);
  });

  it('returns empty graph defaults when no config file or graph data exists', () => {
    const service = new StatusService(new InMemoryStatusRepository([], [], []));

    const result = service.getStatus({ projectRoot: '/repo' });

    expect(result).toEqual({
      documentCount: 0,
      relationCount: 0,
      relationsByType: {},
      lastScanTime: null,
      migrationVersion: 0,
      staleRelations: 0,
      orphanedNodes: 0,
      danglingEdges: 0,
      configFilePath: null,
      framework: null,
      scanPaths: ['.'],
      excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
      confidenceThreshold: 0.5,
    });
  });
});