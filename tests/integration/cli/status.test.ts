import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import { createStatusCommand } from '../../../src/cli/commands/status.js';
import { SqliteGraphRepository } from '../../../src/repositories/index.js';
import { RELATION_TYPES } from '../../../src/types/index.js';

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

function createTempProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), 'cord-status-'));
  mkdirSync(join(projectRoot, 'docs'), { recursive: true });
  mkdirSync(join(projectRoot, '.cord'), { recursive: true });
  writeFileSync(
    join(projectRoot, 'cord.config.yaml'),
    [
      'framework: bmad',
      'scanPaths:',
      '  - docs',
      'excludePaths:',
      '  - node_modules/',
      'confidenceThreshold: 0.65',
    ].join('\n'),
    'utf-8',
  );
  return projectRoot;
}

function seedStatusGraph(projectRoot: string): void {
  const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));

  try {
    const documents = repo.transaction(() => ({
      source: repo.addDocument({ path: 'docs/source.md', title: 'source', docType: 'story', metadata: {} }),
      target: repo.addDocument({ path: 'docs/target.md', title: 'target', docType: 'story', metadata: {} }),
      orphan: repo.addDocument({ path: 'docs/orphan.md', title: 'orphan', docType: 'story', metadata: {} }),
    }));

    const relation = repo.addRelation({
      sourceDocId: documents.source.id,
      targetDocId: documents.target.id,
      relationType: RELATION_TYPES.SYNC_REQUIRED,
      confidence: 0.9,
      source: 'auto_scan',
      status: 'active',
      metadata: {},
    });

    repo.upsertSyncState({
      docId: documents.source.id,
      lastScannedAt: '2026-05-12T08:00:00.000Z',
      lastObservedMtimeMs: Date.parse('2099-01-01T00:00:00.000Z'),
      contentHash: 'hash-source',
      status: 'synced',
    });
    repo.upsertSyncState({
      docId: documents.target.id,
      lastScannedAt: '2026-05-12T09:00:00.000Z',
      lastObservedMtimeMs: Date.parse(relation.createdAt),
      contentHash: 'hash-target',
      status: 'synced',
    });
    repo.upsertSyncState({
      docId: documents.orphan.id,
      lastScannedAt: '2026-05-12T10:00:00.000Z',
      lastObservedMtimeMs: Date.parse('2026-05-12T10:00:00.000Z'),
      contentHash: 'hash-orphan',
      status: 'synced',
    });
  } finally {
    repo.close();
  }
}

async function parseStatusCommand(command: Command, args: string[]): Promise<void> {
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

describe('status integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    process.exitCode = undefined;

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('runs the real status command and returns health plus config details', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    seedStatusGraph(projectRoot);
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createStatusCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    await parseStatusCommand(command, ['status', '--json']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toEqual({
      documentCount: 3,
      relationCount: 1,
      relationsByType: {
        sync_required: 1,
      },
      lastScanTime: '2026-05-12T10:00:00.000Z',
      migrationVersion: 3,
      staleRelations: 1,
      orphanedNodes: 1,
      danglingEdges: 0,
      configFilePath: join(projectRoot, 'cord.config.yaml'),
      framework: 'bmad',
      scanPaths: ['docs'],
      excludePaths: ['node_modules/'],
      confidenceThreshold: 0.65,
    });
  });
});