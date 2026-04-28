/**
 * Zod schema — 关系边验证（P2: camelCase + Schema 后缀）。
 */

import { z } from 'zod';
import { RELATION_TYPES } from '../types/relations.js';
import { validateWithCordError } from './helpers.js';

/** 关系类型枚举值数组（从 RELATION_TYPES 常量派生）。 */
const relationTypeValues = Object.values(RELATION_TYPES) as [string, ...string[]];

/** 关系来源枚举。 */
const relationSourceEnum = z.enum(['auto_scan', 'manual', 'framework_preset']);

/** 关系边 Zod schema，对应 `RelationEdge` 接口。 */
export const relationSchema = z.object({
  id: z.string().min(1, 'id 不能为空'),
  sourceDocId: z.string().min(1, 'sourceDocId 不能为空'),
  targetDocId: z.string().min(1, 'targetDocId 不能为空'),
  relationType: z.enum(relationTypeValues as [string, ...string[]]),
  confidence: z.number().min(0).max(1),
  source: relationSourceEnum,
  status: z.enum(['active', 'deprecated']).default('active'),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().min(1, 'createdAt 不能为空'),
  updatedAt: z.string().min(1, 'updatedAt 不能为空'),
});

/** 由 schema 推导的类型（与 `RelationEdge` 接口兼容）。 */
export type RelationInput = z.infer<typeof relationSchema>;

/**
 * 验证关系边数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `RelationInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_002`）
 */
export function validateRelation(data: unknown): RelationInput {
  return validateWithCordError(relationSchema, data, 'CORD_SCHEMA_002');
}
