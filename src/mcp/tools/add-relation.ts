import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RelationService } from '../../services/index.js';
import {
  AddRelationInput,
  AddRelationResult,
  normalizeProjectRelativePath,
} from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface AddRelationToolDependencies {
  projectRoot: string;
  relationService: RelationService;
}

export function registerAddRelationTool(server: McpServer, dependencies: AddRelationToolDependencies): void {
  server.registerTool(
    'add_relation',
    {
      description: '添加一条手动文档关系',
      inputSchema: AddRelationInput,
      outputSchema: AddRelationResult,
      annotations: {
        title: 'Add Relation',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const sourcePath = normalizeProjectRelativePath(dependencies.projectRoot, input.sourcePath, '添加关系源文档');
      const targetPath = normalizeProjectRelativePath(dependencies.projectRoot, input.targetPath, '添加关系目标文档');
      const relation = dependencies.relationService.addRelation({
        sourcePath,
        targetPath,
        relationType: input.relationType,
      });

      return createStructuredResult({
        relationId: relation.id,
        sourcePath,
        targetPath,
        relationType: relation.relationType,
        source: relation.source,
        status: relation.status,
      });
    },
  );
}
