import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ClaudeCodeAdapter,
  CodexCliAdapter,
  CursorAdapter,
  VscodeCopilotAdapter,
  collectDetectedIdes,
} from '../../../src/adapters/ide/index.js';
import { InitService } from '../../../src/services/init-service.js';
import { createCordMcpServer } from '../../../src/mcp/server.js';

const EXPECTED_EPIC_5_TOOL_NAMES = [
  'add_relation',
  'analyze_impact',
  'deprecate_relation',
  'init_graph',
  'query_relations',
  'remove_relation',
  'sync_docs',
];

interface McpConnection {
  client: Client;
  close: () => Promise<void>;
}

function createTempProject(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `cord-${prefix}-`));
}

function createFixtureProject(prefix: string): string {
  const projectRoot = createTempProject(prefix);
  const fixtureRoot = join(
    process.cwd(),
    'tests',
    'fixtures',
    'sample-projects',
    'generic-project',
  );
  cpSync(fixtureRoot, projectRoot, { recursive: true });
  return projectRoot;
}

function readText(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}

async function connectTestServer(projectRoot: string): Promise<McpConnection> {
  const instance = createCordMcpServer({ projectRoot });
  const client = new Client({
    name: 'cord-epic-5-flow-client',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([instance.server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    close: async () => {
      await clientTransport.close();
      await serverTransport.close();
      await instance.close();
    },
  };
}

function getStructuredContent<T extends Record<string, unknown>>(result: unknown): T {
  const toolResult = result as { structuredContent?: Record<string, unknown> };
  expect(toolResult.structuredContent).toBeDefined();
  return toolResult.structuredContent as T;
}

describe('Epic 5 end-to-end MCP, IDE init, hooks, and skills flows', () => {
  const createdRoots: string[] = [];
  const cleanupCallbacks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const close of cleanupCallbacks.splice(0)) {
      await close();
    }

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  describe('Story 5.1 MCP server core and four tools', () => {
    it('lists all MCP tools and runs the four core tools over one fixture project', async () => {
      const projectRoot = createFixtureProject('epic-5-mcp-core');
      createdRoots.push(projectRoot);
      const connection = await connectTestServer(projectRoot);
      cleanupCallbacks.push(connection.close);

      const listedTools = await connection.client.listTools();
      expect(listedTools.tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_EPIC_5_TOOL_NAMES);

      const initGraph = getStructuredContent<{
        documentsFound: number;
        relationsDiscovered: number;
        warnings: string[];
      }>(await connection.client.callTool({ name: 'init_graph', arguments: {} }));
      expect(initGraph).toMatchObject({
        documentsFound: 2,
        relationsDiscovered: 2,
        warnings: [],
      });

      const queryRelations = getStructuredContent<{
        relations: Array<{ targetPath: string; relationType: string; status: string }>;
        totalCount: number;
      }>(
        await connection.client.callTool({
          name: 'query_relations',
          arguments: { docPath: 'docs/overview.md' },
        }),
      );
      expect(queryRelations.totalCount).toBeGreaterThanOrEqual(1);
      expect(queryRelations.relations).toContainEqual(
        expect.objectContaining({
          targetPath: 'docs/notes.md',
          relationType: 'references',
          status: 'active',
        }),
      );

      const impact = getStructuredContent<{
        impactedDocs: Array<{ docPath: string; updateStrategy: string; suggestedAction: string }>;
        totalCount: number;
      }>(
        await connection.client.callTool({
          name: 'analyze_impact',
          arguments: { docPath: 'docs/overview.md' },
        }),
      );
      expect(impact.totalCount).toBeGreaterThanOrEqual(1);
      expect(impact.impactedDocs).toContainEqual(
        expect.objectContaining({
          docPath: 'docs/notes.md',
          updateStrategy: 'suggest',
          suggestedAction: '仅供参考',
        }),
      );

      const syncDocs = getStructuredContent<{
        suggestions: Array<{ targetPath: string; action: string; updateStrategy: string }>;
        affectedCount: number;
      }>(
        await connection.client.callTool({
          name: 'sync_docs',
          arguments: { filePath: 'docs/overview.md' },
        }),
      );
      expect(syncDocs.affectedCount).toBeGreaterThanOrEqual(1);
      expect(syncDocs.suggestions).toContainEqual({
        targetPath: 'docs/notes.md',
        action: 'review',
        updateStrategy: 'suggest',
        reason: '仅供参考',
      });
    });
  });

  describe('Story 5.2 MCP relation management tools', () => {
    it('adds, verifies, deprecates, and removes relations through MCP tools', async () => {
      const projectRoot = createFixtureProject('epic-5-mcp-relations');
      createdRoots.push(projectRoot);
      const connection = await connectTestServer(projectRoot);
      cleanupCallbacks.push(connection.close);

      await connection.client.callTool({ name: 'init_graph', arguments: {} });

      const added = getStructuredContent<{
        relationId: string;
        sourcePath: string;
        targetPath: string;
        relationType: string;
        source: string;
        status: string;
      }>(
        await connection.client.callTool({
          name: 'add_relation',
          arguments: {
            sourcePath: 'docs/notes.md',
            targetPath: 'docs/overview.md',
            relationType: 'sync_required',
          },
        }),
      );

      expect(added).toEqual({
        relationId: expect.any(String),
        sourcePath: 'docs/notes.md',
        targetPath: 'docs/overview.md',
        relationType: 'sync_required',
        source: 'manual',
        status: 'active',
      });

      const queryAdded = getStructuredContent<{
        relations: Array<{ relationId: string; targetPath: string; status: string }>;
      }>(
        await connection.client.callTool({
          name: 'query_relations',
          arguments: { docPath: 'docs/notes.md', type: 'sync_required' },
        }),
      );
      expect(queryAdded.relations).toContainEqual(
        expect.objectContaining({
          relationId: added.relationId,
          targetPath: 'docs/overview.md',
          status: 'active',
        }),
      );

      const deprecated = getStructuredContent<{
        relationId: string;
        status: string;
        relationType: string;
      }>(
        await connection.client.callTool({
          name: 'deprecate_relation',
          arguments: { relationId: added.relationId },
        }),
      );
      expect(deprecated).toEqual({
        relationId: added.relationId,
        status: 'deprecated',
        relationType: 'sync_required',
      });

      const removed = getStructuredContent<{
        success: boolean;
        relationId: string;
      }>(
        await connection.client.callTool({
          name: 'remove_relation',
          arguments: { relationId: added.relationId },
        }),
      );
      expect(removed).toEqual({
        success: true,
        relationId: added.relationId,
      });

      const queryRemoved = getStructuredContent<{
        relations: Array<{ relationId: string }>;
        totalCount: number;
      }>(
        await connection.client.callTool({
          name: 'query_relations',
          arguments: {
            docPath: 'docs/notes.md',
            type: 'sync_required',
            includeDeprecated: true,
          },
        }),
      );
      expect(queryRemoved).toEqual({
        relations: [],
        totalCount: 0,
      });
    });
  });

  describe('Story 5.3 IDE adapter and auto detection', () => {
    it('detects supported IDE markers and generates each IDE MCP config without modifying protected files', () => {
      const projectRoot = createTempProject('epic-5-ide-adapters');
      createdRoots.push(projectRoot);

      const claudeRoot = join(projectRoot, 'claude');
      const cursorRoot = join(projectRoot, 'cursor');
      const vscodeRoot = join(projectRoot, 'vscode');
      const codexRoot = join(projectRoot, 'codex');
      for (const root of [claudeRoot, cursorRoot, vscodeRoot, codexRoot]) {
        mkdirSync(root, { recursive: true });
      }

      mkdirSync(join(claudeRoot, '.claude'), { recursive: true });
      mkdirSync(join(cursorRoot, '.cursor'), { recursive: true });
      mkdirSync(join(vscodeRoot, '.vscode'), { recursive: true });
      writeFileSync(join(codexRoot, 'AGENTS.md'), '# Existing Codex instructions\n');

      expect(collectDetectedIdes(claudeRoot)).toEqual(['claude-code']);
      expect(collectDetectedIdes(cursorRoot)).toEqual(['cursor']);
      expect(collectDetectedIdes(vscodeRoot)).toEqual(['vscode-copilot']);
      expect(collectDetectedIdes(codexRoot)).toEqual(['codex-cli']);

      new ClaudeCodeAdapter().generateMcpConfig(claudeRoot);
      new CursorAdapter().generateMcpConfig(cursorRoot);
      new VscodeCopilotAdapter().generateMcpConfig(vscodeRoot);
      new CodexCliAdapter().generateInstructionFile(codexRoot);

      expect(
        readJson<{ mcpServers: { cord: { args: string[] } } }>(
          join(claudeRoot, '.claude', 'settings.json'),
        ).mcpServers.cord.args,
      ).toEqual(['./dist/mcp/server.js']);
      expect(
        readJson<{ mcpServers: { cord: { args: string[] } } }>(
          join(cursorRoot, '.cursor', 'mcp.json'),
        ).mcpServers.cord.args,
      ).toEqual(['./dist/mcp/server.js']);
      expect(
        readJson<{ servers: { cord: { type: string; args: string[] } } }>(
          join(vscodeRoot, '.vscode', 'mcp.json'),
        ).servers.cord,
      ).toMatchObject({
        type: 'stdio',
        args: ['./dist/mcp/server.js'],
      });
      expect(readText(join(codexRoot, 'AGENTS.md'))).toContain('<!-- CORD:START -->');
      expect(readText(join(codexRoot, 'AGENTS.md'))).toContain('# Existing Codex instructions');
    });
  });

  describe('Story 5.4 InitService one-click initialization', () => {
    it('initializes a Claude Code project with config, data directory, MCP config, hooks, and skills', async () => {
      const projectRoot = createTempProject('epic-5-init-service');
      createdRoots.push(projectRoot);
      mkdirSync(join(projectRoot, '.claude'), { recursive: true });
      mkdirSync(join(projectRoot, 'docs'), { recursive: true });

      const result = await new InitService().init({
        projectRoot,
        ide: 'claude-code',
        format: 'yaml',
      });

      expect(result).toMatchObject({
        ide: 'claude-code',
        framework: 'generic',
        generatedSkills: [
          '.claude/skills/cord-impact-analysis.md',
          '.claude/skills/cord-init-graph.md',
          '.claude/skills/cord-query-relations.md',
          '.claude/skills/cord-sync-docs.md',
        ],
      });
      expect(result.configPath).toBe(join(projectRoot, 'cord.config.yaml'));
      expect(result.dataDirectory).toBe(join(projectRoot, '.cord'));
      expect(readText(join(projectRoot, 'cord.config.yaml'))).toContain('ide: claude-code');
      expect(readText(join(projectRoot, '.claude', 'settings.json'))).toContain(
        './dist/mcp/server.js',
      );
      expect(readText(join(projectRoot, '.claude', 'hooks', 'cord-post-edit.sh'))).toContain(
        'cord impact --json',
      );
    });
  });

  describe('Story 5.5 hooks auto trigger and skills generation', () => {
    it('runs the generated post-edit hook and emits four schema-linked skills', () => {
      const projectRoot = createTempProject('epic-5-hooks-skills');
      createdRoots.push(projectRoot);

      const adapter = new ClaudeCodeAdapter();
      adapter.generateHooksConfig(projectRoot);
      const skills = adapter.generateSkills();
      for (const skill of skills) {
        const skillPath = join(projectRoot, skill.targetPath);
        mkdirSync(join(skillPath, '..'), { recursive: true });
        writeFileSync(skillPath, skill.content, 'utf8');
      }

      const binDir = join(projectRoot, 'bin');
      const logPath = join(projectRoot, 'cord-hook.log');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        join(binDir, 'cord'),
        '#!/usr/bin/env sh\nprintf "%s\\n" "$@" > "$CORD_STUB_LOG"\n',
      );
      chmodSync(join(binDir, 'cord'), 0o755);

      execFileSync(
        join(projectRoot, '.claude', 'hooks', 'cord-post-edit.sh'),
        ['docs/changed.md'],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            PATH: `${binDir}${process.env.PATH ? `:${process.env.PATH}` : ''}`,
            CORD_STUB_LOG: logPath,
          },
        },
      );

      expect(readText(logPath)).toBe('impact\n--json\ndocs/changed.md\n');
      expect(skills.map((skill) => skill.targetPath).sort()).toEqual([
        '.claude/skills/cord-impact-analysis.md',
        '.claude/skills/cord-init-graph.md',
        '.claude/skills/cord-query-relations.md',
        '.claude/skills/cord-sync-docs.md',
      ]);
      expect(readText(join(projectRoot, '.claude', 'skills', 'cord-impact-analysis.md'))).toContain(
        'AnalyzeImpactResult',
      );
      expect(readText(join(projectRoot, '.claude', 'skills', 'cord-query-relations.md'))).toContain(
        'QueryRelationsResult',
      );
      expect(readText(join(projectRoot, '.claude', 'skills', 'cord-init-graph.md'))).toContain(
        'InitGraphResult',
      );
      expect(readText(join(projectRoot, '.claude', 'skills', 'cord-sync-docs.md'))).toContain(
        'SyncDocsResult',
      );
    });
  });
});
