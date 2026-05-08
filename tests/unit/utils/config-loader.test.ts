import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/utils/config-loader.js';
import { ConfigError } from '../../../src/utils/index.js';

function createProjectRoot(): string {
  return mkdtempSync(join(tmpdir(), 'cord-config-loader-'));
}

describe('loadConfig', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('returns default config when no config file exists', () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);

    expect(loadConfig(projectRoot)).toEqual({
      scanPaths: ['.'],
      excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
      confidenceThreshold: 0.5,
    });
  });

  it('prefers cord.config.yaml over cord.config.json and merges defaults', () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);

    writeFileSync(
      join(projectRoot, 'cord.config.json'),
      JSON.stringify({ framework: 'generic', confidenceThreshold: 0.2 }),
      'utf-8',
    );
    writeFileSync(
      join(projectRoot, 'cord.config.yaml'),
      ['framework: bmad', 'scanPaths:', '  - docs', 'relationTypes:', '  deprecated:', '    enabled: false'].join('\n'),
      'utf-8',
    );

    expect(loadConfig(projectRoot)).toEqual({
      framework: 'bmad',
      scanPaths: ['docs'],
      excludePaths: ['src/', 'node_modules/', '.git/', 'dist/'],
      confidenceThreshold: 0.5,
      relationTypes: {
        deprecated: {
          enabled: false,
        },
      },
    });
  });

  it('loads cord.config.json when yaml is absent', () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);

    writeFileSync(
      join(projectRoot, 'cord.config.json'),
      JSON.stringify({
        scanPaths: ['docs', 'knowledge'],
        excludePaths: ['notes/private/'],
        confidenceThreshold: 0.8,
        adapters: ['bmad'],
      }),
      'utf-8',
    );

    expect(loadConfig(projectRoot)).toEqual({
      scanPaths: ['docs', 'knowledge'],
      excludePaths: ['notes/private/'],
      confidenceThreshold: 0.8,
      adapters: ['bmad'],
    });
  });

  it('throws ConfigError when config schema validation fails', () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);

    writeFileSync(
      join(projectRoot, 'cord.config.yaml'),
      ['confidenceThreshold: 1.5', 'relationTypes:', '  custom_type:', '    enabled: true'].join('\n'),
      'utf-8',
    );

    expect(() => loadConfig(projectRoot)).toThrow(ConfigError);
  });

  it('parses yaml config files stored in nested fixture-like project roots', () => {
    const projectRoot = createProjectRoot();
    createdRoots.push(projectRoot);

    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'cord.config.yaml'),
      ['excludePaths:', '  - docs/private/', 'ide: cursor'].join('\n'),
      'utf-8',
    );

    expect(loadConfig(projectRoot)).toEqual({
      ide: 'cursor',
      scanPaths: ['.'],
      excludePaths: ['docs/private/'],
      confidenceThreshold: 0.5,
    });
  });
});