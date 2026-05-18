import { describe, expect, it } from 'vitest';
import { generateClaudeSkills } from '../../../src/adapters/ide/skills-generator.js';

describe('generateClaudeSkills', () => {
  it('generates four Claude Code skill artifacts for the supported intent scenarios', () => {
    const skills = generateClaudeSkills();

    expect(skills.map((skill) => skill.targetPath)).toEqual([
      '.claude/skills/cord-impact-analysis.md',
      '.claude/skills/cord-query-relations.md',
      '.claude/skills/cord-init-graph.md',
      '.claude/skills/cord-sync-docs.md',
    ]);
  });

  it('includes trigger conditions, tool sequence, and expected output schema in every generated skill', () => {
    for (const skill of generateClaudeSkills()) {
      expect(skill.content).toContain('## Trigger Conditions');
      expect(skill.content).toContain('## MCP Tool Sequence');
      expect(skill.content).toContain('## Expected Output Format');
      expect(skill.content).toContain('src/mcp/tools/schemas.ts');
    }
  });

  it('uses the named MCP output schemas required by the story contract', () => {
    const skillsByPath = new Map(generateClaudeSkills().map((skill) => [skill.targetPath, skill.content]));

    expect(skillsByPath.get('.claude/skills/cord-impact-analysis.md')).toContain('AnalyzeImpactResult');
    expect(skillsByPath.get('.claude/skills/cord-query-relations.md')).toContain('QueryRelationsResult');
    expect(skillsByPath.get('.claude/skills/cord-query-relations.md')).toContain('relationId');
    expect(skillsByPath.get('.claude/skills/cord-init-graph.md')).toContain('InitGraphResult');
    expect(skillsByPath.get('.claude/skills/cord-sync-docs.md')).toContain('SyncDocsResult');
    expect(skillsByPath.get('.claude/skills/cord-sync-docs.md')).toContain('call `sync_docs` once per document');
  });
});