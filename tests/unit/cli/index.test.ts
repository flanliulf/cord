import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { createQueryCommand, createScanCommand } from '../../../src/cli/commands/index.js';
import { applyVerboseFlag } from '../../../src/cli/verbose.js';
import { createProgram, runCli } from '../../../src/cli/index.js';
import { ConfigError } from '../../../src/utils/errors.js';
import { logger } from '../../../src/utils/index.js';

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

function createCliProgramWithScanCommand(options: {
  scan: (input: { projectRoot: string; rebuild?: boolean; force?: boolean }) => Promise<unknown>;
  stdout?: BufferingWriter;
  stderr?: BufferingWriter;
}): Command {
  const program = new Command();
  program
    .name('cord')
    .option('-v, --verbose', 'enable debug output')
    .addCommand(
      createScanCommand({
        cwd: () => '/tmp/project',
        serviceFactory: () => ({
          scan: options.scan,
        }),
        stdout: options.stdout,
        stderr: options.stderr,
      }),
    );
  return program;
}

function createCliProgramWithQueryCommand(options: {
  query: (input: { docPath: string; type?: string; includeDeprecated?: boolean }) => unknown;
  stdout?: BufferingWriter;
  stderr?: BufferingWriter;
}): Command {
  const program = new Command();
  program
    .name('cord')
    .option('-v, --verbose', 'enable debug output')
    .addCommand(
      createQueryCommand({
        serviceFactory: () => ({
          query: options.query,
        }),
        stdout: options.stdout,
        stderr: options.stderr,
      }),
    );
  return program;
}

describe('CLI verbose flag activation', () => {
  beforeEach(() => {
    // Reset verbose state before each test
    logger.setVerbose(false);
    vi.spyOn(logger, 'setVerbose');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['CORD_DEBUG'];
  });

  it('calls logger.setVerbose(true) when --verbose option is passed', () => {
    applyVerboseFlag({ verbose: true }, {});
    expect(logger.setVerbose).toHaveBeenCalledWith(true);
  });

  it('calls logger.setVerbose(true) when CORD_DEBUG=1 is set', () => {
    applyVerboseFlag({}, { CORD_DEBUG: '1' });
    expect(logger.setVerbose).toHaveBeenCalledWith(true);
  });

  it('does NOT call logger.setVerbose when neither --verbose nor CORD_DEBUG', () => {
    applyVerboseFlag({}, {});
    expect(logger.setVerbose).not.toHaveBeenCalled();
  });

  it('does NOT call logger.setVerbose when verbose is false and CORD_DEBUG is absent', () => {
    applyVerboseFlag({ verbose: false }, {});
    expect(logger.setVerbose).not.toHaveBeenCalled();
  });

  it('calls logger.setVerbose(true) when both --verbose and CORD_DEBUG=1 are set', () => {
    applyVerboseFlag({ verbose: true }, { CORD_DEBUG: '1' });
    expect(logger.setVerbose).toHaveBeenCalledWith(true);
  });
});

describe('createProgram', () => {
  it('returns a Command named cord', () => {
    const prog = createProgram();
    expect(prog.name()).toBe('cord');
  });

  it('registers the scan command', () => {
    const prog = createProgram();
    expect(prog.commands.some((command) => command.name() === 'scan')).toBe(true);
  });

  it('registers the query command', () => {
    const prog = createProgram();
    expect(prog.commands.some((command) => command.name() === 'query')).toBe(true);
  });

  it('registers the impact command', () => {
    const prog = createProgram();
    expect(prog.commands.some((command) => command.name() === 'impact')).toBe(true);
  });

  it('registers the export command', () => {
    const prog = createProgram();
    expect(prog.commands.some((command) => command.name() === 'export')).toBe(true);
  });

  it('registers the status command', () => {
    const prog = createProgram();
    expect(prog.commands.some((command) => command.name() === 'status')).toBe(true);
  });

  it('has --verbose / -v option', () => {
    const prog = createProgram();
    const hasVerbose = prog.options.some((o) => o.long === '--verbose');
    expect(hasVerbose).toBe(true);
  });

  it('returns independent instances on each call', () => {
    const prog1 = createProgram();
    const prog2 = createProgram();
    expect(prog1).not.toBe(prog2);
  });
});

describe('runCli (with injected mock program)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['CORD_DEBUG'];
    process.exitCode = undefined;
  });

  it('calls program.parseAsync with process.argv', async () => {
    const mockProgram = {
      parseAsync: vi.fn().mockResolvedValue(undefined),
      opts: vi.fn().mockReturnValue({}),
    };
    await runCli(mockProgram as never);
    expect(mockProgram.parseAsync).toHaveBeenCalledWith(process.argv);
  });

  it('activates verbose when --verbose flag is parsed', async () => {
    const mockProgram = {
      parseAsync: vi.fn().mockResolvedValue(undefined),
      opts: vi.fn().mockReturnValue({ verbose: true }),
    };
    const spy = vi.spyOn(logger, 'setVerbose');
    await runCli(mockProgram as never);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('activates verbose when CORD_DEBUG=1 is set', async () => {
    process.env['CORD_DEBUG'] = '1';
    const mockProgram = {
      parseAsync: vi.fn().mockResolvedValue(undefined),
      opts: vi.fn().mockReturnValue({}),
    };
    const spy = vi.spyOn(logger, 'setVerbose');
    await runCli(mockProgram as never);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('waits for async scan success before resolving', async () => {
    const savedArgv = process.argv.slice();
    const stdout = createWriter();
    const stderr = createWriter();
    const program = createCliProgramWithScanCommand({
      scan: vi.fn().mockResolvedValue({
        documentsFound: 2,
        relationsDiscovered: 3,
        warnings: [],
        durationMs: 20,
      }),
      stdout,
      stderr,
    });
    process.argv = ['node', 'cord', 'scan'];

    try {
      await runCli(program);
      expect(process.exitCode ?? 0).toBe(0);
      expect(stdout.read()).toContain('关系数: 3');
      expect(stderr.read()).toBe('');
    } finally {
      process.argv = savedArgv;
    }
  });

  it('waits for async scan ConfigError mapping before resolving', async () => {
    const savedArgv = process.argv.slice();
    const stdout = createWriter();
    const stderr = createWriter();
    const program = createCliProgramWithScanCommand({
      scan: vi.fn().mockRejectedValue(
        new ConfigError({
          message: '配置损坏',
          suggestion: '请检查 cord.config.yaml',
        }),
      ),
      stdout,
      stderr,
    });
    process.argv = ['node', 'cord', 'scan'];

    try {
      await runCli(program);
      expect(process.exitCode).toBe(2);
      expect(stdout.read()).toBe('');
      expect(stderr.read()).toContain('配置损坏');
    } finally {
      process.argv = savedArgv;
    }
  });

  it('waits for async scan runtime error mapping before resolving', async () => {
    const savedArgv = process.argv.slice();
    const stdout = createWriter();
    const stderr = createWriter();
    const program = createCliProgramWithScanCommand({
      scan: vi.fn().mockRejectedValue(new Error('boom')),
      stdout,
      stderr,
    });
    process.argv = ['node', 'cord', 'scan'];

    try {
      await runCli(program);
      expect(process.exitCode).toBe(1);
      expect(stdout.read()).toBe('');
      expect(stderr.read()).toContain('boom');
    } finally {
      process.argv = savedArgv;
    }
  });

  it('maps Commander parse errors to exit code 2 at the real CLI entrypoint', async () => {
    const savedArgv = process.argv.slice();
    process.argv = ['node', 'cord', 'scan', '--unknown'];
    const program = createProgram();
    program.exitOverride();
    program.configureOutput({
      writeErr: vi.fn(),
      outputError: vi.fn(),
    });

    try {
      await runCli(program);
      expect(process.exitCode).toBe(2);
    } finally {
      process.argv = savedArgv;
      process.exitCode = undefined;
    }
  });

  it('supports query command execution through the real CLI entrypoint', async () => {
    const savedArgv = process.argv.slice();
    const stdout = createWriter();
    const stderr = createWriter();
    const program = createCliProgramWithQueryCommand({
      query: vi.fn().mockReturnValue({
        relations: [
          {
            relationId: 'rel-1',
            targetPath: 'docs/target.md',
            relationType: 'references',
            confidence: 0.8,
            source: 'auto_scan',
            status: 'active',
            hopDistance: 1,
          },
        ],
        totalCount: 1,
      }),
      stdout,
      stderr,
    });
    process.argv = ['node', 'cord', 'query', 'docs/source.md'];

    try {
      await runCli(program);
      expect(process.exitCode ?? 0).toBe(0);
      expect(stdout.read()).toContain('docs/target.md');
      expect(stderr.read()).toBe('');
    } finally {
      process.argv = savedArgv;
    }
  });
});

describe('entrypoint guard — argv[1] absent regression (R4-#1)', () => {
  it('does not throw when process.argv[1] is undefined (stdin/--eval/--input-type=module scenario)', async () => {
    const savedArgv = process.argv.slice();
    process.argv = ['node']; // argv[1] absent — simulates stdin / embedded evaluator
    vi.resetModules();
    try {
      const mod = await import('../../../src/cli/index.js');
      expect(mod).toBeDefined();
    } finally {
      process.argv = savedArgv;
    }
  });
});
