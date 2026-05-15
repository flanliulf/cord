/**
 * CORD 配置类型定义。
 */

import type { RelationType } from './relations.js';

/** 文档更新策略值集合。 */
export const UPDATE_STRATEGY_VALUES = ['auto', 'suggest', 'log_only'] as const;

/** 未命中类别配置时的默认更新策略。 */
export const DEFAULT_UPDATE_STRATEGY: UpdateStrategy = 'suggest';

/** 文档类别更新策略。 */
export type UpdateStrategy = (typeof UPDATE_STRATEGY_VALUES)[number];

/**
 * CordConfig 表示 `cord.config` 文件的结构（初始 8 项配置）。
 *
 * 第 9 项 `updateStrategies` 由 Story 4.3 Task 1 扩展。
 */
export interface CordConfig {
  /** 项目显示名，用于导出快照等面向用户的输出。 */
  projectName?: string;

  /** 检测到的开发框架（如 `'bmad'`、`'generic'`）。 */
  framework?: string;

  /** 检测到的 IDE 类型（如 `'vscode'`、`'cursor'`）。 */
  ide?: string;

  /** 文档扫描路径列表。 */
  scanPaths?: string[];

  /**
   * 排除路径列表。
   * 默认值：`["src/", "node_modules/", ".git/", "dist/"]`。
   */
  excludePaths?: string[];

  /**
   * 影响分析最低置信度阈值。
   * 默认值：`0.50`。
   */
  confidenceThreshold?: number;

  /**
   * 已有 9 类关系的启用/禁用配置。
   * 不支持扩展新类型；与 Story 2.4 的 `relationTypes` 语义对齐。
   */
  relationTypes?: Partial<Record<RelationType, { enabled: boolean }>>;

  /** 启用的框架适配模块名称列表。 */
  adapters?: string[];

  /**
   * 按文档类别配置更新策略。
   * 键允许任意 docType 字符串；未配置类别回退到默认策略 `suggest`。
   */
  updateStrategies?: Record<string, UpdateStrategy>;
}
