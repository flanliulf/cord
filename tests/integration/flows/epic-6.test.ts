import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AbstractFrameworkAdapter,
  GenericFrameworkAdapter,
  type DocTypeDefinition,
  type PresetRule,
} from '../../../src/adapters/framework/index.js';
import { createImpactCommand } from '../../../src/cli/commands/impact.js';
import { createInitCommand } from '../../../src/cli/commands/init.js';
import { createScanCommand } from '../../../src/cli/commands/scan.js';
import { createProgram } from '../../../src/cli/index.js';
import { ScanService, SqliteGraphRepository, RELATION_TYPES } from '../../../src/index.js';
import { createCordMcpServer } from '../../../src/mcp/server.js';

const README_DOC_LINKS = [
  'docs/getting-started.md',
  'docs/cli-reference.md',
  'docs/mcp-tools-reference.md',
  'docs/configuration.md',
  'docs/adapter-guide.md',
  'docs/contributing.md',
];

const README_ZH_DOC_LINKS = README_DOC_LINKS.map((link) => link.replace(/\.md$/, '.zh.md'));

const EXPECTED_CLI_COMMANDS = ['init', 'scan', 'query', 'impact', 'export', 'status'];

const EXPECTED_MCP_TOOLS = [
  'add_relation',
  'analyze_impact',
  'deprecate_relation',
  'init_graph',
  'query_relations',
  'remove_relation',
  'sync_docs',
];

interface BufferingWriter {
  write(chunk: string): boolean;
  read(): string;
}

class ExampleFrameworkAdapter extends AbstractFrameworkAdapter {
  readonly name = 'example';

  detectFramework(projectRoot: string): boolean {
    return readIfExists(join(projectRoot, 'example.config.json')) !== null;
  }

  getDocumentTypes(): DocTypeDefinition[] {
    return [
      {
        name: 'example-spec',
        patterns: ['**/specs/**/*.md'],
        description: 'Example framework specification documents',
      },
      {
        name: 'example-task',
        patterns: ['**/tasks/**/*.md'],
        description: 'Example framework task documents',
      },
    ];
  }

  getPresetRules(): PresetRule[] {
    return [
      {
        sourceDocType: 'example-spec',
        targetDocType: 'example-task',
        relationType: RELATION_TYPES.DERIVED_FROM,
        confidence: 0.9,
      },
    ];
  }

  protected override getDefaultScanPaths(): string[] {
    return ['docs'];
  }
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

function createTempProject(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `cord-${prefix}-`));
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function readIfExists(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeProjectFile(projectRoot: string, relativePath: string, content: string): void {
  const filePath = join(projectRoot, relativePath);
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

async function parseCommand(command: Command, args: string[]): Promise<void> {
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

describe('Epic 6 end-to-end contributor and user documentation flows', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    process.exitCode = undefined;

    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  describe('Story 6.1 framework adapter contributor docs', () => {
    it('lets a contributor follow the documented minimal adapter path without core module changes', async () => {
      const guide = readRepoFile('docs/adapter-guide.md');
      const contributing = readRepoFile('docs/contributing.md');
      const projectRoot = createTempProject('epic-6-adapter');
      createdRoots.push(projectRoot);

      writeProjectFile(projectRoot, 'example.config.json', '{"framework":"example"}\n');
      writeProjectFile(projectRoot, 'docs/specs/product.md', '# Product Spec\n');
      writeProjectFile(projectRoot, 'docs/tasks/implement.md', '# Implementation Task\n');

      const repo = new SqliteGraphRepository(':memory:');
      const service = new ScanService(repo, undefined, [
        new ExampleFrameworkAdapter(),
        new GenericFrameworkAdapter(),
      ]);

      try {
        const result = await service.scan({ projectRoot, rebuild: true, force: true });

        expect(result).toMatchObject({
          documentsFound: 2,
          relationsDiscovered: 1,
          warnings: [],
        });
        expect(
          repo
            .getAllDocuments()
            .map((doc) => doc.docType)
            .sort(),
        ).toEqual(['example-spec', 'example-task']);
        expect(repo.getAllRelations()).toContainEqual(
          expect.objectContaining({
            relationType: RELATION_TYPES.DERIVED_FROM,
            confidence: 0.9,
            source: 'framework_preset',
            status: 'active',
          }),
        );
      } finally {
        service.close();
      }

      expect(guide).toContain('4-Hour Minimal Path');
      expect(guide).toContain('src/adapters/framework/index.ts');
      expect(guide).toContain('GenericFrameworkAdapter');
      expect(contributing).toContain('Integration Test Template');
      expect(contributing).toContain('src/scanner/**');
      expect(contributing).toContain('src/services/query-service.ts');
      expect(contributing).toContain('src/services/impact-service.ts');
    });
  });

  describe('Story 6.2 user docs and README', () => {
    it('keeps README, CLI reference, MCP reference, and configuration docs aligned with executable surfaces', async () => {
      const readme = readRepoFile('README.md');
      const gettingStarted = readRepoFile('docs/getting-started.md');
      const cliReference = readRepoFile('docs/cli-reference.md');
      const mcpReference = readRepoFile('docs/mcp-tools-reference.md');
      const configuration = readRepoFile('docs/configuration.md');
      const readmeZh = readRepoFile('README.zh.md');

      for (const link of README_DOC_LINKS) {
        expect(readme).toContain(link);
        expect(readIfExists(join(process.cwd(), link))).not.toBeNull();
      }
      for (const link of README_ZH_DOC_LINKS) {
        expect(readmeZh).toContain(link);
        expect(readIfExists(join(process.cwd(), link))).not.toBeNull();
      }
      expect(readme).toContain('deterministic beats inferential');
      expect(readmeZh).toContain('确定性优于推理性');
      expect(readme).toContain('img.shields.io/github/stars');

      const program = createProgram();
      expect(program.commands.map((command) => command.name()).sort()).toEqual(
        [...EXPECTED_CLI_COMMANDS].sort(),
      );
      for (const commandName of EXPECTED_CLI_COMMANDS) {
        expect(cliReference).toContain(`cord ${commandName}`);
      }

      const projectRoot = createTempProject('epic-6-mcp-docs');
      createdRoots.push(projectRoot);
      writeProjectFile(projectRoot, 'docs/overview.md', '# Overview\n\nSee [Notes](./notes.md).\n');
      writeProjectFile(projectRoot, 'docs/notes.md', '# Notes\n');
      const mcpServer = createCordMcpServer({ projectRoot });
      const client = new Client({
        name: 'cord-epic-6-docs-client',
        version: '1.0.0',
      });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([
        mcpServer.server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      const listedTools = await client.listTools();
      await clientTransport.close();
      await serverTransport.close();
      await mcpServer.close();
      const toolNames = listedTools.tools.map((tool) => tool.name).sort();

      expect(toolNames).toEqual(EXPECTED_MCP_TOOLS);
      for (const toolName of EXPECTED_MCP_TOOLS) {
        expect(mcpReference).toContain(`\`${toolName}\``);
      }
      expect(mcpReference).toContain('QueryRelationsResult');
      expect(mcpReference).toContain('relationId');
      expect(mcpReference).toContain('Single-Document Input Boundary');

      expect(configuration).toContain('cord.config.yaml');
      expect(configuration).toContain('cord.config.json');
      expect(configuration).toContain('YAML is the recommended format');
      expect(configuration).toContain('Zod `configSchema`');
      expect(gettingStarted).toContain('5 minutes');
      expect(gettingStarted).toContain('npx cord init --ide vscode-copilot');
      expect(gettingStarted).toContain('npx cord scan --rebuild --force');
      expect(gettingStarted).toContain('npx cord impact docs/getting-started.md');
    });

    it('executes the documented quick-start flow from init to first impact analysis', async () => {
      const projectRoot = createTempProject('epic-6-quick-start');
      createdRoots.push(projectRoot);
      mkdirSync(join(projectRoot, '.vscode'), { recursive: true });
      writeProjectFile(projectRoot, 'docs/overview.md', '# Overview\n\nSee [Notes](./notes.md).\n');
      writeProjectFile(projectRoot, 'docs/notes.md', '# Notes\n');

      const initStdout = createWriter();
      const initStderr = createWriter();
      await parseCommand(
        createInitCommand({
          cwd: () => projectRoot,
          isInteractive: () => false,
          stdout: initStdout,
          stderr: initStderr,
        }),
        ['init', '--json', '--ide', 'vscode-copilot'],
      );
      expect(process.exitCode ?? 0).toBe(0);
      expect(initStderr.read()).toBe('');
      expect(JSON.parse(initStdout.read())).toMatchObject({
        ide: 'vscode-copilot',
        framework: 'generic',
        configPath: join(projectRoot, 'cord.config.yaml'),
        dataDirectory: join(projectRoot, '.cord'),
      });

      const scanStdout = createWriter();
      const scanStderr = createWriter();
      await parseCommand(
        createScanCommand({
          cwd: () => projectRoot,
          stdout: scanStdout,
          stderr: scanStderr,
        }),
        ['scan', '--rebuild', '--force', '--json'],
      );
      expect(process.exitCode ?? 0).toBe(0);
      expect(scanStderr.read()).toBe('');
      expect(JSON.parse(scanStdout.read())).toMatchObject({
        documentsFound: expect.any(Number),
        relationsDiscovered: expect.any(Number),
        warnings: [],
      });

      const impactStdout = createWriter();
      const impactStderr = createWriter();
      await parseCommand(
        createImpactCommand({
          cwd: () => projectRoot,
          stdout: impactStdout,
          stderr: impactStderr,
        }),
        ['impact', 'docs/overview.md', '--json'],
      );
      expect(process.exitCode ?? 0).toBe(0);
      expect(impactStderr.read()).toBe('');
      expect(JSON.parse(impactStdout.read())).toMatchObject({
        impactedDocs: [
          expect.objectContaining({
            docPath: 'docs/notes.md',
            relationType: RELATION_TYPES.REFERENCES,
            updateStrategy: 'suggest',
          }),
        ],
        totalCount: expect.any(Number),
      });
    });
  });
});
