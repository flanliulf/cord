import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateWithCordError } from '../../../src/schemas/helpers.js';
import { ConfigError } from '../../../src/utils/errors.js';

const testSchema = z.object({
  name: z.string().min(1, 'name 不能为空'),
  age: z.number().int().min(0),
});

describe('validateWithCordError', () => {
  it('returns parsed data on valid input', () => {
    const result = validateWithCordError(testSchema, { name: 'Alice', age: 30 }, 'CORD_TEST_001');
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws ConfigError on invalid input', () => {
    expect(() =>
      validateWithCordError(testSchema, { name: '', age: 30 }, 'CORD_TEST_001'),
    ).toThrow(ConfigError);
  });

  it('ConfigError carries the specified errorCode', () => {
    try {
      validateWithCordError(testSchema, { name: 'x', age: -1 }, 'CORD_CONFIG_100');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).code).toBe('CORD_CONFIG_100');
    }
  });

  it('ConfigError message contains validation issue text', () => {
    try {
      validateWithCordError(testSchema, { name: '', age: 0 }, 'CORD_TEST_001');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as ConfigError).message).toContain('验证失败');
    }
  });

  it('ConfigError context contains issues array', () => {
    try {
      validateWithCordError(testSchema, { name: '', age: 0 }, 'CORD_TEST_001');
      expect.fail('should have thrown');
    } catch (err) {
      const cordErr = err as ConfigError;
      expect(Array.isArray(cordErr.context.issues)).toBe(true);
    }
  });

  it('re-throws non-ZodError as-is', () => {
    const throwingSchema = z.any().transform(() => {
      throw new RangeError('something else');
    });
    expect(() =>
      validateWithCordError(throwingSchema, 'anything', 'CORD_TEST_001'),
    ).toThrow(RangeError);
  });
});
