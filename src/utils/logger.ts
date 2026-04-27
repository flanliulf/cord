import chalk from 'chalk';

/** Logger output mode. */
export type LogMode = 'cli' | 'mcp';

/**
 * Logger — lightweight four-level logger for CORD.
 *
 * - **CLI mode**: info/warn → stdout (chalk-coloured); error → stderr.
 * - **MCP mode**: all levels → stderr (never pollutes stdout JSON-RPC channel).
 * - debug level is suppressed unless `CORD_DEBUG=1` or `setVerbose(true)`.
 */
export class Logger {
  private mode: LogMode;
  private verbose: boolean;

  constructor(options?: { mode?: LogMode }) {
    const envMode = process.env['CORD_MCP_MODE'] === '1' ? 'mcp' : 'cli';
    this.mode = options?.mode ?? envMode;
    this.verbose = process.env['CORD_DEBUG'] === '1';
  }

  /** Enable or disable debug-level output at runtime. */
  setVerbose(enabled: boolean): void {
    this.verbose = enabled;
  }

  /** Switch the output mode at runtime. */
  setMode(mode: LogMode): void {
    this.mode = mode;
  }

  /** Emit a debug message (suppressed unless verbose/CORD_DEBUG). */
  debug(message: string): void {
    if (!this.verbose) return;
    const line = chalk.gray(`[debug] ${message}\n`);
    this.writeOut(line);
  }

  /** Emit an informational message. */
  info(message: string): void {
    const line = chalk.cyan(`[info] ${message}\n`);
    this.writeOut(line);
  }

  /** Emit a warning message. */
  warn(message: string): void {
    const line = chalk.yellow(`[warn] ${message}\n`);
    this.writeOut(line);
  }

  /** Emit an error message (always to stderr). */
  error(message: string): void {
    const line = chalk.red(`[error] ${message}\n`);
    process.stderr.write(line);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Route output to the correct stream based on mode.
   * - CLI: stdout
   * - MCP: stderr (never touch stdout — JSON-RPC channel)
   */
  private writeOut(line: string): void {
    if (this.mode === 'mcp') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }
}

/** Shared singleton logger instance. Modules should import this directly. */
export const logger = new Logger();
