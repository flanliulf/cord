/**
 * Zod schema — 文档查询输入验证。
 */

import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

/** 非空可选字符串：去除首尾空白后至少 1 个字符，防止空字符串穿过验证。 */
const nonEmptyOptionalString = z.string().trim().min(1).optional();

/** 文档查询输入 Zod schema。 */
export const queryInputSchema = z
  .object({
    /** 查询的文档 ID（与 `path` 二选一）。 */
    docId: nonEmptyOptionalString,

    /** 查询的文档路径，相对于项目根目录（与 `docId` 二选一）。 */
    path: nonEmptyOptionalString,

    /** 是否同时获取关联关系列表。 */
    includeRelations: z.boolean().optional().default(false),
  })
  .refine((d) => Boolean(d.docId) !== Boolean(d.path), {
    message: 'docId 与 path 必须恰好提供一个',
  });

/** 由 schema 推导的类型。 */
export type QueryInput = z.infer<typeof queryInputSchema>;

/**
 * 验证文档查询输入数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `QueryInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_005`）
 */
export function validateQueryInput(data: unknown): QueryInput {
  return validateWithCordError(queryInputSchema, data, 'CORD_SCHEMA_005');
}
