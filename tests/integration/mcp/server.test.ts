import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { ClaudeCodeAdapter, CursorAdapter, VscodeCopilotAdapter } from '../../../src/adapters/ide/index.js';
import { createCordMcpServer } from '../../../src/mcp/server.js';

const EXPECTED_TOOL_NAMES = [
  'add_relation',
  'analyze_impact',
  'deprecate_relation',
  'init_graph',
  'query_relations',
  'remove_relation',
  'sync_docs',
];

const REPOSITORY_ROOT = process.cwd();

function createTempProjectFromFixture(fixtureName: 'generic-project' | 'bmad-project'): string {
  const targetRoot = mkdtempSync(join(tmpdir(), `cord-mcp-${fixtureName}-`));
  const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'sample-projects', fixtureName);
  cpSync(fixtureRoot, targetRoot, { recursive: true });
  return targetRoot;
}

async function connectTestServer(projectRoot: string): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const instance = createCordMcpServer({ projectRoot });
  const client = new Client({
    name: 'cord-mcp-test-client',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    instance.server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    close: async () => {
      await clientTransport.close();
      await serverTransport.close();
      await instance.close();
    },
  };
}

function linkRuntimeArtifacts(projectRoot: string): void {
  symlinkSync(join(REPOSITORY_ROOT, 'dist'), join(projectRoot, 'dist'), 'dir');
  symlinkSync(join(REPOSITORY_ROOT, 'node_modules'), join(projectRoot, 'node_modules'), 'dir');
}

async function connectConfiguredStdioServer(options: {
  projectRoot: string;
  command: string;
  args: string[];
}): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  linkRuntimeArtifacts(options.projectRoot);

  const transport = new StdioClientTransport({
    command: options.command,
    args: options.args,
    cwd: options.projectRoot,
    stderr: 'pipe',
  });
  const client = new Client({
    name: 'cord-mcp-stdio-test-client',
    version: '1.0.0',
  });

  let stderrOutput = '';
  transport.stderr?.on('data', (chunk) => {
    stderrOutput += chunk.toString();
  });

  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close().catch(() => undefined);

    if (error instanceof Error && stderrOutput.trim()) {
        throw new Error(`${error.message}\n[stdio stderr]\n${stderrOutput.trim()}`, { cause: error });
    }

    throw error;
  }

  return {
    client,
    close: async () => {
      await client.close();
      await transport.close();
    },
  };
}

function getStructuredContent<T extends Record<string, unknown>>(result: unknown): T {
  const toolResult = result as { structuredContent?: Record<string, unknown> };
  expect(toolResult.structuredContent).toBeDefined();
  return toolResult.structuredContent as T;
}

function getTextContent(result: unknown): Array<Record<string, unknown>> {
  return (result as { content: Array<Record<string, unknown>> }).content;
}

function readJson<T extends Record<string, unknown>>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

async function expectCoreToolsWork(connection: { client: Client }, projectRoot: string): Promise<void> {
  const initResult = await connection.client.callTool({ name: 'init_graph', arguments: {} });
  const initGraph = getStructuredContent<{
    documentsFound: number;
    relationsDiscovered: number;
    warnings: string[];
    durationMs: number;
  }>(initResult);

  expect(initGraph).toMatchObject({
    documentsFound: 2,
    relationsDiscovered: 2,
    warnings: [],
  });
  expect(initGraph.durationMs).toBeGreaterThanOrEqual(0);
  expect(existsSync(join(projectRoot, '.cord', 'cord.db'))).toBe(true);

  const queryResult = await connection.client.callTool({
    name: 'query_relations',
    arguments: {
      docPath: 'docs/overview.md',
    },
  });
  const relations = getStructuredContent<{
    relations: Array<{
      relationId: string;
      targetPath: string;
      relationType: string;
      confidence: number;
      source: string;
      status: string;
      hopDistance: number;
    }>;
    totalCount: number;
  }>(queryResult);

  expect(relations.totalCount).toBeGreaterThanOrEqual(1);
  expect(relations.relations).toContainEqual(expect.objectContaining({
    relationId: expect.any(String),
    targetPath: 'docs/notes.md',
    relationType: 'references',
    confidence: expect.any(Number),
    source: 'auto_scan',
    status: 'active',
    hopDistance: 1,
  }));

  const impactResult = await connection.client.callTool({
    name: 'analyze_impact',
    arguments: {
      docPath: 'docs/overview.md',
    },
  });
  const impact = getStructuredContent<{
    impactedDocs: Array<{
      docPath: string;
      relationType: string;
      propagationType: string;
      suggestedAction: string;
      updateStrategy: string;
      severity: string;
      confidence: number;
      hopDistance: number;
    }>;
    totalCount: number;
  }>(impactResult);

  expect(impact.totalCount).toBeGreaterThanOrEqual(1);
  expect(impact.impactedDocs).toContainEqual(expect.objectContaining({
    docPath: 'docs/notes.md',
    relationType: 'references',
    propagationType: 'references',
    suggestedAction: '仅供参考',
    updateStrategy: 'suggest',
    severity: 'info',
    confidence: expect.any(Number),
    hopDistance: 1,
  }));

  const syncDocsResult = await connection.client.callTool({
    name: 'sync_docs',
    arguments: {
      filePath: 'docs/overview.md',
    },
  });
  const syncDocs = getStructuredContent<{
    suggestions: Array<{
      targetPath: string;
      action: string;
      updateStrategy: string;
      reason: string;
    }>;
    affectedCount: number;
  }>(syncDocsResult);

  expect(syncDocs.affectedCount).toBe(syncDocs.suggestions.length);
  expect(syncDocs.suggestions).toContainEqual({
    targetPath: 'docs/notes.md',
    action: 'review',
    updateStrategy: 'suggest',
    reason: '仅供参考',
  });
}

describe('CORD MCP server integration', () => {
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

  it('lists the 7 MCP tools and exposes their schemas', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const connection = await connectTestServer(projectRoot);
    cleanupCallbacks.push(connection.close);

    const result = await connection.client.listTools();
    const toolNames = result.tools.map((tool) => tool.name).sort();

    expect(toolNames).toEqual(EXPECTED_TOOL_NAMES);

    const addRelationTool = result.tools.find((tool) => tool.name === 'add_relation');
    expect(addRelationTool?.inputSchema.properties).toHaveProperty('sourcePath');
    expect(addRelationTool?.outputSchema?.properties).toHaveProperty('relationId');

    const queryRelationsTool = result.tools.find((tool) => tool.name === 'query_relations');
    expect(queryRelationsTool?.inputSchema.properties).toHaveProperty('docPath');
    expect(queryRelationsTool?.outputSchema?.properties).toHaveProperty('relations');
  });

  it('runs the 4 core tools end-to-end on a real fixture project', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const connection = await connectTestServer(projectRoot);
    cleanupCallbacks.push(connection.close);

    await expectCoreToolsWork(connection, projectRoot);
  });

  it('validates Claude Code, Cursor, and VS Code Copilot MCP configs against the same server tool chain', async () => {
    const ideCases = [
      {
        name: 'claude-code',
        readEntry(projectRoot: string): { command: string; args: string[] } {
          new ClaudeCodeAdapter().generateMcpConfig(projectRoot);
          return readJson<{ mcpServers: { cord: { command: string; args: string[] } } }>(join(projectRoot, '.claude', 'settings.json')).mcpServers.cord;
        },
      },
      {
        name: 'cursor',
        readEntry(projectRoot: string): { command: string; args: string[] } {
          new CursorAdapter().generateMcpConfig(projectRoot);
          return readJson<{ mcpServers: { cord: { command: string; args: string[] } } }>(join(projectRoot, '.cursor', 'mcp.json')).mcpServers.cord;
        },
      },
      {
        name: 'vscode-copilot',
        readEntry(projectRoot: string): { command: string; args: string[]; type: string } {
          new VscodeCopilotAdapter().generateMcpConfig(projectRoot);
          return readJson<{ servers: { cord: { command: string; args: string[]; type: string } } }>(join(projectRoot, '.vscode', 'mcp.json')).servers.cord;
        },
      },
    ] as const;

    for (const ideCase of ideCases) {
      const projectRoot = createTempProjectFromFixture('generic-project');
      createdRoots.push(projectRoot);

      const entry = ideCase.readEntry(projectRoot);
      expect(entry).toMatchObject({
        command: 'node',
        args: ['./dist/mcp/server.js'],
      });

      if ('type' in entry) {
        expect(entry.type).toBe('stdio');
      }

      const connection = await connectConfiguredStdioServer({
        projectRoot,
        command: entry.command,
        args: entry.args,
      });
      cleanupCallbacks.push(connection.close);

      const listedTools = await connection.client.listTools();
      expect(listedTools.tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOL_NAMES);
      await expectCoreToolsWork(connection, projectRoot);
    }
  });

  it('runs add_relation, deprecate_relation, and remove_relation against the real repository', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const connection = await connectTestServer(projectRoot);
    cleanupCallbacks.push(connection.close);

    await connection.client.callTool({ name: 'init_graph', arguments: {} });

    const addResult = await connection.client.callTool({
      name: 'add_relation',
      arguments: {
        sourcePath: 'docs/notes.md',
        targetPath: 'docs/overview.md',
        relationType: 'sync_required',
      },
    });
    const addedRelation = getStructuredContent<{
      relationId: string;
      sourcePath: string;
      targetPath: string;
      relationType: string;
      source: string;
      status: string;
    }>(addResult);

    expect(addedRelation).toEqual({
      relationId: expect.any(String),
      sourcePath: 'docs/notes.md',
      targetPath: 'docs/overview.md',
      relationType: 'sync_required',
      source: 'manual',
      status: 'active',
    });

    const queryAddedRelation = await connection.client.callTool({
      name: 'query_relations',
      arguments: {
        docPath: 'docs/notes.md',
        type: 'sync_required',
      },
    });
    const addedRelations = getStructuredContent<{
      relations: Array<{
        relationId: string;
        targetPath: string;
        relationType: string;
        source: string;
        status: string;
      }>;
      totalCount: number;
    }>(queryAddedRelation);

    expect(addedRelations.relations).toContainEqual(expect.objectContaining({
      relationId: addedRelation.relationId,
      targetPath: 'docs/overview.md',
      relationType: 'sync_required',
      source: 'manual',
      status: 'active',
    }));

    const originalRelation = addedRelations.relations.find((relation) => relation.relationId !== addedRelation.relationId);
    expect(originalRelation).toBeUndefined();

    const autoRelationQuery = await connection.client.callTool({
      name: 'query_relations',
      arguments: {
        docPath: 'docs/overview.md',
        type: 'references',
        includeDeprecated: true,
      },
    });
    const autoRelations = getStructuredContent<{
      relations: Array<{
        relationId: string;
        relationType: string;
        source: string;
        status: string;
      }>;
    }>(autoRelationQuery);
    const autoRelation = autoRelations.relations[0];

    expect(autoRelation).toMatchObject({
      relationId: expect.any(String),
      relationType: 'references',
      source: 'auto_scan',
      status: 'active',
    });

    const deprecateResult = await connection.client.callTool({
      name: 'deprecate_relation',
      arguments: {
        relationId: autoRelation?.relationId,
      },
    });
    const deprecatedRelation = getStructuredContent<{
      relationId: string;
      status: string;
      relationType: string;
    }>(deprecateResult);

    expect(deprecatedRelation).toEqual({
      relationId: autoRelation?.relationId,
      status: 'deprecated',
      relationType: 'references',
    });

    const deprecatedQuery = await connection.client.callTool({
      name: 'query_relations',
      arguments: {
        docPath: 'docs/overview.md',
        type: 'references',
        includeDeprecated: true,
      },
    });
    const deprecatedRelations = getStructuredContent<{
      relations: Array<{
        relationId: string;
        source: string;
        status: string;
      }>;
    }>(deprecatedQuery);

    expect(deprecatedRelations.relations).toContainEqual(expect.objectContaining({
      relationId: autoRelation?.relationId,
      source: 'manual',
      status: 'deprecated',
    }));

    const removeResult = await connection.client.callTool({
      name: 'remove_relation',
      arguments: {
        relationId: addedRelation.relationId,
      },
    });
    const removedRelation = getStructuredContent<{
      success: boolean;
      relationId: string;
    }>(removeResult);

    expect(removedRelation).toEqual({
      success: true,
      relationId: addedRelation.relationId,
    });

    const queryAfterRemoval = await connection.client.callTool({
      name: 'query_relations',
      arguments: {
        docPath: 'docs/notes.md',
        type: 'sync_required',
        includeDeprecated: true,
      },
    });
    const relationsAfterRemoval = getStructuredContent<{
      relations: Array<{ relationId: string }>;
      totalCount: number;
    }>(queryAfterRemoval);

    expect(relationsAfterRemoval.relations).toEqual([]);
    expect(relationsAfterRemoval.totalCount).toBe(0);
  });

  it('returns input validation failures as MCP tool errors', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const connection = await connectTestServer(projectRoot);
    cleanupCallbacks.push(connection.close);

    const result = await connection.client.callTool({
      name: 'query_relations',
      arguments: {
        docPath: 'docs/overview.md',
        depth: 0,
      },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Input validation error'),
    });
  });

  it('handles concurrent read-only tool calls without shared-state interference', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const connection = await connectTestServer(projectRoot);
    cleanupCallbacks.push(connection.close);

    await connection.client.callTool({ name: 'init_graph', arguments: {} });

    const results = await Promise.all([
      connection.client.callTool({ name: 'analyze_impact', arguments: { docPath: 'docs/overview.md' } }),
      connection.client.callTool({ name: 'query_relations', arguments: { docPath: 'docs/overview.md' } }),
      connection.client.callTool({ name: 'sync_docs', arguments: { filePath: 'docs/overview.md' } }),
      connection.client.callTool({ name: 'query_relations', arguments: { docPath: 'docs/overview.md', depth: 1 } }),
    ]);

    const [impact, relations1, syncDocs, relations2] = results;
    expect(getStructuredContent<{ totalCount: number }>(impact).totalCount).toBeGreaterThanOrEqual(1);
    expect(getStructuredContent<{ totalCount: number }>(relations1).totalCount).toBeGreaterThanOrEqual(1);
    expect(getStructuredContent<{ affectedCount: number }>(syncDocs).affectedCount).toBeGreaterThanOrEqual(1);
    expect(getStructuredContent<{ totalCount: number }>(relations2).totalCount).toBeGreaterThanOrEqual(1);
  });

  it('keeps tool p95 under 50ms on the fixture read path', async () => {
    const projectRoot = createTempProjectFromFixture('generic-project');
    createdRoots.push(projectRoot);
    const connection = await connectTestServer(projectRoot);
    cleanupCallbacks.push(connection.close);

    await connection.client.callTool({ name: 'init_graph', arguments: {} });

    const durations: number[] = [];

    for (let index = 0; index < 30; index += 1) {
      const startedAt = performance.now();
      await connection.client.callTool({
        name: 'query_relations',
        arguments: {
          docPath: 'docs/overview.md',
        },
      });
      durations.push(performance.now() - startedAt);
    }

    const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
    const p95 = [...durations].sort((left, right) => left - right)[p95Index] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(50);
  });
});
