import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RelationService } from '../../services/index.js';
import { DeprecateRelationInput, DeprecateRelationResult } from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface DeprecateRelationToolDependencies {
  relationService: RelationService;
}

export function registerDeprecateRelationTool(server: McpServer, dependencies: DeprecateRelationToolDependencies): void {
  server.registerTool(
    'deprecate_relation',
    {
      description: '将指定关系标记为 deprecated',
      inputSchema: DeprecateRelationInput,
      outputSchema: DeprecateRelationResult,
      annotations: {
        title: 'Deprecate Relation',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const relation = dependencies.relationService.deprecateRelation({
        relationId: input.relationId,
      });

      return createStructuredResult({
        relationId: relation.id,
        status: relation.status,
        relationType: relation.relationType,
      });
    },
  );
}
