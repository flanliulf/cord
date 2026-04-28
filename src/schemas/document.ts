/**
 * Zod schema — 文档节点验证（P2: camelCase + Schema 后缀）。
 */

import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

/** 文档节点 Zod schema，对应 `DocumentNode` 接口。 */
export const documentSchema = z.object({
  id: z.string().min(1, 'id 不能为空'),
  path: z.string().min(1, 'path 不能为空'),
  title: z.string().optional(),
  docType: z.string().optional(),
  framework: z.string().optional(),
  contentHash: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().min(1, 'createdAt 不能为空'),
  updatedAt: z.string().min(1, 'updatedAt 不能为空'),
});

/** 由 schema 推导的类型（与 `DocumentNode` 接口兼容）。 */
export type DocumentInput = z.infer<typeof documentSchema>;

/**
 * 验证文档节点数据，失败时抛出 `ConfigError`（AC6）。
 *
 * @param data - 待验证的原始数据
 * @returns 验证通过的类型安全 `DocumentInput`
 * @throws {@link ConfigError} 当验证失败时（code: `CORD_SCHEMA_001`）
 */
export function validateDocument(data: unknown): DocumentInput {
  return validateWithCordError(documentSchema, data, 'CORD_SCHEMA_001');
}
