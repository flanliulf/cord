/**
 * CORD 配置类型定义。
 */

import type { RelationType } from './relations.js';

/**
 * CordConfig 表示 `cord.config` 文件的结构（初始 7 项配置）。
 *
 * 第 8 项 `updateStrategies` 由 Story 4.3 Task 1 扩展。
 */
export interface CordConfig {
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
}
