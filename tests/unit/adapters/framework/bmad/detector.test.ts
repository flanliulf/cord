import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BMAD_DETECTION_THRESHOLD,
  collectBmadDetectionSignals,
  detectBmadFramework,
} from '../../../../../src/adapters/framework/bmad/detector.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'cord-bmad-detector-'));
}

describe('BMAD detector', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('uses a two-signal threshold before declaring a BMAD project', () => {
    expect(BMAD_DETECTION_THRESHOLD).toBe(2);

    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '_bmad'), { recursive: true });

    expect(detectBmadFramework(projectRoot)).toBe(false);

    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });

    expect(detectBmadFramework(projectRoot)).toBe(true);
  });

  it('collects all five BMAD detection layers when the corresponding signals exist', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);

    mkdirSync(join(projectRoot, '_bmad'), { recursive: true });
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(join(projectRoot, '.claude', 'skills'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'skills', 'bmad-example.md'), '# skill');
    writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ dependencies: { 'bmad-helper': '^1.0.0' } }),
    );
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'docs', 'project-context.md'),
      ['---', 'project_name: Demo', 'sections_completed: [a]', '---', '', '# Context'].join('\n'),
    );

    expect(collectBmadDetectionSignals(projectRoot)).toEqual([
      'bmad-directory',
      'bmad-output-directory',
      'bmad-skills-directory',
      'bmad-package-json',
      'bmad-frontmatter',
    ]);
  });

  it('treats BMAD-style frontmatter as an independent signal', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);

    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'docs', 'context.md'),
      ['---', 'project_name: Demo', 'user_name: Tester', '---', '', '# Context'].join('\n'),
    );

    expect(collectBmadDetectionSignals(projectRoot)).toEqual([
      'bmad-output-directory',
      'bmad-frontmatter',
    ]);
    expect(detectBmadFramework(projectRoot)).toBe(true);
  });
});