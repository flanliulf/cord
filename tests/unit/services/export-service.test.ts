import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { rename as renameFile, writeFile as writeFileAsync } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IGraphRepository, SyncState } from '../../../src/repositories/index.js';
import { ExportService } from '../../../src/services/export-service.js';
import { RELATION_TYPES, type DocumentNode, type RelationEdge, type RelationType } from '../../../src/types/index.js';
import { ConfigError } from '../../../src/utils/index.js';

class InMemoryExportRepository implements IGraphRepository {
  private readonly documentsById: Map<string, DocumentNode>;

  private readonly documentsByPath: Map<string, DocumentNode>;

  private readonly relationsById: Map<string, RelationEdge>;

  constructor(
    private readonly documents: DocumentNode[],
    private readonly relations: RelationEdge[],
  ) {
    this.documentsById = new Map(documents.map((document) => [document.id, document]));
    this.documentsByPath = new Map(documents.map((document) => [document.path, document]));
    this.relationsById = new Map(relations.map((relation) => [relation.id, relation]));
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

  getRelationsByDocId(): RelationEdge[] {
    throw new Error('not implemented');
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
}

function createDocument(
  id: string,
  path: string,
  overrides: Partial<DocumentNode> = {},
): DocumentNode {
  return {
    id,
    path,
    createdAt: overrides.createdAt ?? '2026-05-12T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-12T00:00:00.000Z',
    title: overrides.title,
    docType: overrides.docType,
    framework: overrides.framework,
    contentHash: overrides.contentHash,
    metadata: overrides.metadata,
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

function createProjectRoot(projectName: string, roots: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'cord-export-service-'));
  const projectRoot = join(root, projectName);
  mkdirSync(projectRoot, { recursive: true });
  roots.push(root);
  return projectRoot;
}

describe('ExportService', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a JSON snapshot with schemaVersion, ISO timestamp, and null placeholders', async () => {
    const projectRoot = createProjectRoot('cord-export-project', createdRoots);
    const service = new ExportService(
      new InMemoryExportRepository(
        [
          createDocument('doc-b', 'docs/b.md', {
            title: 'Doc B',
            docType: 'story',
            framework: 'bmad',
            contentHash: 'hash-b',
            metadata: { owner: 'team-a', reviewedBy: null },
          }),
          createDocument('doc-a', 'docs/a.md'),
        ],
        [
          createRelation({
            id: 'rel-b',
            sourceDocId: 'doc-b',
            targetDocId: 'doc-a',
            relationType: RELATION_TYPES.SYNC_REQUIRED,
            confidence: 0.95,
            source: 'manual',
            metadata: { note: 'manual link' },
          }),
          createRelation({
            id: 'rel-a',
            sourceDocId: 'doc-a',
            targetDocId: 'doc-b',
            relationType: RELATION_TYPES.REFERENCES,
            metadata: undefined,
          }),
        ],
      ),
      {
        now: () => new Date('2026-05-12T12:34:56.789Z'),
      },
    );

    const result = await service.exportSnapshot({ projectRoot });

    expect(dirname(result.outputPath)).toBe(projectRoot);
    expect(existsSync(result.outputPath)).toBe(true);
    expect(result.snapshot).toEqual({
      schemaVersion: '1.0',
      exportedAt: '2026-05-12T12:34:56.789Z',
      project: 'cord-export-project',
      documents: [
        {
          id: 'doc-a',
          path: 'docs/a.md',
          title: null,
          docType: null,
          framework: null,
          contentHash: null,
          metadata: null,
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        },
        {
          id: 'doc-b',
          path: 'docs/b.md',
          title: 'Doc B',
          docType: 'story',
          framework: 'bmad',
          contentHash: 'hash-b',
          metadata: { owner: 'team-a', reviewedBy: null },
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        },
      ],
      relations: [
        {
          id: 'rel-a',
          sourceDocId: 'doc-a',
          targetDocId: 'doc-b',
          relationType: 'references',
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          metadata: null,
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        },
        {
          id: 'rel-b',
          sourceDocId: 'doc-b',
          targetDocId: 'doc-a',
          relationType: 'sync_required',
          confidence: 0.95,
          source: 'manual',
          status: 'active',
          metadata: { note: 'manual link' },
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        },
      ],
    });
    expect(JSON.parse(readFileSync(result.outputPath, 'utf-8'))).toEqual(result.snapshot);
  });

  it('prefers projectName from cord.config over the project root directory name', async () => {
    const projectRoot = createProjectRoot('directory-fallback-name', createdRoots);
    writeFileSync(
      join(projectRoot, 'cord.config.json'),
      JSON.stringify({ projectName: 'configured-project-name' }),
      'utf-8',
    );

    const service = new ExportService(new InMemoryExportRepository([], []), {
      now: () => new Date('2026-05-12T09:00:00.000Z'),
    });

    const result = await service.exportSnapshot({ projectRoot });

    expect(result.snapshot.project).toBe('configured-project-name');
  });

  it('sorts documents and relations with binary string ordering', async () => {
    const projectRoot = createProjectRoot('sort-project', createdRoots);
    const service = new ExportService(
      new InMemoryExportRepository(
        [
          createDocument('doc-lower-accent', 'docs/ä.md'),
          createDocument('doc-a-2', 'docs/a-2.md'),
          createDocument('doc-upper', 'docs/A.md'),
          createDocument('doc-a-10', 'docs/a-10.md'),
          createDocument('doc-lower', 'docs/a.md'),
        ],
        [
          createRelation({
            id: 'rel-z',
            sourceDocId: 'doc-lower',
            targetDocId: 'doc-a-2',
            relationType: RELATION_TYPES.REFERENCES,
          }),
          createRelation({
            id: 'rel-a',
            sourceDocId: 'doc-upper',
            targetDocId: 'doc-lower',
            relationType: RELATION_TYPES.SYNC_REQUIRED,
          }),
          createRelation({
            id: 'rel-b',
            sourceDocId: 'doc-upper',
            targetDocId: 'doc-lower',
            relationType: RELATION_TYPES.REFERENCES,
          }),
        ],
      ),
    );

    const result = await service.exportSnapshot({ projectRoot });

    expect(result.snapshot.documents.map((document) => document.path)).toEqual([
      'docs/A.md',
      'docs/a-10.md',
      'docs/a-2.md',
      'docs/a.md',
      'docs/ä.md',
    ]);
    expect(result.snapshot.relations.map((relation) => relation.id)).toEqual([
      'rel-z',
      'rel-b',
      'rel-a',
    ]);
  });

  it('validates projectName before reading repository data', async () => {
    const projectRoot = createProjectRoot('invalid-config-project', createdRoots);
    writeFileSync(join(projectRoot, 'cord.config.json'), JSON.stringify({ projectName: '   ' }), 'utf-8');
    const repository = new InMemoryExportRepository([], []);
    const getAllDocuments = vi.spyOn(repository, 'getAllDocuments');
    const getAllRelations = vi.spyOn(repository, 'getAllRelations');
    const service = new ExportService(repository);

    await expect(service.exportSnapshot({ projectRoot })).rejects.toBeInstanceOf(ConfigError);
    expect(getAllDocuments).not.toHaveBeenCalled();
    expect(getAllRelations).not.toHaveBeenCalled();
  });

  it('treats directory-shaped output paths as directories containing the default snapshot file', async () => {
    const projectRoot = createProjectRoot('directory-output-project', createdRoots);
    const service = new ExportService(new InMemoryExportRepository([], []));

    const result = await service.exportSnapshot({
      projectRoot,
      outputPath: 'snapshots/',
    });

    expect(result.outputPath).toBe(join(projectRoot, 'snapshots', 'cord-snapshot.json'));
    expect(existsSync(result.outputPath)).toBe(true);
  });

  it('overwrites existing snapshots through a temporary file and rename', async () => {
    const projectRoot = createProjectRoot('overwrite-project', createdRoots);
    const outputPath = join(projectRoot, 'snapshots', 'graph.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, 'old snapshot\n', 'utf-8');
    const renameSpy = vi.fn(async (oldPath: Parameters<typeof renameFile>[0], newPath: Parameters<typeof renameFile>[1]) => {
      await renameFile(oldPath, newPath);
    });
    const service = new ExportService(new InMemoryExportRepository([], []), {
      rename: renameSpy as unknown as typeof renameFile,
    });

    await service.exportSnapshot({ projectRoot, outputPath: 'snapshots/graph.json' });

    expect(renameSpy).toHaveBeenCalledTimes(1);
    expect(renameSpy.mock.calls[0]?.[0]).not.toBe(outputPath);
    expect(renameSpy.mock.calls[0]?.[1]).toBe(outputPath);
    expect(JSON.parse(readFileSync(outputPath, 'utf-8'))).toMatchObject({
      schemaVersion: '1.0',
      project: 'overwrite-project',
    });
  });

  it('preserves an existing snapshot when writing the temporary file fails', async () => {
    const projectRoot = createProjectRoot('failed-write-project', createdRoots);
    const outputPath = join(projectRoot, 'snapshots', 'graph.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, 'old snapshot\n', 'utf-8');
    const writeFileSpy = vi.fn<typeof writeFileAsync>(async () => {
      throw new Error('disk full');
    });
    const service = new ExportService(new InMemoryExportRepository([], []), {
      writeFile: writeFileSpy,
    });

    await expect(service.exportSnapshot({ projectRoot, outputPath: 'snapshots/graph.json' })).rejects.toThrow('disk full');

    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSpy.mock.calls[0]?.[0]).not.toBe(outputPath);
    expect(readFileSync(outputPath, 'utf-8')).toBe('old snapshot\n');
  });

  it('exports an empty graph and creates parent directories for custom output paths', async () => {
    const projectRoot = createProjectRoot('cord-empty-export', createdRoots);
    const service = new ExportService(new InMemoryExportRepository([], []), {
      now: () => new Date('2026-05-12T08:00:00.000Z'),
    });

    const result = await service.exportSnapshot({
      projectRoot,
      outputPath: 'snapshots/graph.json',
    });

    expect(result.snapshot).toEqual({
      schemaVersion: '1.0',
      exportedAt: '2026-05-12T08:00:00.000Z',
      project: 'cord-empty-export',
      documents: [],
      relations: [],
    });
    expect(result.outputPath).toBe(join(projectRoot, 'snapshots', 'graph.json'));
    expect(existsSync(result.outputPath)).toBe(true);
    expect(JSON.parse(readFileSync(result.outputPath, 'utf-8'))).toEqual(result.snapshot);
  });
});