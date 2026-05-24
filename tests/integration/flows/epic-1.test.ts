import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdapterError,
  ConfigError,
  CordError,
  Logger,
  QueryError,
  RELATION_TYPES,
  ScanError,
  SqliteGraphRepository,
  StorageError,
  scanInputSchema,
  toJsonSchema,
  validateScanInput,
} from '../../../src/index.js';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

function projectPath(path: string): string {
  return join(projectRoot, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), 'utf8');
}

function readProjectJson<T>(path: string): T {
  return JSON.parse(readProjectFile(path)) as T;
}

describe('Epic 1 end-to-end readiness', () => {
  describe('Story 1.1 project initialization and directory structure', () => {
    it('keeps the D5 source and test skeleton in place', () => {
      const requiredDirectories = [
        'src/cli',
        'src/mcp',
        'src/services',
        'src/repositories',
        'src/scanner',
        'src/adapters',
        'src/schemas',
        'src/utils',
        'src/types',
        'tests/unit',
        'tests/integration',
        'tests/fixtures',
      ];

      for (const directory of requiredDirectories) {
        expect(existsSync(projectPath(directory)), directory).toBe(true);
      }
    });

    it('exposes project tooling required by the bootstrap story', () => {
      const packageJson = readProjectJson<{
        type: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      }>('package.json');
      const tsconfig = readProjectJson<{ compilerOptions: Record<string, unknown> }>('tsconfig.json');
      const tsupConfig = readProjectFile('tsup.config.ts');

      expect(packageJson.type).toBe('module');
      expect(packageJson.scripts).toMatchObject({
        build: 'tsup',
        test: 'vitest run',
        lint: 'eslint .',
        'type-check': 'tsc --noEmit -p tsconfig.check.json',
      });
      expect(Object.keys(packageJson.dependencies)).toEqual(
        expect.arrayContaining([
          'commander',
          '@clack/prompts',
          'chalk',
          'better-sqlite3',
          '@modelcontextprotocol/sdk',
          'unified',
          'remark-parse',
          'remark-frontmatter',
          'remark-gfm',
          'zod',
        ]),
      );
      expect(packageJson.devDependencies).toHaveProperty('vitest');
      expect(tsconfig.compilerOptions).toMatchObject({
        strict: true,
        target: 'ESNext',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
      });
      expect(tsupConfig).toContain("'cli/index': 'src/cli/index.ts'");
      expect(tsupConfig).toContain("'mcp/server': 'src/mcp/server.ts'");
    });
  });

  describe('Story 1.2 CordError and Logger system', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      delete process.env['CORD_DEBUG'];
      delete process.env['CORD_MCP_MODE'];
    });

    it('exports a consistent CordError hierarchy with stable code format', () => {
      const errors = [
        new ScanError({ message: 'scan failed', suggestion: 'check path' }),
        new QueryError({ message: 'query failed', suggestion: 'check id' }),
        new ConfigError({ message: 'config failed', suggestion: 'check config' }),
        new StorageError({ message: 'storage failed', suggestion: 'check db' }),
        new AdapterError({ message: 'adapter failed', suggestion: 'check adapter' }),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(CordError);
        expect(error.code).toMatch(/^CORD_[A-Z]+_\d{3}$/);
        expect(error.suggestion.length).toBeGreaterThan(0);
        expect(error.context).toEqual({});
      }
    });

    it('keeps MCP logger output on stderr and suppresses debug by default', () => {
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const logger = new Logger({ mode: 'mcp' });

      logger.debug('hidden debug');
      logger.info('visible info');

      expect(stdoutWrite).not.toHaveBeenCalled();
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stderrWrite.mock.calls[0]?.[0]).toContain('visible info');
    });
  });

  describe('Story 1.3 Zod validation layer and core types', () => {
    it('validates scan input and wraps invalid payloads in ConfigError', () => {
      const validInput = validateScanInput({ projectRoot });

      expect(validInput).toMatchObject({
        projectRoot,
        rebuild: false,
        force: false,
      });
      expect(() => validateScanInput({ projectRoot: 'relative/path' })).toThrow(ConfigError);
    });

    it('publishes relation types and JSON Schema export from shared schemas', () => {
      const relationTypes = Object.values(RELATION_TYPES);
      const jsonSchema = toJsonSchema(scanInputSchema, 'ScanInput');

      expect(relationTypes).toHaveLength(9);
      expect(relationTypes).toEqual(
        expect.arrayContaining([
          'sync_required',
          'context_for',
          'lifecycle_bound',
          'contains',
          'must_consistent',
          'sync_suggested',
          'derived_from',
          'deprecated',
          'references',
        ]),
      );
      expect(JSON.stringify(jsonSchema)).toContain('projectRoot');
    });
  });

  describe('Story 1.4 SQLite storage and migration flow', () => {
    it('runs migrations and persists graph data across repository reopen', () => {
      const root = mkdtempSync(join(tmpdir(), 'cord-epic-1-'));
      const dbPath = join(root, 'cord.db');

      try {
        const repo = new SqliteGraphRepository(dbPath);
        const source = repo.addDocument({
          path: 'docs/source.md',
          title: 'Source',
          docType: 'architecture',
          framework: 'bmad',
          contentHash: 'source-hash',
          metadata: { story: '1.4' },
        });
        const target = repo.addDocument({
          path: 'docs/target.md',
          title: 'Target',
          docType: 'story',
          framework: 'bmad',
          contentHash: 'target-hash',
          metadata: { story: '1.4' },
        });

        repo.addRelation({
          sourceDocId: source.id,
          targetDocId: target.id,
          relationType: RELATION_TYPES.REFERENCES,
          confidence: 0.9,
          source: 'manual',
          status: 'active',
          metadata: { reason: 'epic-1-flow' },
        });
        repo.upsertSyncState({
          docId: source.id,
          lastScannedAt: '2026-05-24T00:00:00.000Z',
          lastObservedMtimeMs: 1000,
          contentHash: 'source-hash',
          status: 'synced',
        });
        expect(repo.getMigrationVersion()).toBeGreaterThanOrEqual(3);
        repo.close();

        const reopened = new SqliteGraphRepository(dbPath);
        expect(reopened.getDocumentCount()).toBe(2);
        expect(reopened.getRelationCount()).toBe(1);
        expect(reopened.getDocumentByPath('docs/source.md')?.metadata).toEqual({ story: '1.4' });
        expect(reopened.getRelationsByDocId(source.id, 'source')[0]).toMatchObject({
          targetDocId: target.id,
          relationType: RELATION_TYPES.REFERENCES,
          source: 'manual',
          status: 'active',
        });
        expect(reopened.getSyncState(source.id)?.contentHash).toBe('source-hash');
        reopened.close();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe('Story 1.5 CI/CD pipeline and quality gates', () => {
    it('keeps CI, release, and cross-platform workflows wired to quality gates', () => {
      const ciWorkflow = readProjectFile('.github/workflows/ci.yml');
      const releaseWorkflow = readProjectFile('.github/workflows/release.yml');
      const crossPlatformWorkflow = readProjectFile('.github/workflows/cross-platform.yml');
      const vitestConfig = readProjectFile('vitest.config.ts');

      expect(ciWorkflow).toContain('npm run lint');
      expect(ciWorkflow).toContain('npm run type-check');
      expect(ciWorkflow).toContain('npm run build');
      expect(ciWorkflow).toContain('npm run test:coverage');
      expect(releaseWorkflow).toContain('workflow_run');
      expect(releaseWorkflow).toContain('contents: write');
      expect(releaseWorkflow).toContain('id-token: write');
      expect(releaseWorkflow).toContain('NPM_CONFIG_PROVENANCE: true');
      expect(releaseWorkflow).toContain('npx semantic-release');
      expect(crossPlatformWorkflow).toContain('ubuntu-latest');
      expect(crossPlatformWorkflow).toContain('macos-latest');
      expect(crossPlatformWorkflow).toContain('windows-latest');
      expect(crossPlatformWorkflow).toContain('better-sqlite3');
      expect(vitestConfig).toContain('lines: 80');
      expect(vitestConfig).toContain('functions: 80');
      expect(vitestConfig).toContain('branches: 80');
      expect(vitestConfig).toContain('statements: 80');
    });

    it('keeps issue and pull request collaboration templates available', () => {
      expect(existsSync(projectPath('.github/ISSUE_TEMPLATE/bug-report.yml'))).toBe(true);
      expect(existsSync(projectPath('.github/ISSUE_TEMPLATE/feature-request.yml'))).toBe(true);
      expect(readProjectFile('.github/PULL_REQUEST_TEMPLATE.md')).toContain('覆盖率未下降');
    });
  });
});
