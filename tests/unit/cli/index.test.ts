import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyVerboseFlag } from '../../../src/cli/verbose.js';
import { createProgram, runCli } from '../../../src/cli/index.js';
import { logger } from '../../../src/utils/index.js';

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
  });

  it('calls program.parse with process.argv', () => {
    const mockProgram = {
      parse: vi.fn(),
      opts: vi.fn().mockReturnValue({}),
    };
    runCli(mockProgram as never);
    expect(mockProgram.parse).toHaveBeenCalledWith(process.argv);
  });

  it('activates verbose when --verbose flag is parsed', () => {
    const mockProgram = {
      parse: vi.fn(),
      opts: vi.fn().mockReturnValue({ verbose: true }),
    };
    const spy = vi.spyOn(logger, 'setVerbose');
    runCli(mockProgram as never);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('activates verbose when CORD_DEBUG=1 is set', () => {
    process.env['CORD_DEBUG'] = '1';
    const mockProgram = {
      parse: vi.fn(),
      opts: vi.fn().mockReturnValue({}),
    };
    const spy = vi.spyOn(logger, 'setVerbose');
    runCli(mockProgram as never);
    expect(spy).toHaveBeenCalledWith(true);
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
