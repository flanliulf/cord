import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BmadFrameworkAdapter } from '../../../../../src/adapters/framework/bmad/adapter.js';
import { BMAD_DOCUMENT_TYPES } from '../../../../../src/adapters/framework/bmad/doc-types.js';
import { BMAD_PRESET_RULES } from '../../../../../src/adapters/framework/bmad/preset-rules.js';

function createDetectedProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), 'cord-bmad-adapter-'));

  mkdirSync(join(projectRoot, '_bmad'), { recursive: true });
  mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });

  return projectRoot;
}

describe('BmadFrameworkAdapter', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('exposes the BMAD declarative document types and preset rules', () => {
    const adapter = new BmadFrameworkAdapter();

    expect(adapter.name).toBe('bmad');
    expect(adapter.getDocumentTypes()).toEqual(BMAD_DOCUMENT_TYPES);
    expect(adapter.getPresetRules()).toEqual(BMAD_PRESET_RULES);
  });

  it('detects BMAD projects through the multi-layer detector', () => {
    const adapter = new BmadFrameworkAdapter();
    const projectRoot = createDetectedProject();
    createdRoots.push(projectRoot);

    expect(adapter.detectFramework(projectRoot)).toBe(true);
  });

  it('inherits root scanning and excludes BMAD template directories by default', () => {
    const adapter = new BmadFrameworkAdapter();

    expect(adapter.getScanPaths({})).toEqual(['.']);
    expect(adapter.getExcludePaths({})).toEqual(['src/', 'node_modules/', '.git/', 'dist/', '_bmad/']);
  });
});