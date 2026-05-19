import { RELATION_TYPES } from '../../../types/index.js';
import type { PresetRule } from '../interfaces.js';

/**
 * BMAD 框架的声明式预设关系规则。
 *
 * 贡献者可复制此结构表达框架内稳定关系；不稳定或只在单个项目成立的关系，
 * 应由内容扫描或手动关系管理处理，而不是写成全局预设。
 */
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