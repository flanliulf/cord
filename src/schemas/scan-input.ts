/**
 * Zod schema — 扫描操作输入验证。
 */

import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

/** 扫描输入 Zod schema。 */
export const scanInputSchema = z.object({
  /** 项目根目录路径（绝对路径）。 */
  projectRoot: z.string().min(1, 'projectRoot 不能为空'),

  /** 指定扫描的子路径列表（可选，默认扫描整个项目）。 */
  paths: z.array(z.string()).optional(),

  /** 是否执行全量重建（删除现有图谱后重新写入）。 */
  rebuild: z.boolean().optional().default(false),

  /** 是否跳过 manual 关系确认；需与 rebuild 搭配，实际确认逻辑由后续 Story 实现。 */
  force: z.boolean().optional().default(false),
});

/** 由 schema 推导的类型。 */
export type ScanInput = z.infer<typeof scanInputSchema>;

/**
 * 验证扫描输入数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `ScanInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_004`）
 */
export function validateScanInput(data: unknown): ScanInput {
  return validateWithCordError(scanInputSchema, data, 'CORD_SCHEMA_004');
}
