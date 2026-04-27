import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { applyVerboseFlag } from './verbose.js';

/**
 * Creates and configures the CORD CLI program.
 * Exported separately so configuration can be tested without triggering
 * `program.parse()` or any Commander `process.exit` side effects.
 */
export function createProgram(): Command {
  const program = new Command();
  program
    .name('cord')
    .description('Document relationship graph engine for AI-assisted development')
    .version('0.1.0')
    .option('-v, --verbose', 'enable debug output');
  return program;
}

/**
 * Executes the CLI: parses argv and activates verbose/debug if requested.
 * Isolated in a function so that importing this module in tests does NOT
 * trigger `program.parse()` or Commander's `process.exit` calls.
 *
 * The optional `program` parameter allows tests to inject a mock Command
 * instance, avoiding process.argv side effects.
 */
export function runCli(program = createProgram()): void {
  program.parse(process.argv);
  applyVerboseFlag(program.opts() as { verbose?: boolean }, process.env);
}

// Entrypoint guard — three-step normalization:
// 1. Guard against missing argv[1] (stdin / --eval / --input-type=module scenarios)
// 2. realpathSync resolves symlinks so path matches import.meta.url's real file
// 3. pathToFileURL handles RFC 3986 percent-encoding (e.g. spaces → %20)
// Fallback: if realpathSync fails (deleted file, etc.), compare the raw URL.
const entryArg = process.argv[1];
if (entryArg) {
  let entryUrl: string;
  try {
    entryUrl = pathToFileURL(realpathSync(entryArg)).href;
  } catch {
    entryUrl = pathToFileURL(entryArg).href;
  }
  if (import.meta.url === entryUrl) {
    runCli();
  }
}
