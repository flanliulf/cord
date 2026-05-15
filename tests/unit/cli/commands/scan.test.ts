import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScanCommand } from '../../../../src/cli/commands/scan.js';
import { ConfigError } from '../../../../src/utils/index.js';

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

describe('createScanCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints human-readable scan summary on success', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const scan = vi.fn().mockResolvedValue({
      documentsFound: 2,
      relationsDiscovered: 3,
      warnings: ['dangling link'],
      durationMs: 120,
    });
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan,
        getManualRelationsCount: () => 0,
      }),
      stdout,
      stderr,
    });

    await parseScanCommand(command, ['scan']);

    expect(scan).toHaveBeenCalledWith({
      projectRoot: '/tmp/project',
      rebuild: false,
      force: false,
    });
    expect(stdout.read()).toContain('关系数: 3');
    expect(stdout.read()).toContain('耗时: 120ms');
    expect(stdout.read()).toContain('dangling link');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('prints JSON when --json is provided', async () => {
    const stdout = createWriter();
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan: vi.fn().mockResolvedValue({
          documentsFound: 1,
          relationsDiscovered: 1,
          warnings: [],
          durationMs: 25,
        }),
        getManualRelationsCount: () => 0,
      }),
      stdout,
      stderr: createWriter(),
    });

    await parseScanCommand(command, ['scan', '--json']);

    expect(JSON.parse(stdout.read())).toEqual({
      documentsFound: 1,
      relationsDiscovered: 1,
      warnings: [],
      durationMs: 25,
    });
  });

  it('returns exit code 2 when --force is used without --rebuild', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const serviceFactory = vi.fn();
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory,
      stdout,
      stderr,
    });

    await parseScanCommand(command, ['scan', '--force']);

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('--force 只能与 --rebuild 一起使用');
    expect(stdout.read()).toBe('');
  });

  it('returns exit code 2 for ConfigError failures', async () => {
    const stderr = createWriter();
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan: vi.fn().mockRejectedValue(
          new ConfigError({
            message: '配置无效',
            suggestion: '请检查 cord.config.yaml',
          }),
        ),
        getManualRelationsCount: () => 0,
      }),
      stdout: createWriter(),
      stderr,
    });

    await parseScanCommand(command, ['scan']);

    expect(process.exitCode).toBe(2);
    expect(stderr.read()).toContain('配置无效');
    expect(stderr.read()).toContain('请检查 cord.config.yaml');
  });

  it('returns exit code 1 for runtime failures', async () => {
    const stderr = createWriter();
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan: vi.fn().mockRejectedValue(new Error('boom')),
        getManualRelationsCount: () => 0,
      }),
      stdout: createWriter(),
      stderr,
    });

    await parseScanCommand(command, ['scan']);

    expect(process.exitCode).toBe(1);
    expect(stderr.read()).toContain('boom');
  });

  it('warns and waits for confirmation before rebuild when manual relations exist', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const scan = vi.fn().mockResolvedValue({
      documentsFound: 2,
      relationsDiscovered: 3,
      warnings: [],
      durationMs: 50,
    });
    const confirmPrompt = vi.fn().mockResolvedValue(true);
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan,
        getManualRelationsCount: () => 2,
      }),
      confirmPrompt,
      stdout,
      stderr,
    });

    await parseScanCommand(command, ['scan', '--rebuild']);

    expect(confirmPrompt).toHaveBeenCalledWith({
      message: '是否继续执行 rebuild？',
    });
    expect(scan).toHaveBeenCalledWith({
      projectRoot: '/tmp/project',
      rebuild: true,
      force: false,
    });
    expect(stdout.read()).toContain('检测到 2 条手动关系');
    expect(stdout.read()).toContain('已删除 2 条 manual 关系');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('aborts rebuild when manual relations exist and confirmation is declined', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const scan = vi.fn();
    const confirmPrompt = vi.fn().mockResolvedValue(false);
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan,
        getManualRelationsCount: () => 1,
      }),
      confirmPrompt,
      stdout,
      stderr,
    });

    await parseScanCommand(command, ['scan', '--rebuild']);

    expect(confirmPrompt).toHaveBeenCalledOnce();
    expect(scan).not.toHaveBeenCalled();
    expect(stdout.read()).toContain('检测到 1 条手动关系');
    expect(stderr.read()).toContain('已取消 rebuild');
    expect(process.exitCode).toBe(1);
  });

  it('skips confirmation and reports deleted manual relations when --force is used', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const scan = vi.fn().mockResolvedValue({
      documentsFound: 2,
      relationsDiscovered: 3,
      warnings: [],
      durationMs: 50,
    });
    const confirmPrompt = vi.fn();
    const command = createScanCommand({
      cwd: () => '/tmp/project',
      serviceFactory: () => ({
        scan,
        getManualRelationsCount: () => 3,
      }),
      confirmPrompt,
      stdout,
      stderr,
    });

    await parseScanCommand(command, ['scan', '--rebuild', '--force']);

    expect(confirmPrompt).not.toHaveBeenCalled();
    expect(scan).toHaveBeenCalledWith({
      projectRoot: '/tmp/project',
      rebuild: true,
      force: true,
    });
    expect(stdout.read()).toContain('检测到 3 条手动关系');
    expect(stdout.read()).toContain('已删除 3 条 manual 关系');
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });
});
