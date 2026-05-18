import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitCommand } from '../../../../src/cli/commands/init.js';
import { ConfigError } from '../../../../src/utils/index.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

interface InitCommandResult {
  ide: string;
  framework: string;
  configPath: string;
  dataDirectory: string;
  generatedFiles: string[];
  generatedSkills: string[];
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

async function parseInitCommand(command: Command, args: string[]): Promise<void> {
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

describe('createInitCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('prints machine-readable JSON on success when --json is provided', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const init = vi.fn().mockResolvedValue({
      ide: 'claude-code',
      framework: 'bmad',
      configPath: '/repo/cord.config.yaml',
      dataDirectory: '/repo/.cord',
      generatedFiles: ['.claude/settings.json', 'cord.config.yaml'],
      generatedSkills: [],
    } satisfies InitCommandResult);
    const command = createInitCommand({
      cwd: () => '/repo',
      isInteractive: () => false,
      serviceFactory: () => ({ init }),
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init', '--json']);

    expect(init).toHaveBeenCalledWith({
      projectRoot: '/repo',
      ide: undefined,
      format: 'yaml',
    });
    expect(JSON.parse(stdout.read())).toEqual({
      ide: 'claude-code',
      framework: 'bmad',
      configPath: '/repo/cord.config.yaml',
      dataDirectory: '/repo/.cord',
      generatedFiles: ['.claude/settings.json', 'cord.config.yaml'],
      generatedSkills: [],
    });
    expect(stderr.read()).toBe('');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('writes structured JSON error without progress text for ambiguous IDE in non-interactive mode', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createInitCommand({
      cwd: () => '/repo',
      isInteractive: () => false,
      serviceFactory: () => ({
        init: vi.fn().mockRejectedValue(new ConfigError({
          message: 'Multiple IDE environments were detected: claude-code, cursor',
          code: 'CORD_CONFIG_006',
          suggestion: '请使用 --ide 标志显式指定 IDE',
          context: {
            error: 'AMBIGUOUS_IDE',
            candidates: ['claude-code', 'cursor'],
          },
        })),
      }),
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init', '--json']);

    expect(stdout.read()).toBe('');
    expect(JSON.parse(stderr.read())).toEqual({
      error: 'AMBIGUOUS_IDE',
      candidates: ['claude-code', 'cursor'],
      suggestion: '请使用 --ide 标志显式指定 IDE',
    });
    expect(process.exitCode).toBe(2);
  });

  it('prompts for IDE selection when multiple IDEs are detected in interactive mode', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const init = vi.fn().mockResolvedValue({
      ide: 'cursor',
      framework: 'generic',
      configPath: '/repo/cord.config.yaml',
      dataDirectory: '/repo/.cord',
      generatedFiles: ['cord.config.yaml'],
      generatedSkills: [],
    } satisfies InitCommandResult);
    const intro = vi.fn();
    const outro = vi.fn();
    const cancel = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const select = vi.fn().mockResolvedValue('cursor');
    const command = createInitCommand({
      cwd: () => '/repo',
      isInteractive: () => true,
      collectDetectedIdes: () => ['claude-code', 'cursor'],
      serviceFactory: () => ({ init }),
      promptModule: {
        intro,
        outro,
        cancel,
        isCancel: () => false,
        select,
        spinner: () => ({ start, stop }),
      },
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init']);

    expect(select).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith({
      projectRoot: '/repo',
      ide: 'cursor',
      format: 'yaml',
    });
    expect(intro).toHaveBeenCalledOnce();
    expect(outro).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
    expect(stderr.read()).toBe('');
  });

  it('uses --ide to skip interactive IDE selection when multiple IDEs are detected', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const init = vi.fn().mockResolvedValue({
      ide: 'cursor',
      framework: 'generic',
      configPath: '/repo/cord.config.yaml',
      dataDirectory: '/repo/.cord',
      generatedFiles: ['cord.config.yaml'],
      generatedSkills: [],
    } satisfies InitCommandResult);
    const select = vi.fn();
    const command = createInitCommand({
      cwd: () => '/repo',
      isInteractive: () => true,
      collectDetectedIdes: () => ['claude-code', 'cursor'],
      serviceFactory: () => ({ init }),
      promptModule: {
        intro: vi.fn(),
        outro: vi.fn(),
        cancel: vi.fn(),
        isCancel: () => false,
        select,
        spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
      },
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init', '--ide', 'cursor']);

    expect(select).not.toHaveBeenCalled();
    expect(init).toHaveBeenCalledWith({
      projectRoot: '/repo',
      ide: 'cursor',
      format: 'yaml',
    });
    expect(stderr.read()).toBe('');
  });

  it('prints non-json summary without repeating skills inside generated files', async () => {
    const stdout = createWriter();
    const stderr = createWriter();
    const init = vi.fn().mockResolvedValue({
      ide: 'claude-code',
      framework: 'bmad',
      configPath: '/repo/cord.config.yaml',
      dataDirectory: '/repo/.cord',
      generatedFiles: ['.claude/settings.json', 'cord.config.yaml'],
      generatedSkills: ['.claude/skills/cord-impact-analysis.md'],
    } satisfies InitCommandResult);
    const command = createInitCommand({
      cwd: () => '/repo',
      isInteractive: () => false,
      serviceFactory: () => ({ init }),
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init']);

    expect(stdout.read()).toBe([
      '执行初始化...',
      '✅ CORD 初始化完成',
      'IDE: claude-code',
      '框架: bmad',
      '配置文件: /repo/cord.config.yaml',
      '数据目录: /repo/.cord',
      '生成/更新文件:',
      '- .claude/settings.json',
      '- cord.config.yaml',
      'Skills 文件:',
      '- .claude/skills/cord-impact-analysis.md',
      '',
    ].join('\n'));
    expect(stderr.read()).toBe('');
  });
});