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

    it('accepts win32 absolute projectRoot for cross-platform callers', () => {
      const result = scanInputSchema.parse({ projectRoot: 'C:\\repo\\cord' });
      expect(result.projectRoot).toBe('C:\\repo\\cord');
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty projectRoot', () => {
      expect(() => scanInputSchema.parse({ projectRoot: '' })).toThrow();
    });

    it('rejects missing projectRoot', () => {
      expect(() => scanInputSchema.parse({})).toThrow();
    });

    it.each(['project', './project', 'docs/project'])('rejects relative projectRoot %s', (projectRoot) => {
      expect(() => scanInputSchema.parse({ projectRoot })).toThrow();
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
        expect((err as ConfigError).suggestion).toBe('请检查输入数据是否符合预期格式');
      }
    });

    it('ConfigError exposes absolute path contract issue context', () => {
      try {
        validateScanInput({ projectRoot: 'relative-project' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).context.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ message: 'projectRoot 必须是绝对路径' }),
          ]),
        );
      }
    });
  });
});
