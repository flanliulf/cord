import { describe, expect, it } from 'vitest';
import type { IGraphRepository, SyncState } from '../../../src/repositories/index.js';
import { ImpactService } from '../../../src/services/impact-service.js';
import { RELATION_TYPES, type DocumentNode, type RelationEdge, type RelationType } from '../../../src/types/index.js';
import { QueryError } from '../../../src/utils/index.js';

class InMemoryImpactRepository implements IGraphRepository {
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

  close(): void {}

  private pushRelation(docId: string, relation: RelationEdge): void {
    const existing = this.relationsByDocId.get(docId) ?? [];
    existing.push(relation);
    this.relationsByDocId.set(docId, existing);
  }
}

function createDocument(id: string, path: string, docType = 'story'): DocumentNode {
  return {
    id,
    path,
    title: path,
    docType,
    metadata: {},
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
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
    createdAt: overrides.createdAt ?? '2026-05-11T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-11T00:00:00.000Z',
  };
}

function createService(options: {
  documents: DocumentNode[];
  relations: RelationEdge[];
  defaultConfidenceThreshold?: number;
  updateStrategies?: Record<string, 'auto' | 'suggest' | 'log_only'>;
}): ImpactService {
  return new ImpactService(
    new InMemoryImpactRepository(options.documents, options.relations),
    {
      defaultConfidenceThreshold: options.defaultConfidenceThreshold,
      updateStrategies: options.updateStrategies,
    },
  );
}

describe('ImpactService', () => {
  it('does not include the source document when the graph has a self loop', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-downstream', 'docs/downstream.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-source-self',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-source',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.9,
      }),
      createRelation({
        id: 'rel-source-downstream',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-downstream',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result.impactedDocs.map((item) => item.docPath)).toEqual(['docs/downstream.md']);
    expect(result.totalCount).toBe(1);
  });

  it('does not include the source document when a directed cycle returns to the source', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-bridge', 'docs/bridge.md'),
      createDocument('doc-downstream', 'docs/downstream.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-source-bridge',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-bridge',
        relationType: RELATION_TYPES.CONTAINS,
        confidence: 0.9,
      }),
      createRelation({
        id: 'rel-bridge-source',
        sourceDocId: 'doc-bridge',
        targetDocId: 'doc-source',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.9,
      }),
      createRelation({
        id: 'rel-bridge-downstream',
        sourceDocId: 'doc-bridge',
        targetDocId: 'doc-downstream',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result.impactedDocs.map((item) => item.docPath)).toEqual([
      'docs/downstream.md',
      'docs/bridge.md',
    ]);
    expect(result.totalCount).toBe(2);
  });

  it('does not report upstream documents reached only through incoming relations', () => {
    const documents = [
      createDocument('doc-upstream', 'docs/upstream.md'),
      createDocument('doc-source', 'docs/source.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-upstream-source',
        sourceDocId: 'doc-upstream',
        targetDocId: 'doc-source',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result).toEqual({ impactedDocs: [], totalCount: 0 });
  });

  it('does not expand through low-confidence relations that fail the threshold', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-bridge', 'docs/bridge.md'),
      createDocument('doc-downstream', 'docs/downstream.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-source-bridge',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-bridge',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.49,
      }),
      createRelation({
        id: 'rel-bridge-downstream',
        sourceDocId: 'doc-bridge',
        targetDocId: 'doc-downstream',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result).toEqual({ impactedDocs: [], totalCount: 0 });
  });

  it('deduplicates impacted docs and keeps the strongest hit for the same document', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-bridge', 'docs/bridge.md'),
      createDocument('doc-target', 'docs/target.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-source-target-info',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-target',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.71,
      }),
      createRelation({
        id: 'rel-source-bridge',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-bridge',
        relationType: RELATION_TYPES.CONTAINS,
        confidence: 0.9,
      }),
      createRelation({
        id: 'rel-bridge-target-critical',
        sourceDocId: 'doc-bridge',
        targetDocId: 'doc-target',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result.totalCount).toBe(2);
    expect(result.impactedDocs.map((item) => item.docPath)).toEqual([
      'docs/target.md',
      'docs/bridge.md',
    ]);
    expect(result.impactedDocs[0]).toMatchObject({
      docPath: 'docs/target.md',
      relationType: RELATION_TYPES.SYNC_REQUIRED,
      propagationType: RELATION_TYPES.SYNC_REQUIRED,
      suggestedAction: '需要同步更新',
      severity: 'critical',
      hopDistance: 2,
      confidence: 0.95,
    });
  });

  it('returns impacted docs sorted by severity and excludes fourth-hop nodes', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-sync', 'docs/sync.md'),
      createDocument('doc-context', 'docs/context.md'),
      createDocument('doc-consistent', 'docs/consistent.md'),
      createDocument('doc-fourth', 'docs/fourth-hop.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-sync',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-sync',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      }),
      createRelation({
        id: 'rel-context',
        sourceDocId: 'doc-sync',
        targetDocId: 'doc-context',
        relationType: RELATION_TYPES.CONTEXT_FOR,
        confidence: 0.88,
      }),
      createRelation({
        id: 'rel-consistent',
        sourceDocId: 'doc-context',
        targetDocId: 'doc-consistent',
        relationType: RELATION_TYPES.MUST_CONSISTENT,
        confidence: 0.9,
      }),
      createRelation({
        id: 'rel-fourth',
        sourceDocId: 'doc-consistent',
        targetDocId: 'doc-fourth',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.92,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result.totalCount).toBe(3);
    expect(result.impactedDocs.map((item) => item.docPath)).toEqual([
      'docs/sync.md',
      'docs/consistent.md',
      'docs/context.md',
    ]);
    expect(result.impactedDocs.map((item) => item.hopDistance)).toEqual([1, 3, 2]);
    expect(result.impactedDocs.map((item) => item.suggestedAction)).toEqual([
      '需要同步更新',
      '必须保持一致',
      '仅供参考',
    ]);
  });

  it('filters deprecated-status relations and low-confidence relations by default', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-low', 'docs/low-confidence.md'),
      createDocument('doc-deprecated-status', 'docs/deprecated-status.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-low',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-low',
        relationType: RELATION_TYPES.DERIVED_FROM,
        confidence: 0.49,
      }),
      createRelation({
        id: 'rel-deprecated-status',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-deprecated-status',
        relationType: RELATION_TYPES.SYNC_SUGGESTED,
        confidence: 0.95,
        status: 'deprecated',
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result).toEqual({ impactedDocs: [], totalCount: 0 });
  });

  it('applies confidence threshold precedence: explicit input overrides configured default', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-lifecycle', 'docs/lifecycle.md'),
      createDocument('doc-reference', 'docs/reference.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-lifecycle',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-lifecycle',
        relationType: RELATION_TYPES.LIFECYCLE_BOUND,
        confidence: 0.75,
      }),
      createRelation({
        id: 'rel-reference',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-reference',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.85,
      }),
    ];
    const service = createService({
      documents,
      relations,
      defaultConfidenceThreshold: 0.8,
    });

    expect(service.analyzeImpact({ docPath: 'docs/source.md' }).impactedDocs.map((item) => item.docPath)).toEqual([
      'docs/reference.md',
    ]);
    expect(service.analyzeImpact({ docPath: 'docs/source.md', confidenceThreshold: 0.7 }).impactedDocs.map((item) => item.docPath)).toEqual([
      'docs/lifecycle.md',
      'docs/reference.md',
    ]);
  });

  it('uses the built-in 0.50 threshold when no configured default is provided', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      createDocument('doc-default', 'docs/default-threshold.md'),
    ];
    const relations = [
      createRelation({
        id: 'rel-default',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-default',
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.55,
      }),
    ];
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });

    expect(result.totalCount).toBe(1);
    expect(result.impactedDocs[0]?.docPath).toBe('docs/default-threshold.md');
  });

  it('resolves updateStrategy from configured docType and falls back to suggest', () => {
    const documents = [
      createDocument('doc-source', 'docs/source.md', 'story'),
      createDocument('doc-prd', 'docs/prd.md', 'prd'),
      createDocument('doc-architecture', 'docs/architecture.md', 'architecture'),
      createDocument('doc-research', 'docs/research.md', 'technical-research'),
      {
        ...createDocument('doc-untyped', 'docs/untyped.md'),
        docType: undefined,
      },
    ];
    const relations = [
      createRelation({
        id: 'rel-prd',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-prd',
        relationType: RELATION_TYPES.REFERENCES,
      }),
      createRelation({
        id: 'rel-architecture',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-architecture',
        relationType: RELATION_TYPES.REFERENCES,
      }),
      createRelation({
        id: 'rel-research',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-research',
        relationType: RELATION_TYPES.REFERENCES,
      }),
      createRelation({
        id: 'rel-untyped',
        sourceDocId: 'doc-source',
        targetDocId: 'doc-untyped',
        relationType: RELATION_TYPES.REFERENCES,
      }),
    ];
    const service = createService({
      documents,
      relations,
      updateStrategies: {
        prd: 'auto',
        architecture: 'log_only',
      },
    });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });
    const strategiesByPath = new Map(result.impactedDocs.map((item) => [item.docPath, item.updateStrategy]));

    expect(strategiesByPath.get('docs/prd.md')).toBe('auto');
    expect(strategiesByPath.get('docs/architecture.md')).toBe('log_only');
    expect(strategiesByPath.get('docs/research.md')).toBe('suggest');
    expect(strategiesByPath.get('docs/untyped.md')).toBe('suggest');
  });

  it('maps each propagation type to the expected suggestion and severity', () => {
    const relationTypes = [
      RELATION_TYPES.SYNC_REQUIRED,
      RELATION_TYPES.MUST_CONSISTENT,
      RELATION_TYPES.LIFECYCLE_BOUND,
      RELATION_TYPES.CONTAINS,
      RELATION_TYPES.SYNC_SUGGESTED,
      RELATION_TYPES.DERIVED_FROM,
      RELATION_TYPES.CONTEXT_FOR,
      RELATION_TYPES.REFERENCES,
      RELATION_TYPES.DEPRECATED,
    ] as const;
    const documents = [
      createDocument('doc-source', 'docs/source.md'),
      ...relationTypes.map((relationType) => createDocument(`doc-${relationType}`, `docs/${relationType}.md`)),
    ];
    const relations = relationTypes.map((relationType) => createRelation({
      id: `rel-${relationType}`,
      sourceDocId: 'doc-source',
      targetDocId: `doc-${relationType}`,
      relationType,
      confidence: 0.9,
    }));
    const service = createService({ documents, relations });

    const result = service.analyzeImpact({ docPath: 'docs/source.md' });
    const byPropagationType = new Map(result.impactedDocs.map((item) => [item.propagationType, item]));

    expect(result.totalCount).toBe(relationTypes.length);
    expect(byPropagationType.get(RELATION_TYPES.SYNC_REQUIRED)).toMatchObject({
      suggestedAction: '需要同步更新',
      severity: 'critical',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.MUST_CONSISTENT)).toMatchObject({
      suggestedAction: '必须保持一致',
      severity: 'critical',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.LIFECYCLE_BOUND)).toMatchObject({
      suggestedAction: '检查生命周期影响',
      severity: 'high',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.CONTAINS)).toMatchObject({
      suggestedAction: '检查包含内容',
      severity: 'medium',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.SYNC_SUGGESTED)).toMatchObject({
      suggestedAction: '建议同步更新',
      severity: 'medium',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.DERIVED_FROM)).toMatchObject({
      suggestedAction: '检查源文档变更',
      severity: 'low',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.CONTEXT_FOR)).toMatchObject({
      suggestedAction: '仅供参考',
      severity: 'info',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.REFERENCES)).toMatchObject({
      suggestedAction: '仅供参考',
      severity: 'info',
      updateStrategy: 'suggest',
    });
    expect(byPropagationType.get(RELATION_TYPES.DEPRECATED)).toMatchObject({
      suggestedAction: '已废弃，忽略',
      severity: 'none',
      updateStrategy: 'suggest',
    });
  });

  it('throws QueryError when the source document does not exist', () => {
    const service = createService({ documents: [], relations: [] });

    expect(() => service.analyzeImpact({ docPath: 'docs/missing.md' })).toThrow(QueryError);
  });
});
