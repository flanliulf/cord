import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

  it('does not throw when a skills path exists but cannot be read as a directory', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'skills'), 'not a directory');

    expect(collectBmadDetectionSignals(projectRoot)).toEqual(['bmad-output-directory']);
  });

  it('only accepts standalone YAML frontmatter closing delimiters', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'docs', 'bad-context.md'),
      ['---', 'project_name: Demo', '---not-a-delimiter', '', '# Context'].join('\n'),
    );

    expect(collectBmadDetectionSignals(projectRoot)).toEqual(['bmad-output-directory']);
  });

  it('accepts CRLF frontmatter with standalone delimiters', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'docs', 'context.md'),
      ['---', 'project_name: Demo', 'user_name: Tester', '---', '', '# Context'].join('\r\n'),
    );

    expect(collectBmadDetectionSignals(projectRoot)).toEqual([
      'bmad-output-directory',
      'bmad-frontmatter',
    ]);
  });

  it.runIf(process.platform !== 'win32')('does not throw when markdown candidate directories cannot be read', () => {
    const projectRoot = createTempProject();
    const unreadableDirectory = join(projectRoot, 'docs');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(unreadableDirectory, { recursive: true });
    writeFileSync(join(unreadableDirectory, 'context.md'), ['---', 'project_name: Demo', '---'].join('\n'));
    chmodSync(unreadableDirectory, 0o000);

    try {
      expect(collectBmadDetectionSignals(projectRoot)).toEqual(['bmad-output-directory']);
    } finally {
      chmodSync(unreadableDirectory, 0o700);
    }
  });

  it('prioritizes high-value frontmatter paths before root markdown files exhaust the scan budget', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '_bmad-output'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    for (let index = 0; index < 70; index += 1) {
      writeFileSync(join(projectRoot, `root-${String(index).padStart(2, '0')}.md`), '# filler');
    }

    writeFileSync(
      join(projectRoot, 'docs', 'context.md'),
      ['---', 'project_name: Demo', 'user_name: Tester', '---', '', '# Context'].join('\n'),
    );

    expect(collectBmadDetectionSignals(projectRoot)).toEqual([
      'bmad-output-directory',
      'bmad-frontmatter',
    ]);
  });
});