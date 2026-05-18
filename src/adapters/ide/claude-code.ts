import { join } from 'node:path';
import { detectClaudeCode } from './detector.js';
import type { IIdeAdapter, SkillsArtifact } from './interfaces.js';
import {
  createNodeMcpEntry,
  ensureFileIfAbsent,
  stringifyJson,
  writeCordOwnedFile,
  writeProtectedFile,
} from './shared.js';

const CLAUDE_RULE_FILE = '.claude/rules/cord-relations.md';
const CLAUDE_SETTINGS_FILE = '.claude/settings.json';
const CLAUDE_HOOK_SCRIPT = '.claude/hooks/cord-post-edit.sh';

export class ClaudeCodeAdapter implements IIdeAdapter {
  readonly name = 'claude-code' as const;

  detect(projectRoot: string): boolean {
    return detectClaudeCode(projectRoot);
  }

  generateMcpConfig(projectRoot: string): void {
    writeProtectedFile(
      join(projectRoot, CLAUDE_SETTINGS_FILE),
      stringifyJson(buildClaudeSettings()),
    );
  }

  generateInstructionFile(projectRoot: string): void {
    writeCordOwnedFile(join(projectRoot, CLAUDE_RULE_FILE), buildClaudeRuleFile());
    ensureFileIfAbsent(join(projectRoot, 'CLAUDE.md'), buildClaudeBootstrapFile());
  }

  generateHooksConfig(projectRoot: string): void {
    writeCordOwnedFile(join(projectRoot, CLAUDE_HOOK_SCRIPT), buildClaudeHookScript(), true);
    writeProtectedFile(
      join(projectRoot, CLAUDE_SETTINGS_FILE),
      stringifyJson(buildClaudeSettings()),
    );
  }

  generateSkills(): SkillsArtifact[] {
    return [];
  }
}

function buildClaudeRuleFile(): string {
  return [
    '---',
    'paths:',
    '  - "**/*.md"',
    '  - "**/*.mdx"',
    '  - "docs/**/*"',
    '---',
    '',
    '# CORD Document Workflow',
    '',
    'Use `query_relations` before editing when related documents might be affected.',
    'Use `analyze_impact` after changing requirements, architecture, epics, stories, or other design documents.',
    'Use `sync_docs` when CORD reports drift and you need synchronized follow-up suggestions.',
    'If `.cord/cord.db` does not exist yet, run `init_graph` first.',
    '',
  ].join('\n');
}

function buildClaudeBootstrapFile(): string {
  return [
    '# CORD Bootstrap',
    '',
    '@.claude/rules/cord-relations.md',
    '',
  ].join('\n');
}

function buildClaudeHookScript(): string {
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'target_path="${1:-}"',
    'if [ -z "$target_path" ]; then',
    '  exit 0',
    'fi',
    '',
    'cord impact --json "$target_path" >/dev/null 2>/dev/null || true',
    '',
  ].join('\n');
}

function buildClaudeSettings(): Record<string, unknown> {
  return {
    mcpServers: {
      cord: createNodeMcpEntry(),
    },
    hooks: {
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          command: './.claude/hooks/cord-post-edit.sh "$TOOL_INPUT_PATH"',
        },
      ],
    },
  };
}