import { describe, expect, it } from 'vitest';
import { queryInputSchema, validateQueryInput } from '../../../src/schemas/query-input.js';
import { ConfigError } from '../../../src/utils/errors.js';

describe('queryInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts docId only', () => {
      const result = queryInputSchema.parse({ docId: 'doc-001' });
      expect(result.docId).toBe('doc-001');
      expect(result.includeRelations).toBe(false);
    });

    it('accepts path only', () => {
      const result = queryInputSchema.parse({ path: 'docs/prd.md' });
      expect(result.path).toBe('docs/prd.md');
    });

    it('accepts docId with includeRelations=true', () => {
      const result = queryInputSchema.parse({ docId: 'doc-001', includeRelations: true });
      expect(result.includeRelations).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects neither docId nor path provided', () => {
      expect(() => queryInputSchema.parse({})).toThrow();
    });

    it('rejects both docId and path provided', () => {
      expect(() =>
        queryInputSchema.parse({ docId: 'doc-001', path: 'docs/prd.md' }),
      ).toThrow();
    });

    it('rejects both empty string docId and path', () => {
      expect(() => queryInputSchema.parse({ docId: '', path: '' })).toThrow();
    });

    it('rejects mixed-empty: empty docId + valid path', () => {
      expect(() => queryInputSchema.parse({ docId: '', path: 'docs/prd.md' })).toThrow();
    });

    it('rejects mixed-empty: valid docId + empty path', () => {
      expect(() => queryInputSchema.parse({ docId: 'doc-001', path: '' })).toThrow();
    });

    it('rejects non-boolean includeRelations', () => {
      expect(() => queryInputSchema.parse({ docId: 'doc-001', includeRelations: 'yes' })).toThrow();
    });
  });

  describe('validateQueryInput — ConfigError 断言（AC6）', () => {
    it('throws ConfigError when neither docId nor path is provided', () => {
      expect(() => validateQueryInput({})).toThrow(ConfigError);
    });

    it('throws ConfigError when both docId and path are provided', () => {
      expect(() => validateQueryInput({ docId: 'doc-001', path: 'docs/prd.md' })).toThrow(ConfigError);
    });

    it('throws ConfigError for mixed-empty: empty docId + valid path', () => {
      expect(() => validateQueryInput({ docId: '', path: 'docs/prd.md' })).toThrow(ConfigError);
    });

    it('throws ConfigError for mixed-empty: valid docId + empty path', () => {
      expect(() => validateQueryInput({ docId: 'doc-001', path: '' })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_005 error code', () => {
      try {
        validateQueryInput({});
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_005');
      }
    });
  });
});
