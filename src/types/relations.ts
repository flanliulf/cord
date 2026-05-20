/**
 * CORD 关系类型定义 — 9 种文档传播行为类型（P9 规范）。
 *
 * 关系类型值使用 snake_case（P9 约定）。
 */

/** 所有受支持的关系类型常量映射。 */
export const RELATION_TYPES = {
  /** 强制同步：源文档更新后目标文档必须同步更新。 */
  SYNC_REQUIRED: 'sync_required',
  /** 上下文依赖：目标文档为源文档提供背景信息。 */
  CONTEXT_FOR: 'context_for',
  /** 生命周期绑定：源文档与目标文档生命周期一致。 */
  LIFECYCLE_BOUND: 'lifecycle_bound',
  /** 包含关系：源文档在逻辑上包含目标文档。 */
  CONTAINS: 'contains',
  /** 强一致性：源文档与目标文档内容必须保持一致。 */
  MUST_CONSISTENT: 'must_consistent',
  /** 建议同步：源文档更新后建议同步目标文档（非强制）。 */
  SYNC_SUGGESTED: 'sync_suggested',
  /** 派生关系：目标文档从源文档派生而来。 */
  DERIVED_FROM: 'derived_from',
  /** 已废弃：源文档已被目标文档取代；关系下线优先使用 status='deprecated'。 */
  DEPRECATED: 'deprecated',
  /** 引用关系：源文档引用目标文档（弱依赖）。 */
  REFERENCES: 'references',
} as const;

/** 关系类型的联合类型，从 RELATION_TYPES 推导。 */
export type RelationType = (typeof RELATION_TYPES)[keyof typeof RELATION_TYPES];

/** 关系状态；deprecated 是独立状态位，不改变 relationType。 */
export type RelationStatus = 'active' | 'deprecated';

export type RelationImpactPropagationDirection = 'source_to_target';

export interface RelationImpactPropagationRule {
  direction: RelationImpactPropagationDirection;
  traversableStatuses: readonly RelationStatus[];
}

const ACTIVE_RELATION_STATUSES = ['active'] as const satisfies readonly RelationStatus[];

/**
 * ImpactService 的 relationType 级传播矩阵。
 *
 * v0.1 明确所有内置 relationType 均按 source -> target 传播，且仅 active 关系可传播。
 */
export const RELATION_IMPACT_PROPAGATION_MATRIX = {
  [RELATION_TYPES.SYNC_REQUIRED]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.CONTEXT_FOR]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.LIFECYCLE_BOUND]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.CONTAINS]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.MUST_CONSISTENT]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.SYNC_SUGGESTED]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.DERIVED_FROM]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.DEPRECATED]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
  [RELATION_TYPES.REFERENCES]: {
    direction: 'source_to_target',
    traversableStatuses: ACTIVE_RELATION_STATUSES,
  },
} as const satisfies Record<RelationType, RelationImpactPropagationRule>;
