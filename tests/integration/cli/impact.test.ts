import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import { createImpactCommand } from '../../../src/cli/commands/impact.js';
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
  const projectRoot = mkdtempSync(join(tmpdir(), 'cord-impact-'));
  mkdirSync(join(projectRoot, 'docs'), { recursive: true });
  writeFileSync(join(projectRoot, 'docs', 'source.md'), '# source\n');
  writeFileSync(join(projectRoot, 'docs', 'lifecycle.md'), '# lifecycle\n');
  writeFileSync(join(projectRoot, 'docs', 'reference.md'), '# reference\n');
  writeFileSync(join(projectRoot, 'docs', 'deprecated-status.md'), '# deprecated\n');
  mkdirSync(join(projectRoot, '.cord'), { recursive: true });
  return projectRoot;
}

function seedImpactGraph(projectRoot: string): void {
  const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));

  try {
    const documents = repo.transaction(() => ({
      source: repo.addDocument({ path: 'docs/source.md', title: 'source', docType: 'story', metadata: {} }),
      lifecycle: repo.addDocument({ path: 'docs/lifecycle.md', title: 'lifecycle', docType: 'story', metadata: {} }),
      reference: repo.addDocument({ path: 'docs/reference.md', title: 'reference', docType: 'story', metadata: {} }),
      deprecatedStatus: repo.addDocument({ path: 'docs/deprecated-status.md', title: 'deprecated', docType: 'story', metadata: {} }),
    }));

    repo.transaction(() => {
      repo.addRelation({
        sourceDocId: documents.source.id,
        targetDocId: documents.lifecycle.id,
        relationType: RELATION_TYPES.LIFECYCLE_BOUND,
        confidence: 0.75,
        source: 'auto_scan',
        status: 'active',
      });
      repo.addRelation({
        sourceDocId: documents.source.id,
        targetDocId: documents.reference.id,
        relationType: RELATION_TYPES.REFERENCES,
        confidence: 0.85,
        source: 'auto_scan',
        status: 'active',
      });
      repo.addRelation({
        sourceDocId: documents.source.id,
        targetDocId: documents.deprecatedStatus.id,
        relationType: RELATION_TYPES.SYNC_SUGGESTED,
        confidence: 0.95,
        source: 'auto_scan',
        status: 'deprecated',
      });
    });
  } finally {
    repo.close();
  }
}

async function parseImpactCommand(command: Command, args: string[]): Promise<void> {
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

describe('impact integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    process.exitCode = undefined;

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('runs the real impact command and applies configured confidenceThreshold', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    seedImpactGraph(projectRoot);
    writeFileSync(join(projectRoot, 'cord.config.yaml'), ['confidenceThreshold: 0.8', 'updateStrategies:', '  story: log_only'].join('\n'));
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md', '--json']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toEqual({
      impactedDocs: [
        {
          docPath: 'docs/reference.md',
          relationType: 'references',
          propagationType: 'references',
          suggestedAction: '仅供参考',
          updateStrategy: 'log_only',
          severity: 'info',
          confidence: 0.85,
          hopDistance: 1,
        },
      ],
      totalCount: 1,
    });
  });

  it('lets explicit --confidence-threshold override the configured default', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    seedImpactGraph(projectRoot);
    writeFileSync(join(projectRoot, 'cord.config.yaml'), ['confidenceThreshold: 0.8', 'updateStrategies:', '  story: auto'].join('\n'));
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md', '--json', '--confidence-threshold', '0.7']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toEqual({
      impactedDocs: [
        {
          docPath: 'docs/lifecycle.md',
          relationType: 'lifecycle_bound',
          propagationType: 'lifecycle_bound',
          suggestedAction: '检查生命周期影响',
          updateStrategy: 'auto',
          severity: 'high',
          confidence: 0.75,
          hopDistance: 1,
        },
        {
          docPath: 'docs/reference.md',
          relationType: 'references',
          propagationType: 'references',
          suggestedAction: '仅供参考',
          updateStrategy: 'auto',
          severity: 'info',
          confidence: 0.85,
          hopDistance: 1,
        },
      ],
      totalCount: 2,
    });
  });
});
