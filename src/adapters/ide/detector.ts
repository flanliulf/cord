import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError } from '../../utils/index.js';
import type { IdeName } from './interfaces.js';

export const IDE_DETECTION_PRIORITY: readonly IdeName[] = [
  'claude-code',
  'cursor',
  'vscode-copilot',
  'codex-cli',
];

export function detectClaudeCode(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.claude')) || existsSync(join(projectRoot, 'CLAUDE.md'));
}

export function detectCursor(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.cursor'));
}

export function detectVscodeCopilot(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.vscode'));
}

export function detectCodexCli(projectRoot: string): boolean {
  if (!existsSync(join(projectRoot, 'AGENTS.md'))) {
    return false;
  }

  return !detectClaudeCode(projectRoot) && !detectCursor(projectRoot) && !detectVscodeCopilot(projectRoot);
}

export function collectDetectedIdes(projectRoot: string): IdeName[] {
  const matches: IdeName[] = [];

  if (detectClaudeCode(projectRoot)) {
    matches.push('claude-code');
  }

  if (detectCursor(projectRoot)) {
    matches.push('cursor');
  }

  if (detectVscodeCopilot(projectRoot)) {
    matches.push('vscode-copilot');
  }

  if (detectCodexCli(projectRoot)) {
    matches.push('codex-cli');
  }

  return matches;
}

export function resolveDetectedIde(projectRoot: string): IdeName {
  const matches = collectDetectedIdes(projectRoot);

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new ConfigError({
      message: `Multiple IDE environments were detected: ${matches.join(', ')}`,
      code: 'CORD_CONFIG_006',
      suggestion: 'Use cord init --ide <name> to choose one of: claude-code, cursor, vscode-copilot, codex-cli.',
      context: {
        error: 'AMBIGUOUS_IDE',
        detectedIdes: matches,
      },
    });
  }

  throw new ConfigError({
    message: 'No supported AI IDE markers were detected in the current project.',
    code: 'CORD_CONFIG_007',
    suggestion: 'Create one supported IDE marker directory/file first, or pass cord init --ide <name> explicitly.',
    context: {
      error: 'NO_SUPPORTED_IDE',
      projectRoot,
    },
  });
}