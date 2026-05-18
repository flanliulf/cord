import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ClaudeCodeAdapter,
  CodexCliAdapter,
  VscodeCopilotAdapter,
  CursorAdapter,
  collectDetectedIdes,
  resolveDetectedIde,
} from '../../../src/adapters/ide/index.js';
import { buildSharedAgentsSection, CORD_AGENTS_END_MARKER, CORD_AGENTS_START_MARKER } from '../../../src/adapters/ide/shared.js';
import { AdapterError, ConfigError } from '../../../src/utils/index.js';

function createProjectRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function readText(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}

describe('IDE detector', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('detects Claude Code from a .claude directory', () => {
    const projectRoot = createProjectRoot('cord-ide-claude-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });

    expect(collectDetectedIdes(projectRoot)).toEqual(['claude-code']);
  });

  it('detects Cursor from a .cursor directory', () => {
    const projectRoot = createProjectRoot('cord-ide-cursor-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });

    expect(collectDetectedIdes(projectRoot)).toEqual(['cursor']);
  });

  it('detects VS Code Copilot from a .vscode directory', () => {
    const projectRoot = createProjectRoot('cord-ide-vscode-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.vscode'), { recursive: true });

    expect(collectDetectedIdes(projectRoot)).toEqual(['vscode-copilot']);
  });

  it('detects Codex CLI only when AGENTS.md exists without other IDE markers', () => {
    const projectRoot = createProjectRoot('cord-ide-codex-');
    createdRoots.push(projectRoot);
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# Team guide\n');

    expect(collectDetectedIdes(projectRoot)).toEqual(['codex-cli']);
  });

  it('treats AGENTS.md as a shared file when another IDE marker exists', () => {
    const projectRoot = createProjectRoot('cord-ide-shared-agents-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.vscode'), { recursive: true });
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# Existing shared agents file\n');

    expect(collectDetectedIdes(projectRoot)).toEqual(['vscode-copilot']);
  });

  it('rejects ambiguous IDE detection instead of silently choosing one', () => {
    const projectRoot = createProjectRoot('cord-ide-ambiguous-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });

    expect(() => resolveDetectedIde(projectRoot)).toThrow(ConfigError);
  });
});

describe('IDE adapters', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('generates Claude Code config without overwriting an existing CLAUDE.md file', () => {
    const projectRoot = createProjectRoot('cord-adapter-claude-');
    createdRoots.push(projectRoot);
    writeFileSync(join(projectRoot, 'CLAUDE.md'), '# Existing Claude instructions\n');

    const adapter = new ClaudeCodeAdapter();
    adapter.generateInstructionFile(projectRoot);
    adapter.generateMcpConfig(projectRoot);
    adapter.generateHooksConfig?.(projectRoot);

    expect(readText(join(projectRoot, 'CLAUDE.md'))).toBe('# Existing Claude instructions\n');
    expect(readText(join(projectRoot, '.claude', 'rules', 'cord-relations.md'))).toContain('query_relations');
    expect(readJson<{ mcpServers: { cord: { command: string } }; hooks: Record<string, unknown> }>(join(projectRoot, '.claude', 'settings.json'))).toMatchObject({
      mcpServers: {
        cord: {
          command: 'node',
        },
      },
      hooks: {
        PostToolUse: expect.any(Array),
      },
    });
    expect(existsSync(join(projectRoot, '.claude', 'hooks', 'cord-post-edit.sh'))).toBe(true);
  });

  it('generates Cursor MCP config and rules file', () => {
    const projectRoot = createProjectRoot('cord-adapter-cursor-');
    createdRoots.push(projectRoot);

    const adapter = new CursorAdapter();
    adapter.generateInstructionFile(projectRoot);
    adapter.generateMcpConfig(projectRoot);

    expect(readJson<{ mcpServers: { cord: { args: string[] } } }>(join(projectRoot, '.cursor', 'mcp.json'))).toEqual({
      mcpServers: {
        cord: {
          command: 'node',
          args: ['./dist/mcp/server.js'],
        },
      },
    });
    expect(readText(join(projectRoot, '.cursor', 'rules', 'cord-relations.mdc'))).toContain('analyze_impact');
  });

  it('generates VS Code Copilot instructions, MCP host config, and shared AGENTS block', () => {
    const projectRoot = createProjectRoot('cord-adapter-vscode-');
    createdRoots.push(projectRoot);

    const adapter = new VscodeCopilotAdapter();
    adapter.generateInstructionFile(projectRoot);
    adapter.generateMcpConfig(projectRoot);

    expect(readText(join(projectRoot, '.github', 'copilot-instructions.md'))).toContain('sync_docs');
    expect(readJson<{ servers: { cord: { command: string; type: string } } }>(join(projectRoot, '.vscode', 'mcp.json'))).toEqual({
      servers: {
        cord: {
          type: 'stdio',
          command: 'node',
          args: ['./dist/mcp/server.js'],
        },
      },
    });
    expect(readText(join(projectRoot, 'AGENTS.md'))).toContain('<!-- CORD:START -->');
  });

  it('refuses to overwrite an existing VS Code Copilot instructions file', () => {
    const projectRoot = createProjectRoot('cord-adapter-vscode-protected-');
    createdRoots.push(projectRoot);
    const instructionsPath = join(projectRoot, '.github', 'copilot-instructions.md');
    mkdirSync(join(projectRoot, '.github'), { recursive: true });
    writeFileSync(instructionsPath, '# Existing Copilot instructions\n');

    const adapter = new VscodeCopilotAdapter();

    expect(() => adapter.generateInstructionFile(projectRoot)).toThrow(AdapterError);
    expect(readText(instructionsPath)).toBe('# Existing Copilot instructions\n');
    expect(existsSync(join(projectRoot, 'AGENTS.md'))).toBe(false);
  });

  it('appends the shared CORD section to an existing AGENTS.md file for Codex CLI', () => {
    const projectRoot = createProjectRoot('cord-adapter-codex-');
    createdRoots.push(projectRoot);
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# Existing instructions\n\nKeep this section.\n');

    const adapter = new CodexCliAdapter();
    adapter.generateInstructionFile(projectRoot);

    const content = readText(join(projectRoot, 'AGENTS.md'));
    expect(content).toContain('# Existing instructions');
    expect(content).toContain('<!-- CORD:START -->');
    expect(content).toContain('query_relations');
  });

  it('throws a structured conflict error when AGENTS.md markers are malformed', () => {
    const projectRoot = createProjectRoot('cord-adapter-agents-conflict-');
    createdRoots.push(projectRoot);
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# Existing\n<!-- CORD:START -->\nBroken section\n');

    const adapter = new CodexCliAdapter();

    expect(() => adapter.generateInstructionFile(projectRoot)).toThrow(AdapterError);

    try {
      adapter.generateInstructionFile(projectRoot);
      expect.fail('expected AdapterError');
    } catch (error) {
      expect(error).toBeInstanceOf(AdapterError);
      expect((error as AdapterError).context.error).toBe('AGENTS_MD_CONFLICT');
    }
  });

  it('preserves all AGENTS.md content outside the CORD block when updating an existing block', () => {
    const projectRoot = createProjectRoot('cord-adapter-agents-preserve-');
    createdRoots.push(projectRoot);
    const agentsPath = join(projectRoot, 'AGENTS.md');
    const beforeSection = '# Existing instructions\n\nKeep this spacing.\n   \n';
    const existingCordSection = [
      CORD_AGENTS_START_MARKER,
      '# Old CORD Integration',
      '',
      '- Old line',
      CORD_AGENTS_END_MARKER,
    ].join('\n');
    const afterSection = '\n\nUser footer stays below.\n\n';
    writeFileSync(agentsPath, `${beforeSection}${existingCordSection}${afterSection}`);

    const adapter = new CodexCliAdapter();
    adapter.generateInstructionFile(projectRoot);

    const updated = readText(agentsPath);
    const startIndex = updated.indexOf(CORD_AGENTS_START_MARKER);
    const endIndex = updated.indexOf(CORD_AGENTS_END_MARKER) + CORD_AGENTS_END_MARKER.length;

    expect(updated.slice(0, startIndex)).toBe(beforeSection);
    expect(updated.slice(endIndex)).toBe(afterSection);
    expect(updated.slice(startIndex, endIndex)).toBe(buildSharedAgentsSection().trimEnd());
  });
});