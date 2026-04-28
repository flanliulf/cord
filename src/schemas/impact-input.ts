/**
 * Zod schema — 影响分析输入验证。
 */

import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

/** 影响分析输入 Zod schema。 */
export const impactInputSchema = z.object({
  /** 发生变更的源文档 ID。 */
  sourceDocId: z.string().min(1, 'sourceDocId 不能为空'),

  /** 图遍历深度（默认 3 层）。 */
  depth: z.number().int().min(1).max(10).optional().default(3),

  /**
   * 最低置信度阈值过滤（0.0 ~ 1.0）。
   * 不传时使用 cord.config 中的 `confidenceThreshold`（默认 0.50）。
   */
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

/** 由 schema 推导的类型。 */
export type ImpactInput = z.infer<typeof impactInputSchema>;

/**
 * 验证影响分析输入数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `ImpactInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_006`）
 */
export function validateImpactInput(data: unknown): ImpactInput {
  return validateWithCordError(impactInputSchema, data, 'CORD_SCHEMA_006');
}
