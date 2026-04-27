import { logger } from '../utils/index.js';

/**
 * Apply verbose / debug flag based on parsed CLI opts or environment.
 *
 * Kept in a side-effect-free module so it can be imported by tests
 * without triggering `program.parse()` (and any potential `process.exit` calls
 * that Commander emits on unknown flags or `--help`/`--version`).
 */
export function applyVerboseFlag(
  opts: { verbose?: boolean },
  env: NodeJS.ProcessEnv,
): void {
  if (opts.verbose || env['CORD_DEBUG'] === '1') {
    logger.setVerbose(true);
  }
}
