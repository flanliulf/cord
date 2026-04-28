import { describe, expect, it } from 'vitest';
import { configSchema, validateConfig } from '../../../src/schemas/config.js';
import { ConfigError } from '../../../src/utils/errors.js';

describe('configSchema', () => {
  describe('valid inputs', () => {
    it('accepts empty config object', () => {
      const result = configSchema.parse({});
      expect(result).toEqual({});
    });

    it('accepts full config', () => {
      const result = configSchema.parse({
        framework: 'bmad',
        ide: 'vscode',
        scanPaths: ['docs/', '_bmad-output/'],
        excludePaths: ['node_modules/', 'dist/'],
        confidenceThreshold: 0.7,
        relationTypes: {
          sync_required: { enabled: true },
          references: { enabled: false },
        },
        adapters: ['bmad-adapter'],
      });
      expect(result.framework).toBe('bmad');
      expect(result.confidenceThreshold).toBe(0.7);
    });

    it('accepts confidenceThreshold = 0', () => {
      expect(() => configSchema.parse({ confidenceThreshold: 0 })).not.toThrow();
    });

    it('accepts confidenceThreshold = 1', () => {
      expect(() => configSchema.parse({ confidenceThreshold: 1 })).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('rejects confidenceThreshold > 1', () => {
      expect(() => configSchema.parse({ confidenceThreshold: 1.5 })).toThrow();
    });

    it('rejects confidenceThreshold < 0', () => {
      expect(() => configSchema.parse({ confidenceThreshold: -0.1 })).toThrow();
    });

    it('rejects unknown relationType key', () => {
      expect(() =>
        configSchema.parse({
          relationTypes: { unknown_type: { enabled: true } },
        }),
      ).toThrow();
    });

    it('rejects scanPaths with non-string element', () => {
      expect(() => configSchema.parse({ scanPaths: [123] })).toThrow();
    });
  });

  describe('validateConfig — ConfigError 断言（AC6）', () => {
    it('throws ConfigError on invalid data', () => {
      expect(() => validateConfig({ confidenceThreshold: 2 })).toThrow(ConfigError);
    });

    it('ConfigError carries CORD_SCHEMA_003 error code', () => {
      try {
        validateConfig({ confidenceThreshold: -1 });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).code).toBe('CORD_SCHEMA_003');
      }
    });
  });
});
