import type { SkillsArtifact } from './interfaces.js';

interface ClaudeSkillDefinition {
  readonly fileName: string;
  readonly name: string;
  readonly description: string;
  readonly triggerConditions: readonly string[];
  readonly toolSequence: readonly string[];
  readonly expectedOutputSchema: string;
  readonly expectedOutputNotes?: readonly string[];
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
    expectedOutputNotes: [
      'This schema preserves relation metadata such as `relationId` for each returned relation.',
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
  },
] as const;

export function generateClaudeSkills(): SkillsArtifact[] {
  return CLAUDE_SKILL_DEFINITIONS.map((skill) => ({
    targetPath: `.claude/skills/${skill.fileName}`,
    content: buildClaudeSkillFile(skill),
  }));
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
    '## MCP Tool Sequence',
    ...skill.toolSequence.map((entry, index) => `${index + 1}. ${entry}`),
    '',
    '## Expected Output Format',
    `- Named schema: ${skill.expectedOutputSchema}`,
    '- Source of truth: `src/mcp/tools/schemas.ts`',
    ...(skill.expectedOutputNotes ?? []).map((entry) => `- ${entry}`),
    '',
  ];

  return lines.join('\n');
}