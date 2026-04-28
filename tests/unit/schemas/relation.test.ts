import { describe, expect, it } from 'vitest';
import { relationSchema, validateRelation } from '../../../src/schemas/relation.js';
import { ConfigError } from '../../../src/utils/errors.js';

const validRelation = {
  id: 'rel-001',
  sourceDocId: 'doc-001',
  targetDocId: 'doc-002',
  relationType: 'sync_required',
  confidence: 0.9,
  source: 'auto_scan',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('relationSchema', () => {
  describe('valid inputs', () => {
    it('accepts minimal required fields with default status', () => {
      const result = relationSchema.parse(validRelation);
      expect(result.status).toBe('active'); // default value
    });

    it('accepts explicit status = deprecated', () => {
      const result = relationSchema.parse({ ...validRelation, status: 'deprecated' });
      expect(result.status).toBe('deprecated');
    });

    it('accepts all 9 relation types', () => {
      const types = [
        'sync_required',
        'context_for',
        'lifecycle_bound',
        'contains',
        'must_consistent',
        'sync_suggested',
        'derived_from',
        'deprecated',
        'references',
      ];
      for (const relationType of types) {
        expect(() => relationSchema.parse({ ...validRelation, relationType })).not.toThrow();
      }
    });

    it('accepts all 3 relation sources', () => {
      const sources = ['auto_scan', 'manual', 'framework_preset'];
      for (const source of sources) {
        expect(() => relationSchema.parse({ ...validRelation, source })).not.toThrow();
      }
    });

    it('accepts confidence = 0', () => {
      expect(() => relationSchema.parse({ ...validRelation, confidence: 0 })).not.toThrow();
    });

    it('accepts confidence = 1', () => {
      expect(() => relationSchema.parse({ ...validRelation, confidence: 1 })).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('rejects unknown relationType', () => {
      expect(() =>
        relationSchema.parse({ ...validRelation, relationType: 'invalid_type' }),
      ).toThrow();
    });

    it('rejects confidence > 1', () => {
      expect(() => relationSchema.parse({ ...validRelation, confidence: 1.1 })).toThrow();
    });

    it('rejects confidence < 0', () => {
      expect(() => relationSchema.parse({ ...validRelation, confidence: -0.1 })).toThrow();
    });

    it('rejects unknown source', () => {
      expect(() => relationSchema.parse({ ...validRelation, source: 'unknown' })).toThrow();
    });

    it('rejects empty sourceDocId', () => {
      expect(() => relationSchema.parse({ ...validRelation, sourceDocId: '' })).toThrow();
    });
  });

  describe('validateRelation — ConfigError 断言（AC6）', () => {
    it('throws ConfigError on invalid data', () => {
      expect(() => validateRelation({ ...validRelation, relationType: 'bad' })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_002 error code', () => {
      try {
        validateRelation({ ...validRelation, confidence: 2 });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_002');
      }
    });
  });
});
