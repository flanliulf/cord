import { RELATION_TYPES } from '../../../types/index.js';
import type { PresetRule } from '../interfaces.js';

/** BMAD 框架的声明式预设关系规则。 */
export const BMAD_PRESET_RULES: PresetRule[] = [
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
    sourceDocType: 'prd',
    targetDocType: 'epic',
    relationType: RELATION_TYPES.DERIVED_FROM,
    confidence: 0.9,
  },
  {
    sourceDocType: 'architecture',
    targetDocType: 'epic',
    relationType: RELATION_TYPES.CONTEXT_FOR,
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
  {
    sourceDocType: 'technical-research',
    targetDocType: 'architecture',
    relationType: RELATION_TYPES.CONTEXT_FOR,
    confidence: 0.9,
  },
  {
    sourceDocType: 'brainstorming',
    targetDocType: 'product-brief',
    relationType: RELATION_TYPES.DERIVED_FROM,
    confidence: 0.9,
  },
  {
    sourceDocType: 'prd',
    targetDocType: 'ux-design',
    relationType: RELATION_TYPES.SYNC_REQUIRED,
    confidence: 0.9,
  },
];