import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RelationService } from '../../services/index.js';
import { RemoveRelationInput, RemoveRelationResult } from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface RemoveRelationToolDependencies {
  relationService: RelationService;
}

export function registerRemoveRelationTool(server: McpServer, dependencies: RemoveRelationToolDependencies): void {
  server.registerTool(
    'remove_relation',
    {
      description: '按 relationId 删除一条关系',
      inputSchema: RemoveRelationInput,
      outputSchema: RemoveRelationResult,
      annotations: {
        title: 'Remove Relation',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      dependencies.relationService.removeRelation({
        relationId: input.relationId,
      });

      return createStructuredResult({
        success: true,
        relationId: input.relationId,
      });
    },
  );
}
