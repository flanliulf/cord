import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '../../../src/utils/logger.js';

describe('Logger', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['CORD_DEBUG'];
    delete process.env['CORD_MCP_MODE'];
  });

  // -------------------------------------------------------------------------
  // CLI mode (default)
  // -------------------------------------------------------------------------

  describe('CLI mode', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ mode: 'cli' });
    });

    it('info() writes to stdout', () => {
      logger.info('hello');
      expect(stdoutWrite).toHaveBeenCalledOnce();
      const output = stdoutWrite.mock.calls[0]?.[0] as string;
      expect(output).toContain('hello');
    });

    it('warn() writes to stdout', () => {
      logger.warn('caution');
      expect(stdoutWrite).toHaveBeenCalledOnce();
      const output = stdoutWrite.mock.calls[0]?.[0] as string;
      expect(output).toContain('caution');
    });

    it('error() writes to stderr', () => {
      logger.error('boom');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
      const output = stderrWrite.mock.calls[0]?.[0] as string;
      expect(output).toContain('boom');
    });

    it('debug() is suppressed by default', () => {
      logger.debug('secret');
      expect(stdoutWrite).not.toHaveBeenCalled();
      expect(stderrWrite).not.toHaveBeenCalled();
    });

    it('debug() is shown when verbose is true', () => {
      logger.setVerbose(true);
      logger.debug('verbose info');
      expect(stdoutWrite).toHaveBeenCalledOnce();
      const output = stdoutWrite.mock.calls[0]?.[0] as string;
      expect(output).toContain('verbose info');
    });

    it('debug() is hidden again after setVerbose(false)', () => {
      logger.setVerbose(true);
      logger.setVerbose(false);
      logger.debug('silent');
      expect(stdoutWrite).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // MCP mode — all output to stderr
  // -------------------------------------------------------------------------

  describe('MCP mode', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ mode: 'mcp' });
    });

    it('info() writes to stderr in MCP mode', () => {
      logger.info('mcp info');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
      const output = stderrWrite.mock.calls[0]?.[0] as string;
      expect(output).toContain('mcp info');
    });

    it('warn() writes to stderr in MCP mode', () => {
      logger.warn('mcp warn');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
    });

    it('error() writes to stderr in MCP mode', () => {
      logger.error('mcp error');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
    });

    it('debug() suppressed by default in MCP mode', () => {
      logger.debug('hidden');
      expect(stdoutWrite).not.toHaveBeenCalled();
      expect(stderrWrite).not.toHaveBeenCalled();
    });

    it('debug() goes to stderr when verbose enabled in MCP mode', () => {
      logger.setVerbose(true);
      logger.debug('mcp debug');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // setMode() switching
  // -------------------------------------------------------------------------

  describe('setMode()', () => {
    it('can switch from cli to mcp at runtime', () => {
      const logger = new Logger({ mode: 'cli' });
      logger.setMode('mcp');
      logger.info('switched');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
    });

    it('can switch from mcp to cli at runtime', () => {
      const logger = new Logger({ mode: 'mcp' });
      logger.setMode('cli');
      logger.info('back to cli');
      expect(stdoutWrite).toHaveBeenCalledOnce();
      expect(stderrWrite).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // CORD_DEBUG env var
  // -------------------------------------------------------------------------

  describe('CORD_DEBUG environment variable', () => {
    it('enables debug output when CORD_DEBUG=1', () => {
      process.env['CORD_DEBUG'] = '1';
      const logger = new Logger({ mode: 'cli' });
      logger.debug('env debug');
      expect(stdoutWrite).toHaveBeenCalledOnce();
      const output = stdoutWrite.mock.calls[0]?.[0] as string;
      expect(output).toContain('env debug');
    });

    it('does not enable debug when CORD_DEBUG is not set', () => {
      const logger = new Logger({ mode: 'cli' });
      logger.debug('no output');
      expect(stdoutWrite).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Default mode detection via CORD_MCP_MODE
  // -------------------------------------------------------------------------

  describe('default mode detection', () => {
    it('defaults to CLI mode when CORD_MCP_MODE is not set', () => {
      const logger = new Logger();
      logger.info('default cli');
      expect(stdoutWrite).toHaveBeenCalledOnce();
    });

    it('defaults to MCP mode when CORD_MCP_MODE=1', () => {
      process.env['CORD_MCP_MODE'] = '1';
      const logger = new Logger();
      logger.info('default mcp');
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stdoutWrite).not.toHaveBeenCalled();
    });
  });
});
