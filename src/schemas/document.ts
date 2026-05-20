/**
 * Zod schema — 文档节点验证（P2: camelCase + Schema 后缀）。
 */

import { posix, win32 } from 'node:path';
import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

const DOCUMENT_PATH_MESSAGE = 'path 必须是 project-relative POSIX 路径';
const ISO_DATETIME_MESSAGE = '必须是 ISO 8601 datetime 字符串';

const projectRelativePosixPathSchema = z
  .string()
  .trim()
  .min(1, 'path 不能为空')
  .refine(isProjectRelativePosixPath, DOCUMENT_PATH_MESSAGE);

function isProjectRelativePosixPath(value: string): boolean {
  if (value.includes('\0') || value.includes('\\')) return false;
  if (posix.isAbsolute(value) || win32.isAbsolute(value)) return false;

  const normalized = posix.normalize(value);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return false;

  return normalized === value;
}

/** 文档节点 Zod schema，对应 `DocumentNode` 接口。 */
export const documentSchema = z.object({
  id: z.string().min(1, 'id 不能为空'),
  path: projectRelativePosixPathSchema,
  title: z.string().optional(),
  docType: z.string().optional(),
  framework: z.string().optional(),
  contentHash: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime({ offset: true, message: `createdAt ${ISO_DATETIME_MESSAGE}` }),
  updatedAt: z.string().datetime({ offset: true, message: `updatedAt ${ISO_DATETIME_MESSAGE}` }),
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
