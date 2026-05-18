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

interface ClaudeSkillDefinition {
  readonly fileName: string;
  readonly name: string;
  readonly description: string;
  readonly triggerConditions: readonly string[];
  readonly toolSequence: readonly string[];
  readonly expectedOutputSchema: string;
  readonly expectedOutput: readonly string[];
}

const CLAUDE_SKILL_DEFINITIONS: readonly ClaudeSkillDefinition[] = [
  {
    fileName: 'cord-impact-analysis.md',
    name: 'CORD Impact Analysis',
    description: 'Use CORD MCP tools to identify downstream document impact after a requirement or specification change.',
    triggerConditions: [
      'A PRD, architecture, epic, story, API, or design document changed.',
      'You need to identify downstream documents that may require synchronization.',
    ],
    toolSequence: [
      'If `.cord/cord.db` does not exist yet, call `init_graph` first.',
      'Call `analyze_impact` with the changed document path.',
      'If follow-up synchronization is needed, call `sync_docs` for actionable suggestions.',
    ],
    expectedOutputSchema: 'AnalyzeImpactResult',
    expectedOutput: [
      'Expected output schema: `AnalyzeImpactResult` (`src/mcp/tools/schemas.ts`).',
    ],
  },
  {
    fileName: 'cord-query-relations.md',
    name: 'CORD Query Relations',
    description: 'Use CORD MCP tools to inspect upstream and downstream document relationships before editing.',
    triggerConditions: [
      'You are about to edit a document and need its surrounding context.',
      'You need to verify relation depth, direction, or relationship types before making a change.',
    ],
    toolSequence: [
      'If `.cord/cord.db` does not exist yet, call `init_graph` first.',
      'Call `query_relations` with the target document path and the depth you need.',
      'Use the returned relation graph to decide which documents should be read or updated together.',
    ],
    expectedOutputSchema: 'QueryRelationsResult',
    expectedOutput: [
      'Expected output schema: `QueryRelationsResult` (`src/mcp/tools/schemas.ts`).',
    ],
  },
  {
    fileName: 'cord-init-graph.md',
    name: 'CORD Initialize Graph',
    description: 'Use CORD MCP tools to initialize the document graph before the first analysis or query.',
    triggerConditions: [
      'The project has not been scanned yet.',
      'A CORD tool reports that the graph or database is missing.',
    ],
    toolSequence: [
      'Call `init_graph` for the current project root.',
      'Wait for the result and confirm the graph was initialized successfully.',
      'After initialization, continue with `query_relations` or `analyze_impact` as needed.',
    ],
    expectedOutputSchema: 'InitGraphResult',
    expectedOutput: [
      'Expected output schema: `InitGraphResult` (`src/mcp/tools/schemas.ts`).',
    ],
  },
  {
    fileName: 'cord-sync-docs.md',
    name: 'CORD Sync Docs',
    description: 'Use CORD MCP tools to turn drift findings into concrete synchronization guidance.',
    triggerConditions: [
      'CORD reports drift after `analyze_impact`.',
      'You need concrete synchronization recommendations for affected documents.',
    ],
    toolSequence: [
      'Call `analyze_impact` or `query_relations` first if you still need context.',
      'Call `sync_docs` with the changed document `filePath`.',
      'If multiple documents need sync guidance, call `sync_docs` once per document.',
      'Apply the returned synchronization guidance to the affected documents.',
    ],
    expectedOutputSchema: 'SyncDocsResult',
    expectedOutput: [
      'Expected output schema: `SyncDocsResult` (`src/mcp/tools/schemas.ts`).',
    ],
  },
];

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
    return CLAUDE_SKILL_DEFINITIONS.map((skill) => ({
      targetPath: `.claude/skills/${skill.fileName}`,
      content: buildClaudeSkillFile(skill),
    }));
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

function buildClaudeSkillFile(skill: ClaudeSkillDefinition): string {
  const lines = [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    '---',
    '',
    `# ${skill.name}`,
    '',
    '## Trigger Conditions',
    ...skill.triggerConditions.map((entry) => `- ${entry}`),
    '',
    '## Tool Sequence',
    ...skill.toolSequence.map((entry, index) => `${index + 1}. ${entry}`),
    '',
    '## Expected Output',
    `- Named schema: ${skill.expectedOutputSchema}`,
    ...skill.expectedOutput.map((entry) => `- ${entry}`),
    '',
  ];

  return lines.join('\n');
}