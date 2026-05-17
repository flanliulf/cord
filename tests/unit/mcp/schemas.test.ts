import { describe, expect, it } from 'vitest';
import { MCP_TOOL_SCHEMAS } from '../../../src/mcp/tools/schemas.js';

function resolveSchemaNode(
  rootSchema: Record<string, unknown>,
  candidate: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (candidate === undefined) {
    return {};
  }

  const ref = candidate.$ref;

  if (typeof ref !== 'string' || !ref.startsWith('#/definitions/')) {
    return candidate;
  }

  const definitionKey = ref.slice('#/definitions/'.length);
  const definitions = rootSchema.definitions as Record<string, unknown> | undefined;
  const resolved = definitions?.[definitionKey];

  return typeof resolved === 'object' && resolved !== null
    ? resolved as Record<string, unknown>
    : candidate;
}

function summarizeSchema(schema: {
  inputJsonSchema: Record<string, unknown>;
  outputJsonSchema: Record<string, unknown>;
}, itemCollectionKey?: string): {
  inputProperties: string[];
  inputRequired: string[];
  outputProperties: string[];
  firstOutputItemProperties: string[];
} {
  const inputRoot = resolveSchemaNode(schema.inputJsonSchema, schema.inputJsonSchema);
  const outputRoot = resolveSchemaNode(schema.outputJsonSchema, schema.outputJsonSchema);
  const outputCollection = itemCollectionKey === undefined
    ? {}
    : resolveSchemaNode(
      schema.outputJsonSchema,
      ((outputRoot.properties ?? {}) as Record<string, unknown>)[itemCollectionKey] as Record<string, unknown> | undefined,
    );
  const outputItem = itemCollectionKey === undefined
    ? {}
    : resolveSchemaNode(
      schema.outputJsonSchema,
      (outputCollection.items ?? {}) as Record<string, unknown>,
    );

  return {
    inputProperties: Object.keys((inputRoot.properties ?? {}) as Record<string, unknown>),
    inputRequired: [...((inputRoot.required ?? []) as string[])],
    outputProperties: Object.keys((outputRoot.properties ?? {}) as Record<string, unknown>),
    firstOutputItemProperties: Object.keys((outputItem.properties ?? {}) as Record<string, unknown>),
  };
}

describe('MCP tool schemas', () => {
  it('freezes the current input/output schema surface for the 7 MCP tools', () => {
    const summary = Object.fromEntries(
      Object.entries(MCP_TOOL_SCHEMAS).map(([toolName, schemas]) => [
        toolName,
        summarizeSchema(
          schemas,
          toolName === 'analyze_impact'
            ? 'impactedDocs'
            : toolName === 'query_relations'
              ? 'relations'
              : toolName === 'sync_docs'
                ? 'suggestions'
                : undefined,
        ),
      ]),
    );

    expect(summary).toEqual({
      analyze_impact: {
        inputProperties: ['docPath', 'confidenceThreshold'],
        inputRequired: ['docPath'],
        outputProperties: ['impactedDocs', 'totalCount'],
        firstOutputItemProperties: [
          'docPath',
          'relationType',
          'propagationType',
          'suggestedAction',
          'updateStrategy',
          'severity',
          'confidence',
          'hopDistance',
        ],
      },
      query_relations: {
        inputProperties: ['docPath', 'type', 'includeDeprecated', 'depth'],
        inputRequired: ['docPath'],
        outputProperties: ['relations', 'totalCount'],
        firstOutputItemProperties: [
          'relationId',
          'targetPath',
          'relationType',
          'confidence',
          'source',
          'status',
          'hopDistance',
        ],
      },
      init_graph: {
        inputProperties: ['rebuild', 'force'],
        inputRequired: [],
        outputProperties: ['documentsFound', 'relationsDiscovered', 'warnings', 'durationMs'],
        firstOutputItemProperties: [],
      },
      sync_docs: {
        inputProperties: ['filePath'],
        inputRequired: ['filePath'],
        outputProperties: ['suggestions', 'affectedCount'],
        firstOutputItemProperties: ['targetPath', 'action', 'updateStrategy', 'reason'],
      },
      add_relation: {
        inputProperties: ['sourcePath', 'targetPath', 'relationType'],
        inputRequired: ['sourcePath', 'targetPath', 'relationType'],
        outputProperties: ['relationId', 'sourcePath', 'targetPath', 'relationType', 'source', 'status'],
        firstOutputItemProperties: [],
      },
      remove_relation: {
        inputProperties: ['relationId'],
        inputRequired: ['relationId'],
        outputProperties: ['success', 'relationId'],
        firstOutputItemProperties: [],
      },
      deprecate_relation: {
        inputProperties: ['relationId'],
        inputRequired: ['relationId'],
        outputProperties: ['relationId', 'status', 'relationType'],
        firstOutputItemProperties: [],
      },
    });
  });
});
