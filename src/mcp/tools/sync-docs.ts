import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ImpactService } from '../../services/index.js';
import type { UpdateStrategy } from '../../types/index.js';
import { SyncDocsInput, SyncDocsResult, normalizeProjectRelativePath } from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface SyncDocsToolDependencies {
  projectRoot: string;
  impactService: ImpactService;
}

export function registerSyncDocsTool(server: McpServer, dependencies: SyncDocsToolDependencies): void {
  server.registerTool(
    'sync_docs',
    {
      description: '基于单文档变更提供只读同步建议，不执行任何写入',
      inputSchema: SyncDocsInput,
      outputSchema: SyncDocsResult,
      annotations: {
        title: 'Sync Docs',
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const docPath = normalizeProjectRelativePath(dependencies.projectRoot, input.filePath, '同步建议');
      const result = dependencies.impactService.analyzeImpact({ docPath });
      const suggestions = result.impactedDocs.map((item) => ({
        targetPath: item.docPath,
        action: toAction(item.updateStrategy),
        updateStrategy: item.updateStrategy,
        reason: item.suggestedAction,
      }));

      return createStructuredResult({
        suggestions,
        affectedCount: suggestions.length,
      });
    },
  );
}

function toAction(updateStrategy: UpdateStrategy): 'update' | 'review' | 'log_only' {
  switch (updateStrategy) {
    case 'auto':
      return 'update';
    case 'suggest':
      return 'review';
    case 'log_only':
      return 'log_only';
  }
}
