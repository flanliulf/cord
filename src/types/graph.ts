/**
 * CORD 图遍历相关类型定义。
 */

import type { RelationType } from './relations.js';

/** 关系来源类型：自动扫描、手动添加或框架预设。 */
export type RelationSource = 'auto_scan' | 'manual' | 'framework_preset';

/**
 * RelationEdge 表示两个文档节点之间的有向关系边。
 *
 * `confidence` 范围为 0.0 ~ 1.0，越高越可靠。
 * `status` 默认为 `'active'`，被废弃的关系标记为 `'deprecated'`（Story 4.1 引入）。
 */
export interface RelationEdge {
  /** 唯一标识符。 */
  id: string;

  /** 源文档节点 ID。 */
  sourceDocId: string;

  /** 目标文档节点 ID。 */
  targetDocId: string;

  /** 关系类型（9 种之一）。 */
  relationType: RelationType;

  /** 置信度评分，0.0 ~ 1.0。 */
  confidence: number;

  /** 关系来源。 */
  source: RelationSource;

  /** 关系状态；新建时默认为 `'active'`。 */
  status: 'active' | 'deprecated';

  /** 扩展元数据。 */
  metadata?: Record<string, unknown>;

  /** 记录创建时间（ISO 8601）。 */
  createdAt: string;

  /** 最后更新时间（ISO 8601）。 */
  updatedAt: string;
}

/**
 * GraphTraversalResult 表示从某文档出发的图遍历结果。
 */
export interface GraphTraversalResult {
  /** 遍历起始文档 ID。 */
  startDocId: string;

  /** 遍历深度。 */
  depth: number;

  /** 遍历过程中发现的所有关系边。 */
  relations: RelationEdge[];

  /** 遍历过程中访问过的所有文档 ID（含起始文档）。 */
  visitedDocIds: string[];
}
