import { describe, expect, it } from 'vitest';
import { scanInputSchema, validateScanInput } from '../../../src/schemas/scan-input.js';
import { ConfigError } from '../../../src/utils/errors.js';

describe('scanInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts minimal required fields with default rebuild=false and force=false', () => {
      const result = scanInputSchema.parse({ projectRoot: '/home/user/project' });
      expect(result.projectRoot).toBe('/home/user/project');
      expect(result.rebuild).toBe(false);
      expect(result.force).toBe(false);
    });

    it('accepts with explicit paths, rebuild=true, and force=true', () => {
      const result = scanInputSchema.parse({
        projectRoot: '/project',
        paths: ['docs/', 'src/'],
        rebuild: true,
        force: true,
      });
      expect(result.paths).toEqual(['docs/', 'src/']);
      expect(result.rebuild).toBe(true);
      expect(result.force).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty projectRoot', () => {
      expect(() => scanInputSchema.parse({ projectRoot: '' })).toThrow();
    });

    it('rejects missing projectRoot', () => {
      expect(() => scanInputSchema.parse({})).toThrow();
    });

    it('rejects non-string path element', () => {
      expect(() =>
        scanInputSchema.parse({ projectRoot: '/project', paths: [123] }),
      ).toThrow();
    });
  });

  describe('validateScanInput — ConfigError 断言（AC6）', () => {
    it('throws ConfigError on invalid data', () => {
      expect(() => validateScanInput({ projectRoot: '' })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_004 error code', () => {
      try {
        validateScanInput({});
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_004');
      }
    });
  });
});
