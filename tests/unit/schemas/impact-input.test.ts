import { describe, expect, it } from 'vitest';
import { impactInputSchema, validateImpactInput } from '../../../src/schemas/impact-input.js';
import { ConfigError } from '../../../src/utils/errors.js';

describe('impactInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts minimal required fields with defaults', () => {
      const result = impactInputSchema.parse({ sourceDocId: 'doc-001' });
      expect(result.sourceDocId).toBe('doc-001');
      expect(result.depth).toBe(3); // default
    });

    it('accepts full input', () => {
      const result = impactInputSchema.parse({
        sourceDocId: 'doc-001',
        depth: 5,
        confidenceThreshold: 0.75,
      });
      expect(result.depth).toBe(5);
      expect(result.confidenceThreshold).toBe(0.75);
    });

    it('accepts depth = 1', () => {
      expect(() =>
        impactInputSchema.parse({ sourceDocId: 'doc-001', depth: 1 }),
      ).not.toThrow();
    });

    it('accepts depth = 10', () => {
      expect(() =>
        impactInputSchema.parse({ sourceDocId: 'doc-001', depth: 10 }),
      ).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty sourceDocId', () => {
      expect(() => impactInputSchema.parse({ sourceDocId: '' })).toThrow();
    });

    it('rejects missing sourceDocId', () => {
      expect(() => impactInputSchema.parse({})).toThrow();
    });

    it('rejects depth > 10', () => {
      expect(() =>
        impactInputSchema.parse({ sourceDocId: 'doc-001', depth: 11 }),
      ).toThrow();
    });

    it('rejects depth < 1', () => {
      expect(() =>
        impactInputSchema.parse({ sourceDocId: 'doc-001', depth: 0 }),
      ).toThrow();
    });

    it('rejects non-integer depth', () => {
      expect(() =>
        impactInputSchema.parse({ sourceDocId: 'doc-001', depth: 1.5 }),
      ).toThrow();
    });

    it('rejects confidenceThreshold > 1', () => {
      expect(() =>
        impactInputSchema.parse({ sourceDocId: 'doc-001', confidenceThreshold: 2 }),
      ).toThrow();
    });
  });

  describe('validateImpactInput — ConfigError 断言（AC6）', () => {
    it('throws ConfigError on invalid data', () => {
      expect(() => validateImpactInput({ sourceDocId: '' })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_006 error code', () => {
      try {
        validateImpactInput({ sourceDocId: 'doc-001', depth: 100 });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_006');
      }
    });
  });
});
