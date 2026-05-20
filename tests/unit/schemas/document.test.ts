import { describe, expect, it } from 'vitest';
import { documentSchema, validateDocument } from '../../../src/schemas/document.js';
import { ConfigError } from '../../../src/utils/errors.js';

const validDoc = {
  id: 'doc-001',
  path: 'docs/prd.md',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('documentSchema', () => {
  describe('valid inputs', () => {
    it('accepts minimal required fields', () => {
      const result = documentSchema.parse(validDoc);
      expect(result.id).toBe('doc-001');
      expect(result.path).toBe('docs/prd.md');
    });

    it('accepts all optional fields', () => {
      const result = documentSchema.parse({
        ...validDoc,
        title: 'Product Requirements',
        docType: 'prd',
        framework: 'bmad',
        contentHash: 'abc123',
        metadata: { tags: ['core'] },
      });
      expect(result.title).toBe('Product Requirements');
      expect(result.docType).toBe('prd');
      expect(result.framework).toBe('bmad');
      expect(result.contentHash).toBe('abc123');
      expect(result.metadata).toEqual({ tags: ['core'] });
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty id', () => {
      expect(() => documentSchema.parse({ ...validDoc, id: '' })).toThrow();
    });

    it('rejects empty path', () => {
      expect(() => documentSchema.parse({ ...validDoc, path: '' })).toThrow();
    });

    it.each(['/abs.md', 'C:\\repo\\doc.md', '\\\\server\\share\\doc.md', '../outside.md', 'docs/../outside.md', 'docs\\doc.md'])(
      'rejects non project-relative POSIX path %s',
      (path) => {
        expect(() => documentSchema.parse({ ...validDoc, path })).toThrow();
      },
    );

    it.each(['2026-01-01', 'not-a-date', ''])('rejects non ISO 8601 createdAt value %s', (createdAt) => {
      expect(() => documentSchema.parse({ ...validDoc, createdAt })).toThrow();
    });

    it('rejects non ISO 8601 updatedAt value', () => {
      expect(() => documentSchema.parse({ ...validDoc, updatedAt: '2026-01-01' })).toThrow();
    });

    it('rejects missing id', () => {
      expect(() =>
        documentSchema.parse({ path: validDoc.path, createdAt: validDoc.createdAt, updatedAt: validDoc.updatedAt }),
      ).toThrow();
    });

    it('rejects missing createdAt', () => {
      expect(() =>
        documentSchema.parse({ id: validDoc.id, path: validDoc.path, updatedAt: validDoc.updatedAt }),
      ).toThrow();
    });

    it('rejects missing updatedAt', () => {
      expect(() =>
        documentSchema.parse({ id: validDoc.id, path: validDoc.path, createdAt: validDoc.createdAt }),
      ).toThrow();
    });
  });

  describe('validateDocument — ConfigError 断言（AC6）', () => {
    it('throws ConfigError on invalid data', () => {
      expect(() => validateDocument({ ...validDoc, id: '' })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_001 error code', () => {
      try {
        validateDocument({ ...validDoc, id: '' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_001');
        expect((err as ConfigError).suggestion).toBe('请检查输入数据是否符合预期格式');
      }
    });

    it('ConfigError exposes path contract issue context', () => {
      try {
        validateDocument({ ...validDoc, path: '/outside.md' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_001');
        expect((err as ConfigError).context.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ message: 'path 必须是 project-relative POSIX 路径' }),
          ]),
        );
      }
    });

    it('ConfigError message contains validation failure text', () => {
      try {
        validateDocument({ ...validDoc, path: '' });
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as ConfigError).message).toContain('验证失败');
      }
    });
  });
});
