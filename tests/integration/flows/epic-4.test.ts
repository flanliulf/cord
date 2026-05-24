import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImpactCommand } from '../../../src/cli/commands/impact.js';
import { createScanCommand } from '../../../src/cli/commands/scan.js';
import {
  RELATION_TYPES,
  RelationService,
  ScanService,
  SqliteGraphRepository,
} from '../../../src/index.js';
import type { ScanResult } from '../../../src/index.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

function createWriter(): BufferingWriter {
  const chunks: string[] = [];

  return {
    write(chunk: string): boolean {
      chunks.push(chunk);
      return true;
    },
    read(): string {
      return chunks.join('');
    },
  };
}

function createTempProject(prefix: string): string {
  const projectRoot = mkdtempSync(join(tmpdir(), `cord-${prefix}-`));
  mkdirSync(join(projectRoot, 'docs'), { recursive: true });
  mkdirSync(join(projectRoot, '.cord'), { recursive: true });
  return projectRoot;
}

function writeGenericConfig(projectRoot: string): void {
  writeFileSync(
    join(projectRoot, 'cord.config.yaml'),
    ['framework: generic', 'scanPaths:', '  - docs'].join('\n'),
  );
}

async function parseCommand(command: Command, args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  try {
    await program.parseAsync(['node', 'cord', ...args]);
  } catch (error) {
    const commanderError = error as { code?: string };

    if (commanderError.code !== 'commander.executeSubCommandAsync') {
      throw error;
    }
  }
}

describe('Epic 4 end-to-end relation management and convergence', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  describe('Story 4.1 RelationService manual add, deprecate, and remove', () => {
    it('persists manual relation lifecycle with status and history in SQLite', () => {
      const repo = new SqliteGraphRepository(':memory:');
      repo.addDocument({ path: 'docs/source.md', title: 'Source', docType: 'story', metadata: {} });
      repo.addDocument({ path: 'docs/target.md', title: 'Target', docType: 'story', metadata: {} });
      const service = new RelationService(repo);

      const created = service.addRelation({
        sourcePath: 'docs/source.md',
        targetPath: 'docs/target.md',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
      });
      const deprecated = service.deprecateRelation({ relationId: created.id });

      expect(created).toMatchObject({
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        source: 'manual',
        status: 'active',
        confidence: 1,
      });
      expect(deprecated).toMatchObject({
        id: created.id,
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        source: 'manual',
        status: 'deprecated',
      });
      expect(deprecated.metadata).toMatchObject({
        history: [
          expect.objectContaining({
            action: 'deprecated',
            previousStatus: 'active',
            nextStatus: 'deprecated',
          }),
        ],
      });

      service.removeRelation({ relationId: created.id });
      expect(repo.getRelationById(created.id)).toBeNull();

      service.close();
    });
  });

  describe('Story 4.2 convergence protection and source priority', () => {
    it('keeps manual and manual-deprecated outgoing relations across incremental scan', async () => {
      const projectRoot = createTempProject('epic-4-convergence');
      createdRoots.push(projectRoot);
      writeGenericConfig(projectRoot);
      writeFileSync(join(projectRoot, 'docs', 'source.md'), '# Source\n\nSee [Target](./target.md).\n');
      writeFileSync(join(projectRoot, 'docs', 'target.md'), '# Target\n');
      const repo = new SqliteGraphRepository(':memory:');
      const scanService = new ScanService(repo);

      await scanService.scan({ projectRoot, rebuild: true, force: true });
      const relationService = new RelationService(repo);
      const manualRelation = relationService.addRelation({
        sourcePath: 'docs/source.md',
        targetPath: 'docs/target.md',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
      });
      const autoReference = repo.getAllRelations().find((relation) => (
        relation.relationType === RELATION_TYPES.REFERENCES
        && relation.source === 'auto_scan'
      ));

      expect(autoReference).toBeDefined();
      const deprecatedAuto = relationService.deprecateRelation({ relationId: autoReference?.id ?? '' });
      writeFileSync(
        join(projectRoot, 'docs', 'source.md'),
        '# Source changed\n\nSee [Target](./target.md).\n',
      );

      await scanService.scan({ projectRoot });

      expect(repo.getRelationById(manualRelation.id)).toMatchObject({
        source: 'manual',
        status: 'active',
        relationType: RELATION_TYPES.SYNC_REQUIRED,
      });
      expect(repo.getRelationById(deprecatedAuto.id)).toMatchObject({
        source: 'manual',
        status: 'deprecated',
        relationType: RELATION_TYPES.REFERENCES,
      });

      scanService.close();
    });

    it('warns about manual relation deletion during forced rebuild without confirmation', async () => {
      const stdout = createWriter();
      const stderr = createWriter();
      const confirmPrompt = vi.fn(async () => true);
      const fakeService = {
        async scan(): Promise<ScanResult> {
          return {
            documentsFound: 2,
            relationsDiscovered: 1,
            warnings: [],
            durationMs: 3,
          };
        },
        getManualRelationsCount(): number {
          return 2;
        },
        close(): void {},
      };
      const command = createScanCommand({
        cwd: () => '/tmp/cord-epic-4-rebuild',
        serviceFactory: () => fakeService,
        confirmPrompt,
        stdout,
        stderr,
      });

      await parseCommand(command, ['scan', '--rebuild', '--force']);

      expect(process.exitCode ?? 0).toBe(0);
      expect(confirmPrompt).not.toHaveBeenCalled();
      expect(stderr.read()).toBe('');
      expect(stdout.read()).toContain('检测到 2 条手动关系');
      expect(stdout.read()).toContain('已删除 2 条 manual 关系');
    });
  });

  describe('Story 4.3 document category update strategy config', () => {
    it('surfaces configured updateStrategies in real impact CLI JSON output', async () => {
      const projectRoot = createTempProject('epic-4-update-strategy');
      createdRoots.push(projectRoot);
      writeFileSync(
        join(projectRoot, 'cord.config.yaml'),
        [
          'confidenceThreshold: 0.5',
          'updateStrategies:',
          '  architecture: auto',
          '  story: log_only',
        ].join('\n'),
      );
      const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));
      const source = repo.addDocument({ path: 'docs/source.md', title: 'Source', docType: 'prd', metadata: {} });
      const architecture = repo.addDocument({ path: 'docs/architecture.md', title: 'Architecture', docType: 'architecture', metadata: {} });
      const story = repo.addDocument({ path: 'docs/story.md', title: 'Story', docType: 'story', metadata: {} });
      repo.addRelation({
        sourceDocId: source.id,
        targetDocId: architecture.id,
        relationType: RELATION_TYPES.SYNC_REQUIRED,
        confidence: 0.95,
        source: 'manual',
        status: 'active',
      });
      repo.addRelation({
        sourceDocId: source.id,
        targetDocId: story.id,
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.85,
        source: 'manual',
        status: 'active',
      });
      repo.close();
      const stdout = createWriter();
      const stderr = createWriter();
      const command = createImpactCommand({
        cwd: () => projectRoot,
        stdout,
        stderr,
      });

      await parseCommand(command, ['impact', 'docs/source.md', '--json']);

      expect(process.exitCode ?? 0).toBe(0);
      expect(stderr.read()).toBe('');
      expect(JSON.parse(stdout.read())).toMatchObject({
        impactedDocs: [
          expect.objectContaining({
            docPath: 'docs/architecture.md',
            updateStrategy: 'auto',
            suggestedAction: '需要同步更新',
          }),
          expect.objectContaining({
            docPath: 'docs/story.md',
            updateStrategy: 'log_only',
            suggestedAction: '仅供参考',
          }),
        ],
        totalCount: 2,
      });
    });
  });
});
