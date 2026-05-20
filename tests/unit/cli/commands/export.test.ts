import { Command } from 'commander';
import { win32 } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExportCommand } from '../../../../src/cli/commands/export.js';
import type { ExportInput } from '../../../../src/schemas/index.js';
import type { ExportResult } from '../../../../src/services/index.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

type ExportCommandResult = ExportResult;

interface ExportServiceLike {
  exportSnapshot(input: ExportInput): Promise<ExportCommandResult>;
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

async function parseExportCommand(command: Command, args: string[]): Promise<void> {
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

describe('createExportCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints a human-readable summary on success', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const exportSnapshot = vi.fn().mockResolvedValue({
      outputPath: '/repo/cord-snapshot.json',
      snapshot: {
        schemaVersion: '1.0',
        exportedAt: '2026-05-12T12:34:56.789Z',
        project: 'repo',
        documents: [{
          id: 'doc-1',
          path: 'docs/source.md',
          title: null,
          docType: null,
          framework: null,
          contentHash: null,
          metadata: null,
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        }],
        relations: [{
          id: 'rel-1',
          sourceDocId: 'doc-1',
          targetDocId: 'doc-2',
          relationType: 'references',
          confidence: 0.8,
          source: 'auto_scan',
          status: 'active',
          metadata: null,
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        }],
      },
    } satisfies ExportCommandResult);
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ exportSnapshot }),
      stdout,
      stderr,
    });

    await parseExportCommand(command, ['export']);

    expect(exportSnapshot).toHaveBeenCalledWith({
      projectRoot: '/repo',
      outputPath: undefined,
    });
    expect(stdout.read()).toContain('导出成功');
    expect(stdout.read()).toContain('/repo/cord-snapshot.json');
    expect(stdout.read()).toContain('文档: 1');
    expect(stdout.read()).toContain('关系: 1');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('prints JSON when --json is provided', async () => {
    const stdout = createWriter();
    const result = {
      outputPath: '/repo/snapshots/graph.json',
      snapshot: {
        schemaVersion: '1.0',
        exportedAt: '2026-05-12T12:34:56.789Z',
        project: 'repo',
        documents: [],
        relations: [],
      },
    } satisfies ExportCommandResult;
    const command = createExportCommand({
      serviceFactory: () => ({
        exportSnapshot: vi.fn().mockResolvedValue(result),
      }),
      stdout,
      stderr: createWriter(),
    });

    await parseExportCommand(command, ['export', '--json']);

    expect(JSON.parse(stdout.read())).toEqual(result);
  });

  it('forwards --output to ExportInput', async () => {
    const exportSnapshot = vi.fn().mockResolvedValue({
      outputPath: '/repo/snapshots/graph.json',
      snapshot: {
        schemaVersion: '1.0',
        exportedAt: '2026-05-12T12:34:56.789Z',
        project: 'repo',
        documents: [],
        relations: [],
      },
    } satisfies ExportCommandResult);
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ exportSnapshot }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseExportCommand(command, ['export', '--output', 'snapshots/graph.json']);

    expect(exportSnapshot).toHaveBeenCalledWith({
      projectRoot: '/repo',
      outputPath: 'snapshots/graph.json',
    });
  });

  it('normalizes ./ relative output paths before calling ExportService', async () => {
    const exportSnapshot = vi.fn().mockResolvedValue({
      outputPath: '/repo/snapshots/graph.json',
      snapshot: {
        schemaVersion: '1.0',
        exportedAt: '2026-05-12T12:34:56.789Z',
        project: 'repo',
        documents: [],
        relations: [],
      },
    } satisfies ExportCommandResult);
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ exportSnapshot }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseExportCommand(command, ['export', '--output', './snapshots/graph.json']);

    expect(exportSnapshot).toHaveBeenCalledWith({
      projectRoot: '/repo',
      outputPath: 'snapshots/graph.json',
    });
  });

  it('normalizes project-internal absolute output paths before calling ExportService', async () => {
    const exportSnapshot = vi.fn().mockResolvedValue({
      outputPath: '/repo/snapshots/graph.json',
      snapshot: {
        schemaVersion: '1.0',
        exportedAt: '2026-05-12T12:34:56.789Z',
        project: 'repo',
        documents: [],
        relations: [],
      },
    } satisfies ExportCommandResult);
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ exportSnapshot }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseExportCommand(command, ['export', '--output', '/repo/snapshots/graph.json']);

    expect(exportSnapshot).toHaveBeenCalledWith({
      projectRoot: '/repo',
      outputPath: 'snapshots/graph.json',
    });
  });

  it('returns exit code 1 and surfaces runtime errors', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createExportCommand({
      serviceFactory: () => ({
        exportSnapshot: vi.fn().mockRejectedValue(new Error('write failed')),
      }),
      stdout,
      stderr,
    });

    await parseExportCommand(command, ['export']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(stderr.read()).toContain('write failed');
  });

  it('closes the service after a successful export', async () => {
    const close = vi.fn();
    const command = createExportCommand({
      serviceFactory: () => ({
        exportSnapshot: vi.fn().mockResolvedValue({
          outputPath: '/repo/cord-snapshot.json',
          snapshot: {
            schemaVersion: '1.0',
            exportedAt: '2026-05-12T12:34:56.789Z',
            project: 'repo',
            documents: [],
            relations: [],
          },
        } satisfies ExportCommandResult),
        close,
      }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseExportCommand(command, ['export']);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the service after a failed export', async () => {
    const close = vi.fn();
    const command = createExportCommand({
      serviceFactory: () => ({
        exportSnapshot: vi.fn().mockRejectedValue(new Error('write failed')),
        close,
      }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseExportCommand(command, ['export']);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('validates blank --output before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ExportServiceLike>();
    const stderr = createWriter();
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseExportCommand(command, ['export', '--output', '   ']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('验证失败');
  });

  it('rejects project-external relative output paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ExportServiceLike>();
    const stderr = createWriter();
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseExportCommand(command, ['export', '--output', '../outside.json']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects project-external absolute output paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ExportServiceLike>();
    const stderr = createWriter();
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseExportCommand(command, ['export', '--output', '/outside.json']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects whitespace-padded project-external output paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ExportServiceLike>();
    const stderr = createWriter();
    const command = createExportCommand({
      cwd: () => '/repo',
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseExportCommand(command, ['export', '--output', ' ../outside.json ']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects win32 cross-drive absolute output paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ExportServiceLike>();
    const stderr = createWriter();
    const command = createExportCommand({
      cwd: () => 'C:\\repo',
      pathApi: win32,
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseExportCommand(command, ['export', '--output', 'D:\\outside.json']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });

  it('rejects win32 UNC absolute output paths before initializing the service', async () => {
    const serviceFactory = vi.fn<() => ExportServiceLike>();
    const stderr = createWriter();
    const command = createExportCommand({
      cwd: () => 'C:\\repo',
      pathApi: win32,
      serviceFactory,
      stdout: createWriter(),
      stderr,
    });

    await parseExportCommand(command, ['export', '--output', '\\\\server\\share\\outside.json']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('项目根目录外');
  });
});