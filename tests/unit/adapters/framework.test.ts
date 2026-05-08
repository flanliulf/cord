import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AbstractFrameworkAdapter,
  BmadFrameworkAdapter,
  GenericFrameworkAdapter,
  resolveAdapter,
  frameworkAdapters,
  type DocTypeDefinition,
  type IFrameworkAdapter,
  type PresetRule,
} from '../../../src/adapters/framework/index.js';
import type { CordConfig } from '../../../src/types/index.js';
import { ConfigError } from '../../../src/utils/index.js';

class TestFrameworkAdapter extends AbstractFrameworkAdapter {
  readonly name = 'test';

  detectFramework(): boolean {
    return false;
  }

  getDocumentTypes(): DocTypeDefinition[] {
    return [];
  }

  getPresetRules(): PresetRule[] {
    return [];
  }
}

class DetectingAdapter extends TestFrameworkAdapter {
  constructor(
    readonly name: string,
    private readonly detected: boolean,
  ) {
    super();
  }

  override detectFramework(): boolean {
    return this.detected;
  }
}

function createFixtureProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), 'cord-framework-'));

  mkdirSync(join(projectRoot, 'docs'), { recursive: true });
  mkdirSync(join(projectRoot, 'notes', 'private'), { recursive: true });
  mkdirSync(join(projectRoot, 'src'), { recursive: true });
  mkdirSync(join(projectRoot, 'node_modules', 'pkg'), { recursive: true });
  mkdirSync(join(projectRoot, '.git'), { recursive: true });
  mkdirSync(join(projectRoot, 'dist'), { recursive: true });

  writeFileSync(join(projectRoot, 'README.md'), '# root');
  writeFileSync(join(projectRoot, 'docs', 'guide.md'), '# docs');
  writeFileSync(join(projectRoot, 'notes', 'design.md'), '# notes');
  writeFileSync(join(projectRoot, 'notes', 'private', 'secret.md'), '# secret');
  writeFileSync(join(projectRoot, 'src', 'ignored.md'), '# ignored');
  writeFileSync(join(projectRoot, 'node_modules', 'pkg', 'ignored.md'), '# ignored');
  writeFileSync(join(projectRoot, '.git', 'ignored.md'), '# ignored');
  writeFileSync(join(projectRoot, 'dist', 'ignored.md'), '# ignored');
  writeFileSync(join(projectRoot, 'docs', 'diagram.txt'), 'not markdown');

  return projectRoot;
}

function createDirectorySymlink(targetPath: string, symlinkPath: string): void {
  symlinkSync(targetPath, symlinkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function toRelativePaths(projectRoot: string, filePaths: string[]): string[] {
  return filePaths.map((filePath) => relative(projectRoot, filePath).replaceAll('\\', '/')).sort();
}

describe('GenericFrameworkAdapter', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { force: true, recursive: true });
    }
  });

  it('satisfies the IFrameworkAdapter contract and exposes empty declarative definitions', () => {
    const adapter: IFrameworkAdapter = new GenericFrameworkAdapter();

    expect(adapter.name).toBe('generic');
    expect(adapter.detectFramework('/tmp/project')).toBe(true);
    expect(adapter.getDocumentTypes()).toEqual([]);
    expect(adapter.getPresetRules()).toEqual([]);
  });

  it('uses project-root scan by default and merges default exclude paths with user overrides', () => {
    const adapter = new GenericFrameworkAdapter();

    expect(adapter.getScanPaths({})).toEqual(['.']);
    expect(adapter.getExcludePaths({ excludePaths: ['notes/private/'] })).toEqual([
      'src/',
      'node_modules/',
      '.git/',
      'dist/',
      'notes/private/',
    ]);
  });

  it('discovers markdown documents only inside scanPaths and excludes configured directories', () => {
    const adapter = new GenericFrameworkAdapter();
    const projectRoot = createFixtureProject();
    createdRoots.push(projectRoot);

    const filePaths = adapter.discoverDocuments(
      projectRoot,
      adapter.getScanPaths({}),
      adapter.getExcludePaths({}),
    );

    expect(toRelativePaths(projectRoot, filePaths)).toEqual([
      'README.md',
      'docs/guide.md',
      'notes/design.md',
      'notes/private/secret.md',
    ]);
  });

  it('respects custom scanPaths and excludePaths from cord.config', () => {
    const adapter = new GenericFrameworkAdapter();
    const projectRoot = createFixtureProject();
    createdRoots.push(projectRoot);
    const config: CordConfig = {
      scanPaths: ['docs', 'notes'],
      excludePaths: ['notes/private/'],
    };

    const filePaths = adapter.discoverDocuments(
      projectRoot,
      adapter.getScanPaths(config),
      adapter.getExcludePaths(config),
    );

    expect(toRelativePaths(projectRoot, filePaths)).toEqual(['docs/guide.md', 'notes/design.md']);
  });

  it('does not scan markdown files through symlinks that point outside the project root', () => {
    const adapter = new GenericFrameworkAdapter();
    const projectRoot = createFixtureProject();
    const externalRoot = mkdtempSync(join(tmpdir(), 'cord-framework-external-'));
    createdRoots.push(projectRoot, externalRoot);

    writeFileSync(join(externalRoot, 'outside.md'), '# external');
    createDirectorySymlink(externalRoot, join(projectRoot, 'external-link'));

    const filePaths = adapter.discoverDocuments(
      projectRoot,
      adapter.getScanPaths({}),
      adapter.getExcludePaths({}),
    );

    expect(toRelativePaths(projectRoot, filePaths)).not.toContain('external-link/outside.md');
  });

  it('skips cyclic symlinks without recursing into duplicated project paths', () => {
    const adapter = new GenericFrameworkAdapter();
    const projectRoot = createFixtureProject();
    createdRoots.push(projectRoot);

    createDirectorySymlink(projectRoot, join(projectRoot, 'loop'));

    const filePaths = adapter.discoverDocuments(
      projectRoot,
      adapter.getScanPaths({}),
      adapter.getExcludePaths({}),
    );

    expect(toRelativePaths(projectRoot, filePaths)).toEqual([
      'README.md',
      'docs/guide.md',
      'notes/design.md',
      'notes/private/secret.md',
    ]);
  });
});

describe('resolveAdapter', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { force: true, recursive: true });
    }
  });

  it('keeps GenericFrameworkAdapter at the end of the declarative registry', () => {
    expect(frameworkAdapters.at(-1)?.name).toBe('generic');
  });

  it('registers the BMAD adapter ahead of the generic fallback in the default registry', () => {
    expect(frameworkAdapters.at(0)).toBeInstanceOf(BmadFrameworkAdapter);
    expect(frameworkAdapters.map((adapter) => adapter.name)).toEqual(['bmad', 'generic']);
  });

  it('returns the explicitly configured adapter when framework is specified', () => {
    const adapter = resolveAdapter({ framework: 'generic' }, '/tmp/project');

    expect(adapter.name).toBe('generic');
  });

  it('uses the first detected adapter before falling back to generic', () => {
    const registry = [
      new DetectingAdapter('first', false),
      new DetectingAdapter('second', true),
      new GenericFrameworkAdapter(),
    ];

    const adapter = resolveAdapter({}, '/tmp/project', registry);

    expect(adapter.name).toBe('second');
  });

  it('falls back to generic when no specific adapter matches', () => {
    const registry = [new DetectingAdapter('first', false), new GenericFrameworkAdapter()];

    const adapter = resolveAdapter({}, '/tmp/project', registry);

    expect(adapter.name).toBe('generic');
  });

  it('auto-detects BMAD projects before generic fallback when using the default registry', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-framework-bmad-'));
    createdRoots.push(projectRoot);

    mkdirSync(join(projectRoot, '_bmad'), { recursive: true });
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });

    const adapter = resolveAdapter({}, projectRoot);

    expect(adapter.name).toBe('bmad');
  });

  it('throws ConfigError when the configured adapter name is unknown', () => {
    expect(() => resolveAdapter({ framework: 'missing' }, '/tmp/project')).toThrow(ConfigError);
  });
});