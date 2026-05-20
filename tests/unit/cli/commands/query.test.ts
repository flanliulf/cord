import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryCommand } from '../../../../src/cli/commands/query.js';
import { SqliteGraphRepository } from '../../../../src/repositories/index.js';
import type { QueryInput } from '../../../../src/schemas/index.js';
import type { QueryRelationsOutput } from '../../../../src/services/index.js';
import { QueryError } from '../../../../src/utils/index.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

type QueryCommandResult = QueryRelationsOutput;

interface QueryServiceLike {
  query(input: QueryInput): QueryCommandResult;
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

async function parseQueryCommand(command: Command, args: string[]): Promise<void> {
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

describe('createQueryCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints a human-readable table on success', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const query = vi.fn().mockReturnValue({
      relations: [
        {
          relationId: 'rel-1',
          targetPath: 'docs/target.md',
          relationType: 'references',
          confidence: 0.92,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
      ],
      totalCount: 1,
    } satisfies QueryCommandResult);
    const command = createQueryCommand({
      serviceFactory: () => ({ query }),
      stdout,
      stderr,
    });

    await parseQueryCommand(command, ['query', 'docs/source.md']);

    expect(query).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      type: undefined,
      includeDeprecated: false,
      depth: 1,
    });
    expect(stdout.read()).toContain('relationId');
    expect(stdout.read()).toContain('docs/target.md');
    expect(stdout.read()).toContain('hopDistance');
    expect(stdout.read()).toContain('总数: 1');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('prints JSON when --json is provided', async () => {
    const stdout = createWriter();
    const command = createQueryCommand({
      serviceFactory: () => ({
        query: vi.fn().mockReturnValue({
          relations: [
            {
              relationId: 'rel-1',
              targetPath: 'docs/target.md',
              relationType: 'references',
              confidence: 0.92,
              source: 'auto_scan',
              status: 'active',
              hopDistance: 1,
            },
          ],
          totalCount: 1,
        } satisfies QueryCommandResult),
      }),
      stdout,
      stderr: createWriter(),
    });

    await parseQueryCommand(command, ['query', 'docs/source.md', '--json']);

    expect(JSON.parse(stdout.read())).toEqual({
      relations: [
        {
          relationId: 'rel-1',
          targetPath: 'docs/target.md',
          relationType: 'references',
          confidence: 0.92,
          source: 'auto_scan',
          status: 'active',
          hopDistance: 1,
        },
      ],
      totalCount: 1,
    });
  });

  it('forwards --type and --include-deprecated flags to QueryInput', async () => {
    const query = vi.fn().mockReturnValue({ relations: [], totalCount: 0 } satisfies QueryCommandResult);
    const command = createQueryCommand({
      serviceFactory: () => ({ query }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseQueryCommand(command, [
      'query',
      'docs/source.md',
      '--type',
      'sync_required',
      '--include-deprecated',
    ]);

    expect(query).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      type: 'sync_required',
      includeDeprecated: true,
      depth: 1,
    });
  });

  it('forwards --depth to QueryInput', async () => {
    const query = vi.fn().mockReturnValue({ relations: [], totalCount: 0 } satisfies QueryCommandResult);
    const command = createQueryCommand({
      serviceFactory: () => ({ query }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseQueryCommand(command, ['query', 'docs/source.md', '--depth', '3']);

    expect(query).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      type: undefined,
      includeDeprecated: false,
      depth: 3,
    });
  });

  it('returns exit code 1 and surfaces QueryError details', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createQueryCommand({
      serviceFactory: () => ({
        query: vi.fn().mockImplementation(() => {
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

    await parseQueryCommand(command, ['query', 'docs/missing.md']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(stderr.read()).toContain('CORD_QUERY_001');
    expect(stderr.read()).toContain('请先运行 cord scan 确认文档路径');
  });

  it('prints JSON error payload on stderr when --json is provided', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createQueryCommand({
      serviceFactory: () => ({
        query: vi.fn().mockImplementation(() => {
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

    await parseQueryCommand(command, ['query', 'docs/missing.md', '--json']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(JSON.parse(stderr.read())).toEqual({
      message: '[CORD_QUERY_001] 未找到文档: docs/missing.md → 请先运行 cord scan 确认文档路径',
      code: 'CORD_QUERY_001',
      suggestion: '请先运行 cord scan 确认文档路径',
    });
  });

  it('closes the service after a successful query', async () => {
    const close = vi.fn();
    const command = createQueryCommand({
      serviceFactory: () => ({
        query: vi.fn().mockReturnValue({ relations: [], totalCount: 0 } satisfies QueryCommandResult),
        close,
      }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseQueryCommand(command, ['query', 'docs/source.md']);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the service after a failed query', async () => {
    const close = vi.fn();
    const command = createQueryCommand({
      serviceFactory: () => ({
        query: vi.fn().mockImplementation(() => {
          throw new QueryError({
            message: '[CORD_QUERY_001] 未找到文档: docs/missing.md → 请先运行 cord scan 确认文档路径',
            code: 'CORD_QUERY_001',
            suggestion: '请先运行 cord scan 确认文档路径',
          });
        }),
        close,
      }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseQueryCommand(command, ['query', 'docs/missing.md']);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('validates invalid --type before initializing the default service', async () => {
    const serviceFactory = vi.fn<() => QueryServiceLike>();
    const stderr = createWriter();
    const command = createQueryCommand({
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseQueryCommand(command, ['query', 'docs/source.md', '--type', 'invalid_type']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('验证失败');
  });

  it('normalizes ./ relative paths before calling QueryService', async () => {
    const query = vi.fn().mockReturnValue({ relations: [], totalCount: 0 } satisfies QueryCommandResult);
    const command = createQueryCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ query }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseQueryCommand(command, ['query', './docs/source.md']);

    expect(query).toHaveBeenCalledWith({
      docPath: 'docs/source.md',
      type: undefined,
      includeDeprecated: false,
      depth: 1,
    });
  });

  it('rejects project-external relative paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => QueryServiceLike>();
    const stderr = createWriter();
    const command = createQueryCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseQueryCommand(command, ['query', '../outside.md']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects project-external absolute paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => QueryServiceLike>();
    const stderr = createWriter();
    const command = createQueryCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseQueryCommand(command, ['query', '/outside.md']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects whitespace-padded project-external relative paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => QueryServiceLike>();
    const stderr = createWriter();
    const command = createQueryCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseQueryCommand(command, ['query', ' ../outside.md ']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects whitespace-padded project-external absolute paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => QueryServiceLike>();
    const stderr = createWriter();
    const command = createQueryCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseQueryCommand(command, ['query', ' /outside.md ']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('default service reports uninitialized graph without creating .cord', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-query-uninitialized-'));
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createQueryCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    try {
      await parseQueryCommand(command, ['query', 'docs/source.md']);

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
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-query-empty-'));
    const dataDirectory = join(projectRoot, '.cord');
    mkdirSync(dataDirectory, { recursive: true });
    new SqliteGraphRepository(join(dataDirectory, 'cord.db')).close();
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createQueryCommand({
      cwd: () => projectRoot,
      stdout,
      stderr,
    });

    try {
      await parseQueryCommand(command, ['query', 'docs/source.md']);

      expect(process.exitCode).toBe(1);
      expect(stdout.read()).toBe('');
      expect(stderr.read()).toContain('CORD_QUERY_001');
      expect(stderr.read()).toContain('请先运行 cord scan 确认文档路径');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});