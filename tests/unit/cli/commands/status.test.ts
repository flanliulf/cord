import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStatusCommand } from '../../../../src/cli/commands/status.js';
import { ConfigError } from '../../../../src/utils/index.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

interface StatusCommandResult {
  documentCount: number;
  relationCount: number;
  relationsByType: Record<string, number>;
  lastScanTime: string | null;
  migrationVersion: number;
  staleRelations: number;
  orphanedNodes: number;
  danglingEdges: number;
  configFilePath: string | null;
  framework: string | null;
  scanPaths: string[];
  excludePaths: string[];
  confidenceThreshold: number;
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

describe('createStatusCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints a dashboard summary on success', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const getStatus = vi.fn().mockReturnValue({
      documentCount: 3,
      relationCount: 2,
      relationsByType: { references: 1, sync_required: 1 },
      lastScanTime: '2026-05-12T10:00:00.000Z',
      migrationVersion: 1,
      staleRelations: 0,
      orphanedNodes: 0,
      danglingEdges: 0,
      configFilePath: '/repo/cord.config.yaml',
      framework: 'bmad',
      scanPaths: ['docs', '_bmad-output'],
      excludePaths: ['node_modules/', 'dist/'],
      confidenceThreshold: 0.72,
    } satisfies StatusCommandResult);
    const command = createStatusCommand({
      cwd: () => '/repo',
      serviceFactory: () => ({ getStatus }),
      stdout,
      stderr,
    });

    await parseStatusCommand(command, ['status']);

    expect(getStatus).toHaveBeenCalledWith({ projectRoot: '/repo' });
    expect(stdout.read()).toContain('CORD 状态概览');
    expect(stdout.read()).toContain('文档数: 3');
    expect(stdout.read()).toContain('关系总数: 2');
    expect(stdout.read()).toContain('迁移版本: 1');
    expect(stdout.read()).toContain('references=1, sync_required=1');
    expect(stdout.read()).toContain('配置文件: /repo/cord.config.yaml');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('prints JSON when --json is provided', async () => {
    const stdout = createWriter();
    const result = {
      documentCount: 0,
      relationCount: 0,
      relationsByType: {},
      lastScanTime: null,
      migrationVersion: 1,
      staleRelations: 0,
      orphanedNodes: 0,
      danglingEdges: 0,
      configFilePath: null,
      framework: null,
      scanPaths: ['.'],
      excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
      confidenceThreshold: 0.5,
    } satisfies StatusCommandResult;
    const command = createStatusCommand({
      serviceFactory: () => ({
        getStatus: vi.fn().mockReturnValue(result),
      }),
      stdout,
      stderr: createWriter(),
    });

    await parseStatusCommand(command, ['status', '--json']);

    expect(JSON.parse(stdout.read())).toEqual(result);
  });

  it('returns exit code 2 and surfaces ConfigError details', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createStatusCommand({
      serviceFactory: () => ({
        getStatus: vi.fn().mockImplementation(() => {
          throw new ConfigError({
            message: '配置损坏',
            code: 'CORD_CONFIG_001',
            suggestion: '请检查 cord.config.yaml',
          });
        }),
      }),
      stdout,
      stderr,
    });

    await parseStatusCommand(command, ['status']);

    expect(process.exitCode).toBe(2);
    expect(stdout.read()).toBe('');
    expect(stderr.read()).toContain('配置损坏');
    expect(stderr.read()).toContain('请检查 cord.config.yaml');
  });

  it('prints JSON error payload on stderr when --json is provided', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createStatusCommand({
      serviceFactory: () => ({
        getStatus: vi.fn().mockImplementation(() => {
          throw new Error('status failed');
        }),
      }),
      stdout,
      stderr,
    });

    await parseStatusCommand(command, ['status', '--json']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(JSON.parse(stderr.read())).toEqual({
      message: 'status failed',
    });
  });

  it('closes the service after a successful status check', async () => {
    const close = vi.fn();
    const command = createStatusCommand({
      serviceFactory: () => ({
        getStatus: vi.fn().mockReturnValue({
          documentCount: 0,
          relationCount: 0,
          relationsByType: {},
          lastScanTime: null,
          migrationVersion: 1,
          staleRelations: 0,
          orphanedNodes: 0,
          danglingEdges: 0,
          configFilePath: null,
          framework: null,
          scanPaths: ['.'],
          excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
          confidenceThreshold: 0.5,
        } satisfies StatusCommandResult),
        close,
      }),
      stdout: createWriter(),
      stderr: createWriter(),
    });

    await parseStatusCommand(command, ['status']);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not create .cord/cord.db when status runs against an uninitialized project', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-status-command-'));

    try {
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
      expect(existsSync(join(projectRoot, '.cord'))).toBe(false);
      expect(JSON.parse(stdout.read())).toEqual({
        documentCount: 0,
        relationCount: 0,
        relationsByType: {},
        lastScanTime: null,
        migrationVersion: 0,
        staleRelations: 0,
        orphanedNodes: 0,
        danglingEdges: 0,
        configFilePath: null,
        framework: null,
        scanPaths: ['.'],
        excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
        confidenceThreshold: 0.5,
      });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('preserves successful output when close throws', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createStatusCommand({
      serviceFactory: () => ({
        getStatus: vi.fn().mockReturnValue({
          documentCount: 0,
          relationCount: 0,
          relationsByType: {},
          lastScanTime: null,
          migrationVersion: 1,
          staleRelations: 0,
          orphanedNodes: 0,
          danglingEdges: 0,
          configFilePath: null,
          framework: null,
          scanPaths: ['.'],
          excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
          confidenceThreshold: 0.5,
        } satisfies StatusCommandResult),
        close: vi.fn().mockImplementation(() => {
          throw new Error('close failed');
        }),
      }),
      stdout,
      stderr,
    });

    await parseStatusCommand(command, ['status', '--json']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toEqual({
      documentCount: 0,
      relationCount: 0,
      relationsByType: {},
      lastScanTime: null,
      migrationVersion: 1,
      staleRelations: 0,
      orphanedNodes: 0,
      danglingEdges: 0,
      configFilePath: null,
      framework: null,
      scanPaths: ['.'],
      excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
      confidenceThreshold: 0.5,
    });
  });

  it('preserves the original failure when close also throws', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createStatusCommand({
      serviceFactory: () => ({
        getStatus: vi.fn().mockImplementation(() => {
          throw new Error('status failed');
        }),
        close: vi.fn().mockImplementation(() => {
          throw new Error('close failed');
        }),
      }),
      stdout,
      stderr,
    });

    await parseStatusCommand(command, ['status', '--json']);

    expect(process.exitCode).toBe(1);
    expect(stdout.read()).toBe('');
    expect(JSON.parse(stderr.read())).toEqual({
      message: 'status failed',
    });
  });
});