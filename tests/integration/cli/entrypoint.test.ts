/**
 * Integration tests for CLI entrypoint guard — symlink regression (R3-#1).
 *
 * Verifies that `cord --help` executes correctly when the entry file is
 * reached via a symlink whose path contains spaces, which would cause the
 * naive `file://${process.argv[1]}` guard to silently fail.
 *
 * Requires `npm run build` to have been run first (needs dist/cli/index.js).
 * Tests are skipped automatically if the dist file is absent.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const DIST_CLI = fileURLToPath(new URL('../../../dist/cli/index.js', import.meta.url));

describe('CLI entrypoint guard — symlink with spaces regression (R3-#1)', () => {
  it('executes --help correctly when invoked via a symlink containing spaces in its path', () => {
    if (!existsSync(DIST_CLI)) {
      // Integration test requires a built dist; skip rather than fail when
      // the build hasn't been run yet (e.g. CI first-run without build step).
      console.warn('[SKIP] dist/cli/index.js not found — run `npm run build` first');
      return;
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'cord test '));
    const linkPath = join(tmpDir, 'cord link.js');

    try {
      symlinkSync(DIST_CLI, linkPath);
      const result = spawnSync('node', [linkPath, '--help'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(result.status).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
