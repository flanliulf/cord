import { describe, expect, it } from 'vitest';
import { impactInputSchema, validateImpactInput } from '../../../src/schemas/impact-input.js';
import { ConfigError } from '../../../src/utils/errors.js';

describe('impactInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts docPath as the only required field', () => {
      const result = impactInputSchema.parse({ docPath: 'docs/story.md' });
      expect(result.docPath).toBe('docs/story.md');
      expect(result.confidenceThreshold).toBeUndefined();
    });

    it('accepts confidenceThreshold when provided', () => {
      const result = impactInputSchema.parse({
        docPath: 'docs/story.md',
        confidenceThreshold: 0.75,
      });
      expect(result.docPath).toBe('docs/story.md');
      expect(result.confidenceThreshold).toBe(0.75);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty docPath', () => {
      expect(() => impactInputSchema.parse({ docPath: '   ' })).toThrow();
    });

    it('rejects missing docPath', () => {
      expect(() => impactInputSchema.parse({})).toThrow();
    });

    it('rejects confidenceThreshold > 1', () => {
      expect(() =>
        impactInputSchema.parse({ docPath: 'docs/story.md', confidenceThreshold: 2 }),
      ).toThrow();
    });

    it('rejects confidenceThreshold < 0', () => {
      expect(() =>
        impactInputSchema.parse({ docPath: 'docs/story.md', confidenceThreshold: -0.1 }),
      ).toThrow();
    });
  });

  describe('validateImpactInput', () => {
    it('throws ConfigError on invalid data', () => {
      expect(() => validateImpactInput({ docPath: '' })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_006 error code', () => {
      try {
        validateImpactInput({});
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_006');
      }
    });
  });
});
