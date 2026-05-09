import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import { createScanCommand } from '../../../src/cli/commands/scan.js';
import { SqliteGraphRepository } from '../../../src/repositories/index.js';
import { ScanService } from '../../../src/services/index.js';

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

function createTempProjectFromFixture(fixtureName: 'bmad-project' | 'generic-project'): string {
  const targetRoot = mkdtempSync(join(tmpdir(), `cord-${fixtureName}-`));
  const fixtureRoot = join(
    process.cwd(),
    'tests',
    'fixtures',
    'sample-projects',
    fixtureName,
  );
  cpSync(fixtureRoot, targetRoot, { recursive: true });
  return targetRoot;
}

async function parseScanCommand(command: Command, args: string[]): Promise<void> {
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

describe('scan integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    process.exitCode = undefined;

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('scans the BMAD fixture end-to-end and persists documents, relations, and sync states', async () => {
    const projectRoot = createTempProjectFromFixture('bmad-project');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.cord'), { recursive: true });
    const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));
    const service = new ScanService(repo);

    const result = await service.scan({ projectRoot, rebuild: true, force: true });

    expect(result.documentsFound).toBe(4);
    expect(result.relationsDiscovered).toBe(7);
    expect(repo.getDocumentCount()).toBe(4);
    expect(repo.getRelationCount()).toBe(7);
    expect(repo.getAllSyncStates()).toHaveLength(4);
    expect(new Set(repo.getAllRelations().map((relation) => relation.source))).toEqual(
      new Set(['auto_scan', 'framework_preset']),
    );
    const docsPerSecond = result.documentsFound / (Math.max(result.durationMs, 1) / 1000);
    expect(docsPerSecond).toBeGreaterThanOrEqual(4);

    service.close();
  });

  it('runs the generic fixture through the real CLI command and creates .cord/cord.db', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createScanCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    await parseScanCommand(command, ['scan', '--json']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toMatchObject({
      documentsFound: 2,
      relationsDiscovered: 2,
      warnings: [],
    });
    expect(existsSync(join(projectRoot, '.cord', 'cord.db'))).toBe(true);

    const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));
    expect(repo.getDocumentCount()).toBe(2);
    expect(repo.getRelationCount()).toBe(2);
    expect(repo.getAllSyncStates()).toHaveLength(2);
    repo.close();
  });

  it('reuses incremental mode on repeated scans and fast-returns when the project is unchanged', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.cord'), { recursive: true });
    const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));
    const service = new ScanService(repo);

    await service.scan({ projectRoot });
    const result = await service.scan({ projectRoot });

    expect(result.documentsFound).toBe(0);
    expect(result.relationsDiscovered).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.durationMs).toBeLessThan(100);
    expect(repo.getDocumentCount()).toBe(2);
    expect(repo.getRelationCount()).toBe(2);
    expect(repo.getAllSyncStates()).toHaveLength(2);

    service.close();
  });
});