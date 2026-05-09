import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IFrameworkAdapter, PresetRule } from '../../../src/adapters/framework/index.js';
import type { DocTypeDefinition } from '../../../src/adapters/framework/interfaces.js';
import type { IGraphRepository, SyncState } from '../../../src/repositories/index.js';
import type { ScanPipelineResult } from '../../../src/scanner/index.js';
import { ScanService } from '../../../src/services/scan-service.js';
import { RELATION_TYPES, type DocumentNode, type RelationEdge, type RelationType } from '../../../src/types/index.js';

class InMemoryGraphRepository implements IGraphRepository {
  private documentSequence = 0;
  private relationSequence = 0;
  readonly documents: DocumentNode[] = [];
  readonly relations: RelationEdge[] = [];
  readonly syncStates: SyncState[] = [];
  readonly operations: string[] = [];
  failOnAddRelation = false;

  addDocument(doc: Omit<DocumentNode, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode {
    this.operations.push(`addDocument:${doc.path}`);
    const now = new Date().toISOString();
    const full: DocumentNode = {
      ...doc,
      id: `doc-${++this.documentSequence}`,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.push(full);
    return full;
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

  updateDocument(id: string, updates: Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode {
    const existing = this.getDocumentById(id);

    if (existing === null) {
      throw new Error(`Document not found: ${id}`);
    }

    const updated: DocumentNode = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const index = this.documents.findIndex((document) => document.id === id);
    this.documents[index] = updated;
    return updated;
  }

  deleteDocument(id: string): void {
    const index = this.documents.findIndex((document) => document.id === id);

    if (index >= 0) {
      this.documents.splice(index, 1);
    }
  }

  deleteAllDocuments(): void {
    this.operations.push('deleteAllDocuments');
    this.documents.splice(0);
    this.relations.splice(0);
    this.syncStates.splice(0);
  }

  addRelation(rel: Omit<RelationEdge, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge {
    this.operations.push(`${rel.source}:${rel.relationType}`);

    if (this.failOnAddRelation) {
      throw new Error('forced addRelation failure');
    }

    const now = new Date().toISOString();
    const full: RelationEdge = {
      ...rel,
      id: `rel-${++this.relationSequence}`,
      createdAt: now,
      updatedAt: now,
    };
    this.relations.push(full);
    return full;
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

  updateRelation(id: string, updates: Omit<Partial<RelationEdge>, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge {
    const existing = this.getRelationById(id);

    if (existing === null) {
      throw new Error(`Relation not found: ${id}`);
    }

    const updated: RelationEdge = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const index = this.relations.findIndex((relation) => relation.id === id);
    this.relations[index] = updated;
    return updated;
  }

  deleteRelation(id: string): void {
    const index = this.relations.findIndex((relation) => relation.id === id);

    if (index >= 0) {
      this.relations.splice(index, 1);
    }
  }

  deleteRelationsByDocId(docId: string): void {
    for (let index = this.relations.length - 1; index >= 0; index -= 1) {
      const relation = this.relations[index];

      if (relation.sourceDocId === docId || relation.targetDocId === docId) {
        this.relations.splice(index, 1);
      }
    }
  }

  getAllRelations(): RelationEdge[] {
    return [...this.relations];
  }

  getSyncState(docId: string): SyncState | null {
    return this.syncStates.find((state) => state.docId === docId) ?? null;
  }

  upsertSyncState(state: SyncState): void {
    const index = this.syncStates.findIndex((current) => current.docId === state.docId);

    if (index >= 0) {
      this.syncStates[index] = state;
      return;
    }

    this.syncStates.push(state);
  }

  getAllSyncStates(): SyncState[] {
    return [...this.syncStates];
  }

  transaction<T>(fn: () => T): T {
    const snapshot = {
      documents: this.documents.map((document) => ({ ...document })),
      relations: this.relations.map((relation) => ({ ...relation })),
      syncStates: this.syncStates.map((state) => ({ ...state })),
      operations: [...this.operations],
      documentSequence: this.documentSequence,
      relationSequence: this.relationSequence,
    };

    try {
      return fn();
    } catch (error) {
      this.documents.splice(0, this.documents.length, ...snapshot.documents);
      this.relations.splice(0, this.relations.length, ...snapshot.relations);
      this.syncStates.splice(0, this.syncStates.length, ...snapshot.syncStates);
      this.operations.splice(0, this.operations.length, ...snapshot.operations);
      this.documentSequence = snapshot.documentSequence;
      this.relationSequence = snapshot.relationSequence;
      throw error;
    }
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  getRelationCount(): number {
    return this.relations.length;
  }

  close(): void {}
}

class StubFrameworkAdapter implements IFrameworkAdapter {
  readonly name = 'stub';
  readonly receivedScanPaths: string[] = [];
  readonly receivedExcludePaths: string[] = [];

  detectFramework(): boolean {
    return true;
  }

  getDocumentTypes(): DocTypeDefinition[] {
    return [
      {
        name: 'prd',
        patterns: ['**/prd.md'],
        description: 'PRD document',
      },
      {
        name: 'architecture',
        patterns: ['**/architecture.md'],
        description: 'Architecture document',
      },
    ];
  }

  getPresetRules(): PresetRule[] {
    return [
      {
        sourceDocType: 'prd',
        targetDocType: 'architecture',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
      },
    ];
  }

  getScanPaths(): string[] {
    return ['docs'];
  }

  getExcludePaths(): string[] {
    return ['ignored/'];
  }

  discoverDocuments(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[] {
    this.receivedScanPaths.splice(0, this.receivedScanPaths.length, ...scanPaths);
    this.receivedExcludePaths.splice(0, this.receivedExcludePaths.length, ...excludePaths);

    return [join(projectRoot, 'docs', 'prd.md'), join(projectRoot, 'docs', 'architecture.md')];
  }
}

class StubPipeline {
  readonly allDocPathsLog: string[][] = [];

  async process(filePath: string, allDocPaths: string[]): Promise<ScanPipelineResult | null> {
    this.allDocPathsLog.push([...allDocPaths]);

    if (filePath.endsWith('prd.md')) {
      return {
        document: {
          path: filePath,
          frontmatter: { title: 'Product Requirements' },
          links: ['./architecture.md'],
          headings: [{ depth: 1, text: 'PRD' }],
          contentHash: 'hash-prd',
        },
        relations: [
          {
            sourceDoc: filePath,
            targetDoc: filePath.replace('prd.md', 'architecture.md'),
            relationType: RELATION_TYPES.REFERENCES,
            confidence: 0.7,
            source: 'auto_scan',
            ruleName: 'link-rule',
          },
          {
            sourceDoc: filePath,
            targetDoc: filePath.replace('prd.md', 'architecture.md'),
            relationType: RELATION_TYPES.SYNC_REQUIRED,
            confidence: 0.4,
            source: 'auto_scan',
            ruleName: 'frontmatter-rule',
          },
        ],
        warnings: [],
      };
    }

    return {
      document: {
        path: filePath,
        frontmatter: {},
        links: [],
        headings: [{ depth: 1, text: 'Architecture' }],
        contentHash: 'hash-architecture',
      },
      relations: [],
      warnings: ['architecture warning'],
    };
  }

  takeWarnings(): string[] {
    return [];
  }
}

class MissingEndpointPipeline extends StubPipeline {
  override async process(filePath: string, allDocPaths: string[]): Promise<ScanPipelineResult | null> {
    this.allDocPathsLog.push([...allDocPaths]);

    if (filePath.endsWith('prd.md')) {
      return {
        document: {
          path: filePath,
          frontmatter: { title: 'Product Requirements' },
          links: [],
          headings: [{ depth: 1, text: 'PRD' }],
          contentHash: 'hash-prd',
        },
        relations: [
          {
            sourceDoc: filePath,
            targetDoc: filePath.replace('prd.md', 'missing.md'),
            relationType: RELATION_TYPES.REFERENCES,
            confidence: 0.7,
            source: 'auto_scan',
            ruleName: 'link-rule',
          },
        ],
        warnings: [],
      };
    }

    return {
      document: {
        path: filePath,
        frontmatter: {},
        links: [],
        headings: [{ depth: 1, text: 'Architecture' }],
        contentHash: 'hash-architecture',
      },
      relations: [],
      warnings: [],
    };
  }
}

function createProjectRoot(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), 'cord-scan-service-'));
  mkdirSync(join(projectRoot, 'docs'), { recursive: true });
  writeFileSync(join(projectRoot, 'docs', 'prd.md'), '# Product Requirements');
  writeFileSync(join(projectRoot, 'docs', 'architecture.md'), '# Architecture');
  return projectRoot;
}

function toProjectRelativePaths(_projectRoot: string, docs: DocumentNode[]): string[] {
  return docs.map((document) => document.path.replaceAll('\\', '/')).sort();
}

describe('ScanService', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('cold-start scans documents, classifies docType, dedupes preset relations, and writes sync state atomically', async () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);
    const repo = new InMemoryGraphRepository();
    const adapter = new StubFrameworkAdapter();
    const pipeline = new StubPipeline();
    const service = new ScanService(repo, pipeline, [adapter]);

    const result = await service.scan({ projectRoot });

    expect(result.documentsFound).toBe(2);
    expect(result.relationsDiscovered).toBe(2);
    expect(result.warnings).toEqual(['architecture warning']);
    expect(toProjectRelativePaths(projectRoot, repo.documents)).toEqual([
      'docs/architecture.md',
      'docs/prd.md',
    ]);
    expect(repo.documents.find((document) => document.path.endsWith('prd.md'))?.docType).toBe('prd');
    expect(repo.documents.find((document) => document.path.endsWith('architecture.md'))?.docType).toBe('architecture');
    expect(repo.relations.map((relation) => [relation.relationType, relation.source])).toEqual([
      [RELATION_TYPES.REFERENCES, 'auto_scan'],
      [RELATION_TYPES.SYNC_REQUIRED, 'framework_preset'],
    ]);
    expect(repo.syncStates).toHaveLength(2);
    expect(adapter.receivedScanPaths).toEqual(['.', 'docs']);
    expect(adapter.receivedExcludePaths).toEqual(['src/', 'node_modules/', '.git/', 'dist/', 'ignored/']);
    expect(pipeline.allDocPathsLog).toEqual([
      [join(projectRoot, 'docs', 'prd.md'), join(projectRoot, 'docs', 'architecture.md')],
      [join(projectRoot, 'docs', 'prd.md'), join(projectRoot, 'docs', 'architecture.md')],
    ]);
  });

  it('filters disabled relationTypes from config before persistence', async () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);
    writeFileSync(
      join(projectRoot, 'cord.config.yaml'),
      ['relationTypes:', '  references:', '    enabled: false'].join('\n'),
    );
    const repo = new InMemoryGraphRepository();
    const adapter = new StubFrameworkAdapter();
    const service = new ScanService(repo, new StubPipeline(), [adapter]);

    const result = await service.scan({ projectRoot });

    expect(result.relationsDiscovered).toBe(1);
    expect(repo.relations).toHaveLength(1);
    expect(repo.relations[0]?.relationType).toBe(RELATION_TYPES.SYNC_REQUIRED);
    expect(repo.relations[0]?.source).toBe('framework_preset');
  });

  it('skips relations with missing endpoints without aborting sync state writes', async () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);
    const repo = new InMemoryGraphRepository();
    const adapter = new StubFrameworkAdapter();
    const service = new ScanService(repo, new MissingEndpointPipeline(), [adapter]);

    const result = await service.scan({ projectRoot });

    expect(result.documentsFound).toBe(2);
    expect(result.relationsDiscovered).toBe(1);
    expect(result.warnings).toContain('跳过缺失端点关系: references /docs/prd.md -> /docs/missing.md');
    expect(repo.relations).toHaveLength(1);
    expect(repo.syncStates).toHaveLength(2);
  });

  it('executes rebuild inside the same transaction before re-inserting documents', async () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);
    const repo = new InMemoryGraphRepository();
    const service = new ScanService(repo, new StubPipeline(), [new StubFrameworkAdapter()]);

    const result = await service.scan({ projectRoot, rebuild: true, force: true });

    expect(result.documentsFound).toBe(2);
    expect(repo.operations[0]).toBe('deleteAllDocuments');
    expect(repo.documents).toHaveLength(2);
    expect(repo.relations).toHaveLength(2);
  });

  it('rolls back persisted writes when relation insertion fails inside the transaction', async () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);
    const repo = new InMemoryGraphRepository();
    repo.failOnAddRelation = true;
    const service = new ScanService(repo, new StubPipeline(), [new StubFrameworkAdapter()]);

    await expect(service.scan({ projectRoot })).rejects.toThrow('forced addRelation failure');
    expect(repo.documents).toEqual([]);
    expect(repo.relations).toEqual([]);
    expect(repo.syncStates).toEqual([]);
  });
});