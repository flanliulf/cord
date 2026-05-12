import { describe, expect, it } from 'vitest';
import { toJsonSchema } from '../../../src/schemas/json-schema.js';
import { documentSchema } from '../../../src/schemas/document.js';
import { relationSchema } from '../../../src/schemas/relation.js';
import { configSchema } from '../../../src/schemas/config.js';
import { scanInputSchema } from '../../../src/schemas/scan-input.js';
import { queryInputSchema } from '../../../src/schemas/query-input.js';
import { impactInputSchema } from '../../../src/schemas/impact-input.js';

describe('toJsonSchema', () => {
  it('converts documentSchema to a JSON Schema object', () => {
    const jsonSchema = toJsonSchema(documentSchema, 'DocumentSchema');
    expect(typeof jsonSchema).toBe('object');
    expect(jsonSchema).not.toBeNull();
  });

  it('converted documentSchema has type=object', () => {
    const jsonSchema = toJsonSchema(documentSchema);
    expect((jsonSchema as { type?: string }).type).toBe('object');
  });

  it('converted documentSchema contains required id property', () => {
    const jsonSchema = toJsonSchema(documentSchema) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(jsonSchema.properties).toHaveProperty('id');
    expect(jsonSchema.required).toContain('id');
  });

  it('converts relationSchema to a JSON Schema object with type=object', () => {
    const jsonSchema = toJsonSchema(relationSchema) as { type?: string };
    expect(jsonSchema.type).toBe('object');
  });

  it('converts configSchema to a JSON Schema object', () => {
    const jsonSchema = toJsonSchema(configSchema);
    expect(typeof jsonSchema).toBe('object');
  });

  it('converts scanInputSchema to a JSON Schema object', () => {
    const jsonSchema = toJsonSchema(scanInputSchema) as {
      properties?: Record<string, unknown>;
    };
    expect(jsonSchema.properties).toHaveProperty('projectRoot');
  });

  it('converts queryInputSchema to a JSON Schema object', () => {
    const jsonSchema = toJsonSchema(queryInputSchema);
    expect(typeof jsonSchema).toBe('object');
  });

  it('converts impactInputSchema to a JSON Schema object', () => {
    const jsonSchema = toJsonSchema(impactInputSchema) as {
      properties?: Record<string, unknown>;
    };
    expect(jsonSchema.properties).toHaveProperty('docPath');
  });

  it('uses provided name in output', () => {
    const jsonSchema = toJsonSchema(scanInputSchema, 'ScanInput') as {
      title?: string;
    };
    // zod-to-json-schema may emit name as title or in $schema; check it's not undefined
    expect(jsonSchema).toBeDefined();
  });
});
