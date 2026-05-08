import { describe, expect, it } from 'vitest';
import type { DocTypeDefinition } from '../../../../../src/adapters/framework/index.js';
import { BMAD_DOCUMENT_TYPES } from '../../../../../src/adapters/framework/bmad/doc-types.js';

function indexByName(docTypes: DocTypeDefinition[]): Map<string, DocTypeDefinition> {
  return new Map(docTypes.map((docType) => [docType.name, docType]));
}

describe('BMAD_DOCUMENT_TYPES', () => {
  it('defines 16 markdown-only BMAD document types for v0.1', () => {
    expect(BMAD_DOCUMENT_TYPES).toHaveLength(16);

    const docTypeNames = BMAD_DOCUMENT_TYPES.map((docType) => docType.name);

    expect(docTypeNames).toEqual([
      'prd',
      'architecture',
      'epic',
      'story',
      'sprint-plan',
      'technical-research',
      'domain-research',
      'market-research',
      'product-brief',
      'project-context',
      'brainstorming',
      'ux-design',
      'retrospective',
      'index',
      'validation-report',
      'distillate',
    ]);
    expect(docTypeNames).not.toContain('sprint-status');
    expect(docTypeNames).not.toContain('config');
  });

  it('keeps the expected glob patterns for representative BMAD document categories', () => {
    const docTypesByName = indexByName(BMAD_DOCUMENT_TYPES);

    expect(docTypesByName.get('prd')?.patterns).toEqual(['**/prd*.md']);
    expect(docTypesByName.get('architecture')?.patterns).toEqual([
      '**/*architecture*.md',
      '**/architecture/**/*.md',
    ]);
    expect(docTypesByName.get('epic')?.patterns).toEqual(['**/epics/epic*.md']);
    expect(docTypesByName.get('story')?.patterns).toEqual(['**/[0-9]-[0-9]-*.md']);
    expect(docTypesByName.get('retrospective')?.patterns).toEqual([
      '**/retrospective*.md',
      '**/retrospectives/**/*.md',
    ]);
    expect(docTypesByName.get('validation-report')?.patterns).toEqual(['**/*validation*.md']);
    expect(docTypesByName.get('distillate')?.patterns).toEqual(['**/*distillat*.md']);
  });
});