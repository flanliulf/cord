import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImpactCommand } from '../../../../src/cli/commands/impact.js';
import { SqliteGraphRepository } from '../../../../src/repositories/index.js';
import type { ImpactInput } from '../../../../src/schemas/index.js';
import type { ImpactResult } from '../../../../src/services/index.js';
import { QueryError } from '../../../../src/utils/index.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

type ImpactCommandResult = ImpactResult;

interface ImpactServiceLike {
  analyzeImpact(input: ImpactInput): ImpactCommandResult;
  close?(): void;
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

describe('createImpactCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints a human-readable table on success', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const analyzeImpact = vi.fn().mockReturnValue({
      impactedDocs: [
        {
          docPath: 'docs/target.md',
          relationType: 'sync_required',
          propagationType: 'sync_required',
          suggestedAction: '需要同步更新',
          updateStrategy: 'auto',
          severity: 'critical',
          confidence: 0.92,
          hopDistance: 1,
        },
      ],
      totalCount: 1,
    } satisfies ImpactCommandResult);
    const command = createImpactCommand({
      serviceFactory: () => ({ analyzeImpact }),
      stdout,
      stderr,
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md']);

    expect(analyzeImpact).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      confidenceThreshold: undefined,
    });
    expect(stdout.read()).toContain('docPath');
    expect(stdout.read()).toContain('docs/target.md');
    expect(stdout.read()).toContain('需要同步更新');
    expect(stdout.read()).toContain('auto');
    expect(stdout.read()).toContain('总数: 1');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('prints JSON when --json is provided', async () => {
    const stdout = createWriter();
    const command = createImpactCommand({
      serviceFactory: () => ({
        analyzeImpact: vi.fn().mockReturnValue({
          impactedDocs: [
            {
              docPath: 'docs/target.md',
              relationType: 'references',
              propagationType: 'references',
              suggestedAction: '仅供参考',
              updateStrategy: 'suggest',
              severity: 'info',
              confidence: 0.75,
              hopDistance: 2,
            },
          ],
          totalCount: 1,
        } satisfies ImpactCommandResult),
      }),
      stdout,
      stderr: createWriter(),
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md', '--json']);

    expect(JSON.parse(stdout.read())).toEqual({
      impactedDocs: [
        {
          docPath: 'docs/target.md',
          relationType: 'references',
          propagationType: 'references',
          suggestedAction: '仅供参考',
          updateStrategy: 'suggest',
          severity: 'info',
          confidence: 0.75,
          hopDistance: 2,
        },
      ],
      totalCount: 1,
    });
  });

  it('forwards --confidence-threshold to ImpactInput', async () => {
    const analyzeImpact = vi.fn().mockReturnValue({ impactedDocs: [], totalCount: 0 } satisfies ImpactCommandResult);
    const command = createImpactCommand({
      serviceFactory: () => ({ analyzeImpact }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md', '--confidence-threshold', '0.7']);

    expect(analyzeImpact).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      confidenceThreshold: 0.7,
    });
  });

  it('returns exit code 1 and surfaces QueryError details', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createImpactCommand({
      serviceFactory: () => ({
        analyzeImpact: vi.fn().mockImplementation(() => {
          throw new QueryError({
            message: '[CORD_QUERY_001] 未找到文档: docs/missing.md → 请先运行 cord scan 确认文档路径',
            code: 'CORD_QUERY_001',
            suggestion: '请先运行 cord scan 确认文档路径',
          });
        }),
      }),
      stdout,
      stderr,
    });

    await parseImpactCommand(command, ['impact', 'docs/missing.md']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(stderr.read()).toContain('CORD_QUERY_001');
    expect(stderr.read()).toContain('请先运行 cord scan 确认文档路径');
  });

  it('prints JSON error payload on stderr when --json is provided', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createImpactCommand({
      serviceFactory: () => ({
        analyzeImpact: vi.fn().mockImplementation(() => {
          throw new QueryError({
            message: '[CORD_QUERY_001] 未找到文档: docs/missing.md → 请先运行 cord scan 确认文档路径',
            code: 'CORD_QUERY_001',
            suggestion: '请先运行 cord scan 确认文档路径',
          });
        }),
      }),
      stdout,
      stderr,
    });

    await parseImpactCommand(command, ['impact', 'docs/missing.md', '--json']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(JSON.parse(stderr.read())).toEqual({
      message: '[CORD_QUERY_001] 未找到文档: docs/missing.md → 请先运行 cord scan 确认文档路径',
      code: 'CORD_QUERY_001',
      suggestion: '请先运行 cord scan 确认文档路径',
    });
  });

  it('closes the service after a successful impact analysis', async () => {
    const close = vi.fn();
    const command = createImpactCommand({
      serviceFactory: () => ({
        analyzeImpact: vi.fn().mockReturnValue({ impactedDocs: [], totalCount: 0 } satisfies ImpactCommandResult),
        close,
      }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md']);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('validates invalid --confidence-threshold before initializing the default service', async () => {
    const serviceFactory = vi.fn<() => ImpactServiceLike>();
    const stderr = createWriter();
    const command = createImpactCommand({
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseImpactCommand(command, ['impact', 'docs/source.md', '--confidence-threshold', '2']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('验证失败');
  });

  it('normalizes ./ relative paths before calling ImpactService', async () => {
    const analyzeImpact = vi.fn().mockReturnValue({ impactedDocs: [], totalCount: 0 } satisfies ImpactCommandResult);
    const command = createImpactCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ analyzeImpact }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseImpactCommand(command, ['impact', './docs/source.md']);

    expect(analyzeImpact).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      confidenceThreshold: undefined,
    });
  });

  it('rejects project-external relative paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ImpactServiceLike>();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseImpactCommand(command, ['impact', '../outside.md']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects whitespace-padded project-external relative paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ImpactServiceLike>();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseImpactCommand(command, ['impact', ' ../outside.md ']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects whitespace-padded project-external absolute paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ImpactServiceLike>();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseImpactCommand(command, ['impact', ' /outside.md ']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('default service reports uninitialized graph without creating .cord', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-impact-uninitialized-'));
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    try {
      await parseImpactCommand(command, ['impact', 'docs/source.md']);

      expect(process.exitCode).toBe(2);
      expect(stdout.read()).toBe('');
      expect(stderr.read()).toContain('CORD_CONFIG_011');
      expect(stderr.read()).toContain('请先运行 cord scan');
      expect(existsSync(join(projectRoot, '.cord'))).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('default service reports empty initialized graph as document-not-found', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-impact-empty-'));
    const dataDirectory = join(projectRoot, '.cord');
    mkdirSync(dataDirectory, { recursive: true });
    new SqliteGraphRepository(join(dataDirectory, 'cord.db')).close();
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createImpactCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    try {
      await parseImpactCommand(command, ['impact', 'docs/source.md']);

      expect(process.exitCode).toBe(1);
      expect(stdout.read()).toBe('');
      expect(stderr.read()).toContain('CORD_QUERY_001');
      expect(stderr.read()).toContain('请先运行 cord scan 确认文档路径');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
