import { describe, expect, it } from 'vitest';
import { queryInputSchema, validateQueryInput } from '../../../src/schemas/query-input.js';
import { ConfigError } from '../../../src/utils/errors.js';
import { RELATION_TYPES } from '../../../src/types/index.js';
import type { RelationType } from '../../../src/types/index.js';

describe('queryInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts docPath only and defaults includeDeprecated to false', () => {
      const result = queryInputSchema.parse({ docPath: 'docs/prd.md' });
      expect(result.docPath).toBe('docs/prd.md');
      expect(result.includeDeprecated).toBe(false);
    });

    it('accepts relation type and includeDeprecated flag', () => {
      const result = queryInputSchema.parse({
        docPath: 'docs/prd.md',
        type: RELATION_TYPES.SYNC_REQUIRED,
        includeDeprecated: true,
      });
      const relationType: RelationType | undefined = result.type;
      expect(relationType).toBe(RELATION_TYPES.SYNC_REQUIRED);
      expect(result.type).toBe(RELATION_TYPES.SYNC_REQUIRED);
      expect(result.includeDeprecated).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects missing docPath', () => {
      expect(() => queryInputSchema.parse({})).toThrow();
    });

    it('rejects empty docPath', () => {
      expect(() => queryInputSchema.parse({ docPath: '   ' })).toThrow();
    });

    it('rejects invalid relation type', () => {
      expect(() => queryInputSchema.parse({ docPath: 'docs/prd.md', type: 'invalid_type' })).toThrow();
    });

    it('rejects non-boolean includeDeprecated', () => {
      expect(() => queryInputSchema.parse({ docPath: 'docs/prd.md', includeDeprecated: 'yes' })).toThrow();
    });
  });

  describe('validateQueryInput — ConfigError 断言（AC6）', () => {
    it('throws ConfigError when docPath is missing', () => {
      expect(() => validateQueryInput({})).toThrow(ConfigError);
    });

    it('throws ConfigError when relation type is invalid', () => {
      expect(() => validateQueryInput({ docPath: 'docs/prd.md', type: 'invalid_type' })).toThrow(ConfigError);
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
