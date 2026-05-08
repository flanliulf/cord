import { describe, expect, it } from 'vitest';
import { RELATION_TYPES } from '../../../../../src/types/index.js';
import { BMAD_PRESET_RULES } from '../../../../../src/adapters/framework/bmad/preset-rules.js';

describe('BMAD_PRESET_RULES', () => {
  it('keeps every preset relation at or above the BMAD confidence floor', () => {
    expect(BMAD_PRESET_RULES.length).toBeGreaterThan(0);

    for (const rule of BMAD_PRESET_RULES) {
      expect(rule.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('includes the core BMAD relationship presets used by the product flows', () => {
    expect(BMAD_PRESET_RULES).toEqual(
      expect.arrayContaining([
        {
          sourceDocType: 'prd',
          targetDocType: 'architecture',
          relationType: RELATION_TYPES.SYNC_REQUIRED,
          confidence: 0.95,
        },
        {
          sourceDocType: 'epic',
          targetDocType: 'story',
          relationType: RELATION_TYPES.CONTAINS,
          confidence: 0.95,
        },
        {
          sourceDocType: 'sprint-plan',
          targetDocType: 'story',
          relationType: RELATION_TYPES.LIFECYCLE_BOUND,
          confidence: 0.9,
        },
        {
          sourceDocType: 'project-context',
          targetDocType: '*',
          relationType: RELATION_TYPES.CONTEXT_FOR,
          confidence: 0.9,
        },
        {
          sourceDocType: 'product-brief',
          targetDocType: 'prd',
          relationType: RELATION_TYPES.DERIVED_FROM,
          confidence: 0.9,
        },
      ]),
    );
  });
});