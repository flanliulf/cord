/**
 * Zod 验证辅助函数 — 将 ZodError 封装为 CordError 子类。
 */

import type { ZodType, ZodTypeDef } from 'zod';
import { ZodError } from 'zod';
import { ConfigError } from '../utils/errors.js';

/**
 * 使用指定 Zod schema 验证数据。
 *
 * 验证通过时返回类型安全的结果；验证失败时将 ZodError 封装为 `ConfigError` 抛出。
 *
 * 使用 `ZodType<T, ZodTypeDef, unknown>` 而非 `ZodSchema<T>`，以兼容含有
 * `.default()` / `.transform()` 的 schema（这些 schema 的输入/输出类型不同）。
 *
 * @param schema - 用于验证的 Zod schema
 * @param data   - 待验证的原始数据
 * @param errorCode - 验证失败时使用的错误码（格式：`CORD_{MODULE}_{NNN}`）
 * @returns 验证通过的类型安全数据
 * @throws {@link ConfigError} 当验证失败时
 */
export function validateWithCordError<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  data: unknown,
  errorCode: string,
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigError({
        message: `验证失败: ${error.issues.map((i) => i.message).join(', ')}`,
        code: errorCode,
        suggestion: '请检查输入数据是否符合预期格式',
        context: { issues: error.issues },
        cause: error,
      });
    }
    throw error;
  }
}
