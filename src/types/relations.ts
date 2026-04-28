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
  /** 已废弃：源文档已被目标文档取代或本关系已失效。 */
  DEPRECATED: 'deprecated',
  /** 引用关系：源文档引用目标文档（弱依赖）。 */
  REFERENCES: 'references',
} as const;

/** 关系类型的联合类型，从 RELATION_TYPES 推导。 */
export type RelationType = (typeof RELATION_TYPES)[keyof typeof RELATION_TYPES];
