import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BmadFrameworkAdapter,
  GenericFrameworkAdapter,
  RELATION_TYPES,
  ScanPipeline,
  ScanService,
  SqliteGraphRepository,
  computeEffectiveExcludePaths,
  computeEffectiveScanPaths,
  detectLifecycle,
  loadConfig,
  resolveAdapter,
} from '../../../src/index.js';

function createTempProject(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `cord-${prefix}-`));
}

function copyFixtureProject(fixtureName: 'bmad-project' | 'generic-project'): string {
  const projectRoot = createTempProject(fixtureName);
  cpSync(join(process.cwd(), 'tests', 'fixtures', 'sample-projects', fixtureName), projectRoot, {
    recursive: true,
  });
  return projectRoot;
}

function writeProjectFile(projectRoot: string, relativePath: string, content: string): string {
  const targetPath = join(projectRoot, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content);
  return targetPath;
}

describe('Epic 2 end-to-end document scanning and graph build', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  describe('Story 2.1 framework adapter interface and generic fallback', () => {
    it('discovers generic Markdown documents while honoring scan and exclude boundaries', () => {
      const projectRoot = createTempProject('epic-2-generic-adapter');
      createdRoots.push(projectRoot);
      writeProjectFile(projectRoot, 'docs/keep.md', '# Keep');
      writeProjectFile(projectRoot, 'docs/excluded/skip.md', '# Skip');
      writeProjectFile(projectRoot, 'src/skip.md', '# Skip source');
      writeProjectFile(projectRoot, 'node_modules/pkg/skip.md', '# Skip dependency');

      const adapter = new GenericFrameworkAdapter();
      const scanPaths = computeEffectiveScanPaths(['docs', 'src'], adapter.getScanPaths({ scanPaths: ['docs'] }));
      const excludePaths = computeEffectiveExcludePaths(['docs/excluded'], adapter.getExcludePaths({}));
      const discovered = adapter.discoverDocuments(projectRoot, scanPaths, excludePaths);

      expect(adapter.detectFramework()).toBe(true);
      expect(discovered.map((filePath) => filePath.replace(projectRoot, ''))).toEqual(['/docs/keep.md']);
    });
  });

  describe('Story 2.2 scan engine core pipeline and rules', () => {
    it('extracts frontmatter, links, headings, relation types, confidence, and warnings', async () => {
      const projectRoot = createTempProject('epic-2-pipeline');
      createdRoots.push(projectRoot);
      const sourcePath = writeProjectFile(
        projectRoot,
        'docs/source.md',
        `---
inputDocuments:
  - ./target.md
---
# Source

See [Target](./target.md).
`,
      );
      const targetPath = writeProjectFile(projectRoot, 'docs/target.md', '# Target');
      const textPath = writeProjectFile(projectRoot, 'docs/not-markdown.txt', 'plain text');
      const pipeline = new ScanPipeline();

      const result = await pipeline.process(sourcePath, [sourcePath, targetPath]);
      const skipped = await pipeline.process(textPath, [sourcePath, targetPath]);
      const warnings = pipeline.takeWarnings();

      expect(result?.document.frontmatter).toMatchObject({ inputDocuments: ['./target.md'] });
      expect(result?.document.links).toEqual(['./target.md']);
      expect(result?.document.headings).toEqual([{ depth: 1, text: 'Source' }]);
      expect(result?.relations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            targetDoc: targetPath,
            relationType: RELATION_TYPES.DERIVED_FROM,
            confidence: 0.95,
            source: 'auto_scan',
          }),
          expect.objectContaining({
            targetDoc: targetPath,
            relationType: RELATION_TYPES.REFERENCES,
            confidence: 0.85,
            source: 'auto_scan',
          }),
        ]),
      );
      expect(skipped).toBeNull();
      expect(warnings.some((warning) => warning.includes('跳过非 Markdown 文件'))).toBe(true);
    });
  });

  describe('Story 2.3 BMAD framework adapter module', () => {
    it('detects a BMAD project and produces framework preset relations during scan', async () => {
      const projectRoot = copyFixtureProject('bmad-project');
      createdRoots.push(projectRoot);
      const adapter = new BmadFrameworkAdapter();
      const repo = new SqliteGraphRepository(':memory:');
      const service = new ScanService(repo);

      const result = await service.scan({ projectRoot, rebuild: true, force: true });
      const documentTypes = new Set(repo.getAllDocuments().map((document) => document.docType));
      const presetRelations = repo.getAllRelations().filter((relation) => relation.source === 'framework_preset');

      expect(adapter.detectFramework(projectRoot)).toBe(true);
      expect(adapter.getDocumentTypes()).toHaveLength(16);
      expect(adapter.getPresetRules().every((rule) => rule.confidence >= 0.9)).toBe(true);
      expect(resolveAdapter(loadConfig(projectRoot), projectRoot).name).toBe('bmad');
      expect(documentTypes).toEqual(new Set(['prd', 'architecture', 'epic', 'story']));
      expect(result.documentsFound).toBe(4);
      expect(presetRelations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relationType: RELATION_TYPES.SYNC_REQUIRED,
            confidence: 0.95,
          }),
          expect.objectContaining({
            relationType: RELATION_TYPES.CONTAINS,
            confidence: 0.95,
          }),
        ]),
      );

      service.close();
    });
  });

  describe('Story 2.4 config loading and document scope', () => {
    it('loads YAML before JSON and lets configuration filter scan scope and relation types', async () => {
      const projectRoot = createTempProject('epic-2-config');
      createdRoots.push(projectRoot);
      writeProjectFile(
        projectRoot,
        'cord.config.json',
        JSON.stringify({ framework: 'bmad', scanPaths: ['wrong'] }),
      );
      writeProjectFile(
        projectRoot,
        'cord.config.yaml',
        `framework: generic
scanPaths:
  - docs
excludePaths:
  - docs/excluded
relationTypes:
  references:
    enabled: false
`,
      );
      writeProjectFile(projectRoot, 'docs/overview.md', '# Overview\n\nSee [Notes](./notes.md).');
      writeProjectFile(projectRoot, 'docs/notes.md', '# Notes');
      writeProjectFile(projectRoot, 'docs/excluded/skip.md', '# Skip');
      const repo = new SqliteGraphRepository(':memory:');
      const service = new ScanService(repo);

      const config = loadConfig(projectRoot);
      const result = await service.scan({ projectRoot, rebuild: true, force: true });

      expect(config).toMatchObject({
        framework: 'generic',
        scanPaths: ['docs'],
        excludePaths: ['docs/excluded'],
      });
      expect(repo.getAllDocuments().map((document) => document.path).sort()).toEqual([
        'docs/notes.md',
        'docs/overview.md',
      ]);
      expect(result.relationsDiscovered).toBe(0);
      expect(repo.getRelationCount()).toBe(0);

      service.close();
    });
  });

  describe('Story 2.5 ScanService cold-start scan and graph write', () => {
    it('cold-start scans a generic project and persists documents, relations, and sync states', async () => {
      const projectRoot = copyFixtureProject('generic-project');
      createdRoots.push(projectRoot);
      const repo = new SqliteGraphRepository(':memory:');
      const service = new ScanService(repo);

      const result = await service.scan({ projectRoot, rebuild: true, force: true });

      expect(result.documentsFound).toBe(2);
      expect(result.relationsDiscovered).toBe(2);
      expect(result.warnings).toEqual([]);
      expect(repo.getDocumentCount()).toBe(2);
      expect(repo.getRelationCount()).toBe(2);
      expect(repo.getAllSyncStates()).toHaveLength(2);
      expect(new Set(repo.getAllRelations().map((relation) => relation.source))).toEqual(
        new Set(['auto_scan']),
      );

      service.close();
    });
  });

  describe('Story 2.6 incremental scan and lifecycle detection', () => {
    it('classifies lifecycle changes and applies rename plus no-change fast return in ScanService', async () => {
      const directLifecycle = detectLifecycle(
        [
          { path: '/project/docs/new-name.md', mtimeMs: 20, contentHash: 'same' },
          { path: '/project/docs/modified.md', mtimeMs: 30, contentHash: 'changed' },
          { path: '/project/docs/added.md', mtimeMs: 10, contentHash: 'added' },
        ],
        [
          {
            docId: 'doc-1',
            path: '/project/docs/old-name.md',
            contentHash: 'same',
            lastObservedMtimeMs: 10,
            status: 'synced',
          },
          {
            docId: 'doc-2',
            path: '/project/docs/modified.md',
            contentHash: 'old',
            lastObservedMtimeMs: 20,
            status: 'synced',
          },
          {
            docId: 'doc-3',
            path: '/project/docs/deleted.md',
            contentHash: 'deleted',
            lastObservedMtimeMs: 10,
            status: 'synced',
          },
        ],
      );

      expect(directLifecycle.renamed).toEqual([
        expect.objectContaining({ oldPath: '/project/docs/old-name.md', newPath: '/project/docs/new-name.md' }),
      ]);
      expect(directLifecycle.modified.map((item) => item.path)).toEqual(['/project/docs/modified.md']);
      expect(directLifecycle.added.map((item) => item.path)).toEqual(['/project/docs/added.md']);
      expect(directLifecycle.deleted).toEqual([
        { path: '/project/docs/deleted.md', docId: 'doc-3' },
      ]);

      const projectRoot = copyFixtureProject('generic-project');
      createdRoots.push(projectRoot);
      const repo = new SqliteGraphRepository(':memory:');
      const service = new ScanService(repo);

      await service.scan({ projectRoot, rebuild: true, force: true });
      renameSync(join(projectRoot, 'docs', 'notes.md'), join(projectRoot, 'docs', 'renamed-notes.md'));
      const renameResult = await service.scan({ projectRoot });
      const noChangeResult = await service.scan({ projectRoot });

      expect(renameResult.documentsFound).toBe(0);
      expect(repo.getDocumentByPath('docs/notes.md')).toBeNull();
      expect(repo.getDocumentByPath('docs/renamed-notes.md')).not.toBeNull();
      expect(noChangeResult).toMatchObject({
        documentsFound: 0,
        relationsDiscovered: 0,
        warnings: [],
      });
      expect(noChangeResult.durationMs).toBeLessThan(100);

      service.close();
    });
  });
});
