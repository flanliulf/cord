/**
 * Zod schema — cord.config 配置验证（初始 8 项，第 9 项由 Story 4.3 扩展）。
 */

import { z } from 'zod';
import { RELATION_TYPES } from '../types/relations.js';
import { validateWithCordError } from './helpers.js';

/** 关系类型枚举值（用于 relationTypes key 验证）。 */
const relationTypeValues = Object.values(RELATION_TYPES) as [string, ...string[]];

/** 单个关系类型配置 schema。 */
const relationTypeConfigSchema = z.object({
  enabled: z.boolean(),
});

/** cord.config 配置 Zod schema，对应 `CordConfig` 接口。 */
export const configSchema = z.object({
  /** 项目显示名，用于导出快照等面向用户的输出。 */
  projectName: z.string().trim().min(1).optional(),

  /** 检测到的开发框架。 */
  framework: z.string().optional(),

  /** 检测到的 IDE 类型。 */
  ide: z.string().optional(),

  /** 文档扫描路径列表。 */
  scanPaths: z.array(z.string()).optional(),

  /** 排除路径列表，默认值由应用层设置。 */
  excludePaths: z.array(z.string()).optional(),

  /** 影响分析最低置信度阈值（0.0 ~ 1.0）。 */
  confidenceThreshold: z.number().min(0).max(1).optional(),

  /** 9 类关系的启用/禁用配置。 */
  relationTypes: z
    .record(z.enum(relationTypeValues as [string, ...string[]]), relationTypeConfigSchema)
    .optional(),

  /** 启用的框架适配模块名称列表。 */
  adapters: z.array(z.string()).optional(),
});

/** 由 schema 推导的类型（与 `CordConfig` 接口兼容）。 */
export type ConfigInput = z.infer<typeof configSchema>;

/**
 * 验证 cord.config 数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `ConfigInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_003`）
 */
export function validateConfig(data: unknown): ConfigInput {
  return validateWithCordError(configSchema, data, 'CORD_SCHEMA_003');
}
