import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ExportService,
  ImpactService,
  QueryError,
  QueryService,
  RELATION_TYPES,
  SqliteGraphRepository,
  StatusService,
} from '../../../src/index.js';
import type { DocumentNode, RelationEdge } from '../../../src/index.js';

interface SeededGraph {
  docs: Record<'source' | 'required' | 'context' | 'reference' | 'fourthHop' | 'lowConfidence' | 'deprecated' | 'orphan', DocumentNode>;
  relations: Record<'required' | 'context' | 'reference' | 'fourthHop' | 'lowConfidence' | 'deprecated', RelationEdge>;
}

function createTempProject(prefix: string): string {
  const projectRoot = mkdtempSync(join(tmpdir(), `cord-${prefix}-`));
  mkdirSync(join(projectRoot, 'docs'), { recursive: true });
  return projectRoot;
}

function createRepo(): SqliteGraphRepository {
  return new SqliteGraphRepository(':memory:');
}

function seedEpic3Graph(repo: SqliteGraphRepository): SeededGraph {
  const docs = repo.transaction(() => ({
    source: repo.addDocument({ path: 'docs/source.md', title: 'Source', docType: 'prd', metadata: {} }),
    required: repo.addDocument({ path: 'docs/required.md', title: 'Required', docType: 'architecture', metadata: {} }),
    context: repo.addDocument({ path: 'docs/context.md', title: 'Context', docType: 'epic', metadata: {} }),
    reference: repo.addDocument({ path: 'docs/reference.md', title: 'Reference', docType: 'story', metadata: {} }),
    fourthHop: repo.addDocument({ path: 'docs/fourth-hop.md', title: 'Fourth Hop', docType: 'story', metadata: {} }),
    lowConfidence: repo.addDocument({ path: 'docs/low-confidence.md', title: 'Low Confidence', docType: 'story', metadata: {} }),
    deprecated: repo.addDocument({ path: 'docs/deprecated.md', title: 'Deprecated', docType: 'story', metadata: {} }),
    orphan: repo.addDocument({ path: 'docs/orphan.md', title: 'Orphan', docType: 'story', metadata: {} }),
  }));

  const relations = repo.transaction(() => ({
    required: repo.addRelation({
      sourceDocId: docs.source.id,
      targetDocId: docs.required.id,
      relationType: RELATION_TYPES.SYNC_REQUIRED,
      confidence: 0.95,
      source: 'manual',
      status: 'active',
      metadata: { story: '3.1' },
    }),
    context: repo.addRelation({
      sourceDocId: docs.required.id,
      targetDocId: docs.context.id,
      relationType: RELATION_TYPES.CONTEXT_FOR,
      confidence: 0.9,
      source: 'auto_scan',
      status: 'active',
    }),
    reference: repo.addRelation({
      sourceDocId: docs.context.id,
      targetDocId: docs.reference.id,
      relationType: RELATION_TYPES.REFERENCES,
      confidence: 0.85,
      source: 'auto_scan',
      status: 'active',
    }),
    fourthHop: repo.addRelation({
      sourceDocId: docs.reference.id,
      targetDocId: docs.fourthHop.id,
      relationType: RELATION_TYPES.CONTAINS,
      confidence: 0.9,
      source: 'auto_scan',
      status: 'active',
    }),
    lowConfidence: repo.addRelation({
      sourceDocId: docs.source.id,
      targetDocId: docs.lowConfidence.id,
      relationType: RELATION_TYPES.SYNC_SUGGESTED,
      confidence: 0.4,
      source: 'auto_scan',
      status: 'active',
    }),
    deprecated: repo.addRelation({
      sourceDocId: docs.source.id,
      targetDocId: docs.deprecated.id,
      relationType: RELATION_TYPES.MUST_CONSISTENT,
      confidence: 0.99,
      source: 'manual',
      status: 'deprecated',
    }),
  }));

  const scannedAt = '2026-05-24T00:00:00.000Z';
  for (const document of Object.values(docs)) {
    repo.upsertSyncState({
      docId: document.id,
      lastScannedAt: scannedAt,
      lastObservedMtimeMs: document.id === docs.required.id
        ? Date.parse('2099-01-01T00:00:00.000Z')
        : Date.parse(scannedAt),
      contentHash: `hash-${document.id}`,
      status: 'synced',
    });
  }

  return { docs, relations };
}

describe('Epic 3 end-to-end query, impact, export, and status', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  describe('Story 3.1 QueryService one-hop and type filtering', () => {
    it('returns active one-hop relations, supports type filters, and reports missing documents', () => {
      const repo = createRepo();
      seedEpic3Graph(repo);
      const service = new QueryService(repo);

      const defaultResult = service.query({ docPath: 'docs/source.md' });
      const filteredResult = service.query({
        docPath: 'docs/source.md',
        type: RELATION_TYPES.SYNC_REQUIRED,
      });
      const withDeprecated = service.query({
        docPath: 'docs/source.md',
        includeDeprecated: true,
      });

      expect(defaultResult.relations.map((relation) => relation.targetPath).sort()).toEqual([
        'docs/low-confidence.md',
        'docs/required.md',
      ]);
      expect(defaultResult.relations.every((relation) => relation.status === 'active')).toBe(true);
      expect(filteredResult).toMatchObject({
        totalCount: 1,
        relations: [
          expect.objectContaining({
            targetPath: 'docs/required.md',
            relationType: RELATION_TYPES.SYNC_REQUIRED,
            confidence: 0.95,
            source: 'manual',
            hopDistance: 1,
          }),
        ],
      });
      expect(withDeprecated.relations.some((relation) => relation.status === 'deprecated')).toBe(true);
      expect(() => service.query({ docPath: 'docs/missing.md' })).toThrow(QueryError);

      service.close();
    });
  });

  describe('Story 3.2 multi-hop relation traversal', () => {
    it('uses BFS depth limits, hop distances, and cycle-safe traversal', () => {
      const repo = createRepo();
      seedEpic3Graph(repo);
      const service = new QueryService(repo);

      const result = service.query({ docPath: 'docs/source.md', depth: 3 });

      expect(result.relations.map((relation) => [relation.targetPath, relation.hopDistance])).toEqual([
        ['docs/required.md', 1],
        ['docs/low-confidence.md', 1],
        ['docs/context.md', 2],
        ['docs/reference.md', 3],
      ]);
      expect(result.relations.some((relation) => relation.targetPath === 'docs/fourth-hop.md')).toBe(false);

      service.close();
    });
  });

  describe('Story 3.3 ImpactService change impact analysis', () => {
    it('analyzes three-hop impact with confidence and deprecated filters plus suggested actions', () => {
      const repo = createRepo();
      seedEpic3Graph(repo);
      const service = new ImpactService(repo, {
        defaultConfidenceThreshold: 0.5,
        updateStrategies: {
          architecture: 'auto',
          epic: 'log_only',
        },
      });

      const result = service.analyzeImpact({ docPath: 'docs/source.md' });

      expect(result.impactedDocs.map((doc) => doc.docPath)).toEqual([
        'docs/required.md',
        'docs/context.md',
        'docs/reference.md',
      ]);
      expect(result.impactedDocs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            docPath: 'docs/required.md',
            propagationType: RELATION_TYPES.SYNC_REQUIRED,
            suggestedAction: '需要同步更新',
            updateStrategy: 'auto',
            severity: 'critical',
            hopDistance: 1,
          }),
          expect.objectContaining({
            docPath: 'docs/context.md',
            propagationType: RELATION_TYPES.CONTEXT_FOR,
            suggestedAction: '仅供参考',
            updateStrategy: 'log_only',
            hopDistance: 2,
          }),
        ]),
      );
      expect(result.impactedDocs.some((doc) => doc.docPath === 'docs/low-confidence.md')).toBe(false);
      expect(result.impactedDocs.some((doc) => doc.docPath === 'docs/deprecated.md')).toBe(false);
      expect(result.impactedDocs.some((doc) => doc.docPath === 'docs/fourth-hop.md')).toBe(false);

      service.close();
    });
  });

  describe('Story 3.4 JSON snapshot export', () => {
    it('exports a git-reviewable JSON snapshot with schema version and null placeholders', async () => {
      const projectRoot = createTempProject('epic-3-export');
      createdRoots.push(projectRoot);
      writeFileSync(join(projectRoot, 'cord.config.yaml'), 'projectName: Epic 3 Fixture\n');
      const repo = createRepo();
      seedEpic3Graph(repo);
      const service = new ExportService(repo, {
        now: () => new Date('2026-05-24T12:00:00.000Z'),
      });

      const result = await service.exportSnapshot({ projectRoot });
      const exported = JSON.parse(readFileSync(result.outputPath, 'utf8')) as unknown;

      expect(existsSync(join(projectRoot, 'cord-snapshot.json'))).toBe(true);
      expect(exported).toMatchObject({
        schemaVersion: '1.0',
        exportedAt: '2026-05-24T12:00:00.000Z',
        project: 'Epic 3 Fixture',
      });
      expect(result.snapshot.documents).toContainEqual(
        expect.objectContaining({
          path: 'docs/orphan.md',
          contentHash: null,
          metadata: {},
        }),
      );
      expect(result.snapshot.relations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relationType: RELATION_TYPES.SYNC_REQUIRED,
            status: 'active',
            metadata: { story: '3.1' },
          }),
        ]),
      );

      service.close();
    });
  });

  describe('Story 3.5 StatusService health check', () => {
    it('reports graph health, relation distribution, stale relations, config, and migration version', () => {
      const projectRoot = createTempProject('epic-3-status');
      createdRoots.push(projectRoot);
      writeFileSync(
        join(projectRoot, 'cord.config.yaml'),
        ['framework: generic', 'scanPaths:', '  - docs', 'confidenceThreshold: 0.75'].join('\n'),
      );
      const repo = createRepo();
      seedEpic3Graph(repo);
      const service = new StatusService(repo);

      const result = service.getStatus({ projectRoot });

      expect(result).toMatchObject({
        documentCount: 8,
        relationCount: 6,
        lastScanTime: '2026-05-24T00:00:00.000Z',
        migrationVersion: 3,
        staleRelations: 2,
        orphanedNodes: 1,
        danglingEdges: 0,
        configFilePath: join(projectRoot, 'cord.config.yaml'),
        framework: 'generic',
        scanPaths: ['docs'],
        confidenceThreshold: 0.75,
      });
      expect(result.relationsByType).toMatchObject({
        sync_required: 1,
        context_for: 1,
        references: 1,
        contains: 1,
        sync_suggested: 1,
        must_consistent: 1,
      });

      service.close();
    });
  });
});
