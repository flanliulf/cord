import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { QueryService } from '../../services/index.js';
import { QueryRelationsInput, QueryRelationsResult, normalizeProjectRelativePath } from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface QueryRelationsToolDependencies {
  projectRoot: string;
  queryService: QueryService;
}

export function registerQueryRelationsTool(server: McpServer, dependencies: QueryRelationsToolDependencies): void {
  server.registerTool(
    'query_relations',
    {
      description: '查询指定文档的关联关系（支持 1~3 跳）',
      inputSchema: QueryRelationsInput,
      outputSchema: QueryRelationsResult,
      annotations: {
        title: 'Query Relations',
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const docPath = normalizeProjectRelativePath(dependencies.projectRoot, input.docPath, '查询');
      const result = dependencies.queryService.query({
        docPath,
        type: input.type,
        includeDeprecated: input.includeDeprecated,
        depth: input.depth,
      });

      return createStructuredResult(result);
    },
  );
}
