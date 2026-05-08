import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BmadFrameworkAdapter } from '../../../../../src/adapters/framework/bmad/adapter.js';
import { BMAD_DOCUMENT_TYPES } from '../../../../../src/adapters/framework/bmad/doc-types.js';

const REPO_ROOT = process.cwd();
const REAL_REPO_SAMPLES: Record<string, string> = {
  prd: '_bmad-output/planning-artifacts/prd.md',
  architecture: '_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md',
  epic: '_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md',
  story: '_bmad-output/implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md',
  'technical-research': '_bmad-output/planning-artifacts/research/technical-research-roadmap.md',
  'domain-research': '_bmad-output/planning-artifacts/research/archive/domain-cord-ecosystem-technology-growth-research-2026-03-30.md',
  'market-research': '_bmad-output/planning-artifacts/research/archive/market-cord-ai-doc-relation-management-research-2026-03-30.md',
  'product-brief': '_bmad-output/planning-artifacts/product-brief-cord.md',
  'project-context': '_bmad-output/project-context.md',
  brainstorming: '_bmad-output/brainstorming/brainstorming-session-2026-03-29-001.md',
  retrospective: '_bmad-output/implementation-artifacts/retrospectives/epic-1-retro-2026-05-06.md',
  index: '_bmad-output/planning-artifacts/epics/index.md',
  'validation-report': '_bmad-output/planning-artifacts/prd-validation-report.md',
  distillate: '_bmad-output/planning-artifacts/product-brief-cord-distillate.md',
};
const NON_BMAD_TEMPLATE_PATHS = [
  '_bmad/core/bmad-advanced-elicitation/SKILL.md',
  '_bmad/bmm/4-implementation/bmad-code-review/workflow.md',
  '_bmad/bmm/4-implementation/bmad-dev-story/checklist.md',
];

function toRelativePaths(projectRoot: string, filePaths: string[]): string[] {
  return filePaths.map((filePath) => relative(projectRoot, filePath).replaceAll('\\', '/')).sort();
}

function matchDocTypes(relativePath: string): string[] {
  return BMAD_DOCUMENT_TYPES.filter((docType) =>
    docType.patterns.some((pattern) => globToRegExp(pattern).test(relativePath)),
  ).map((docType) => docType.name);
}

function globToRegExp(pattern: string): RegExp {
  const source = pattern
    .replaceAll('[0-9]', '__DIGIT__')
    .replaceAll('**/', '__DOUBLE_STAR_DIR__')
    .replaceAll('**', '__DOUBLE_STAR__')
    .replaceAll('*', '__STAR__')
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replaceAll('__DOUBLE_STAR_DIR__', '(?:.*/)?')
    .replaceAll('__DOUBLE_STAR__', '.*')
    .replaceAll('__STAR__', '[^/]*')
    .replaceAll('__DIGIT__', '[0-9]');

  return new RegExp(`^${source}$`);
}

describe('BMAD document classification', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('detects the current repository as BMAD and matches real BMAD files that exist today', () => {
    const adapter = new BmadFrameworkAdapter();

    expect(adapter.detectFramework(REPO_ROOT)).toBe(true);

    const discovered = toRelativePaths(
      REPO_ROOT,
      adapter.discoverDocuments(REPO_ROOT, adapter.getScanPaths({}), adapter.getExcludePaths({})),
    );

    for (const [docType, samplePath] of Object.entries(REAL_REPO_SAMPLES)) {
      expect(existsSync(join(REPO_ROOT, samplePath))).toBe(true);
      expect(discovered).toContain(samplePath);
      expect(matchDocTypes(samplePath)).toContain(docType);
    }
  });

  it('does not scan _bmad template markdown files as BMAD document candidates', () => {
    const adapter = new BmadFrameworkAdapter();
    const discovered = toRelativePaths(
      REPO_ROOT,
      adapter.discoverDocuments(REPO_ROOT, adapter.getScanPaths({}), adapter.getExcludePaths({})),
    );

    for (const templatePath of NON_BMAD_TEMPLATE_PATHS) {
      expect(existsSync(join(REPO_ROOT, templatePath))).toBe(true);
      expect(discovered).not.toContain(templatePath);
    }
  });

  it('covers sprint-plan and ux-design with fixture files because this repo has no live examples yet', () => {
    const adapter = new BmadFrameworkAdapter();
    const projectRoot = mkdtempSync(join(tmpdir(), 'cord-bmad-classification-'));
    createdRoots.push(projectRoot);

    mkdirSync(join(projectRoot, '_bmad-output', 'planning-artifacts'), { recursive: true });
    writeFileSync(
      join(projectRoot, '_bmad-output', 'planning-artifacts', 'sprint-plan-demo.md'),
      '# Sprint Plan',
    );
    writeFileSync(
      join(projectRoot, '_bmad-output', 'planning-artifacts', 'ux-design-spec.md'),
      '# UX Design',
    );

    const discovered = toRelativePaths(
      projectRoot,
      adapter.discoverDocuments(projectRoot, adapter.getScanPaths({}), adapter.getExcludePaths({})),
    );

    expect(discovered).toContain('_bmad-output/planning-artifacts/sprint-plan-demo.md');
    expect(discovered).toContain('_bmad-output/planning-artifacts/ux-design-spec.md');
    expect(matchDocTypes('_bmad-output/planning-artifacts/sprint-plan-demo.md')).toContain('sprint-plan');
    expect(matchDocTypes('_bmad-output/planning-artifacts/ux-design-spec.md')).toContain('ux-design');
  });
});