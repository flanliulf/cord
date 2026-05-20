/**
 * Zod schema — 文档查询输入验证。
 */

import { z } from 'zod';
import { RELATION_TYPES, type RelationType } from '../types/relations.js';
import { validateWithCordError } from './helpers.js';

/** 非空可选字符串：去除首尾空白后至少 1 个字符，防止空字符串穿过验证。 */
const nonEmptyString = z.string().trim().min(1, 'docPath 不能为空');

const relationTypeValues = [
  RELATION_TYPES.SYNC_REQUIRED,
  RELATION_TYPES.CONTEXT_FOR,
  RELATION_TYPES.LIFECYCLE_BOUND,
  RELATION_TYPES.CONTAINS,
  RELATION_TYPES.MUST_CONSISTENT,
  RELATION_TYPES.SYNC_SUGGESTED,
  RELATION_TYPES.DERIVED_FROM,
  RELATION_TYPES.DEPRECATED,
  RELATION_TYPES.REFERENCES,
] as const satisfies readonly [RelationType, ...RelationType[]];

/** 文档查询输入 Zod schema。 */
export const queryInputSchema = z.object({
  /** 查询的文档路径，相对于项目根目录。 */
  docPath: nonEmptyString,

  /** 按关系类型过滤。 */
  type: z.enum(relationTypeValues).optional(),

  /** 是否包含已废弃关系。 */
  includeDeprecated: z.boolean().optional().default(false),

  /** 查询的最大跳数深度。 */
  depth: z.number().int().min(1).max(3).optional().default(1),
});

/** 查询输入类型，保留 default 字段的调用方可选语义。 */
export type QueryInput = z.input<typeof queryInputSchema>;

/** 验证后的查询输入类型，包含 schema default 补齐后的字段。 */
export type ValidatedQueryInput = z.output<typeof queryInputSchema>;

/**
 * 验证文档查询输入数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `QueryInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_005`）
 */
export function validateQueryInput(data: unknown): ValidatedQueryInput {
  return validateWithCordError(queryInputSchema, data, 'CORD_SCHEMA_005');
}
