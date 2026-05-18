import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitCommand } from '../../../src/cli/commands/init.js';

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

function createWriter(): BufferingWriter {
  const chunks: string[] = [];

  return {
    write(chunk: string): boolean {
      chunks.push(chunk);
      return true;
    },
    read(): string {
      return chunks.join('');
    },
  };
}

async function parseInitCommand(command: Command, args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  try {
    await program.parseAsync(['node', 'cord', ...args]);
  } catch (error) {
    const commanderError = error as { code?: string };

    if (commanderError.code !== 'commander.executeSubCommandAsync') {
      throw error;
    }
  }
}

function createProjectRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('init integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    process.exitCode = undefined;

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('initializes a BMAD project with Claude Code defaults', async () => {
    const projectRoot = createProjectRoot('cord-init-bmad-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    mkdirSync(join(projectRoot, '_bmad'), { recursive: true });
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createInitCommand({
      cwd: () => projectRoot,
      isInteractive: () => false,
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init', '--json']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toMatchObject({
      ide: 'claude-code',
      framework: 'bmad',
      configPath: join(projectRoot, 'cord.config.yaml'),
      dataDirectory: join(projectRoot, '.cord'),
    });
    expect(existsSync(join(projectRoot, '.claude', 'settings.json'))).toBe(true);
    expect(existsSync(join(projectRoot, '.claude', 'rules', 'cord-relations.md'))).toBe(true);
    expect(existsSync(join(projectRoot, '.claude', 'hooks', 'cord-post-edit.sh'))).toBe(true);
    expect(JSON.parse(stdout.read()).generatedSkills).toEqual([
      '.claude/skills/cord-impact-analysis.md',
      '.claude/skills/cord-init-graph.md',
      '.claude/skills/cord-query-relations.md',
      '.claude/skills/cord-sync-docs.md',
    ]);
    expect(JSON.parse(stdout.read()).generatedFiles).not.toEqual(expect.arrayContaining([
      '.claude/skills/cord-impact-analysis.md',
      '.claude/skills/cord-init-graph.md',
      '.claude/skills/cord-query-relations.md',
      '.claude/skills/cord-sync-docs.md',
    ]));
    expect(existsSync(join(projectRoot, '.claude', 'skills', 'cord-impact-analysis.md'))).toBe(true);
    expect(existsSync(join(projectRoot, '.claude', 'skills', 'cord-init-graph.md'))).toBe(true);
    expect(existsSync(join(projectRoot, '.claude', 'skills', 'cord-query-relations.md'))).toBe(true);
    expect(existsSync(join(projectRoot, '.claude', 'skills', 'cord-sync-docs.md'))).toBe(true);
    expect(readFileSync(join(projectRoot, '.claude', 'skills', 'cord-impact-analysis.md'), 'utf8')).toContain('AnalyzeImpactResult');
    expect(readFileSync(join(projectRoot, '.claude', 'skills', 'cord-query-relations.md'), 'utf8')).toContain('QueryRelationsResult');
    expect(readFileSync(join(projectRoot, '.claude', 'skills', 'cord-init-graph.md'), 'utf8')).toContain('InitGraphResult');
    const syncDocsSkill = readFileSync(join(projectRoot, '.claude', 'skills', 'cord-sync-docs.md'), 'utf8');
    expect(syncDocsSkill).toContain('SyncDocsResult');
    expect(syncDocsSkill).toContain('changed document `filePath`');
    expect(syncDocsSkill).toContain('call `sync_docs` once per document');
    expect(syncDocsSkill).not.toContain('relevant impacted targets');
    expect(existsSync(join(projectRoot, 'cord.config.yaml'))).toBe(true);
    expect(existsSync(join(projectRoot, '.cord'))).toBe(true);
  });

  it('initializes a generic project with VS Code Copilot JSON config', async () => {
    const projectRoot = createProjectRoot('cord-init-generic-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.vscode'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    const stdout = createWriter();
    const stderr = createWriter();
    const command = createInitCommand({
      cwd: () => projectRoot,
      isInteractive: () => false,
      stdout,
      stderr,
    });

    await parseInitCommand(command, ['init', '--json', '--format', 'json']);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.read()).toBe('');
    expect(JSON.parse(stdout.read())).toMatchObject({
      ide: 'vscode-copilot',
      framework: 'generic',
      configPath: join(projectRoot, 'cord.config.json'),
      dataDirectory: join(projectRoot, '.cord'),
    });
    expect(existsSync(join(projectRoot, '.github', 'copilot-instructions.md'))).toBe(true);
    expect(existsSync(join(projectRoot, '.vscode', 'mcp.json'))).toBe(true);
    expect(existsSync(join(projectRoot, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(projectRoot, 'cord.config.json'))).toBe(true);
    expect(existsSync(join(projectRoot, 'cord.config.yaml'))).toBe(false);
  });
});