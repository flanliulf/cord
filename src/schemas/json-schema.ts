/**
 * JSON Schema 导出工具 — 将 Zod schema 转换为 JSON Schema（为 MCP Tools inputSchema 预备）。
 *
 * 使用 `zod-to-json-schema`（Zod v3 兼容版本）。
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';

/**
 * 将任意 Zod schema 转换为标准 JSON Schema 对象。
 *
 * @param schema - 要导出的 Zod schema
 * @param name   - 可选的 schema 名称（出现在 JSON Schema `$id` / `title` 字段）
 * @returns JSON Schema 对象
 */
export function toJsonSchema(schema: ZodSchema, name?: string): Record<string, unknown> {
  return zodToJsonSchema(schema, name) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 预导出：所有核心 schema 的 JSON Schema 快照（供 MCP Tools 直接引用）
// ---------------------------------------------------------------------------

export { documentSchema } from './document.js';
export { relationSchema } from './relation.js';
export { configSchema } from './config.js';
export { scanInputSchema } from './scan-input.js';
export { queryInputSchema } from './query-input.js';
export { impactInputSchema } from './impact-input.js';
