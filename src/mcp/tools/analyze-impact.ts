import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ImpactService } from '../../services/index.js';
import { AnalyzeImpactInput, AnalyzeImpactResult, normalizeProjectRelativePath } from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface AnalyzeImpactToolDependencies {
  projectRoot: string;
  impactService: ImpactService;
}

export function registerAnalyzeImpactTool(server: McpServer, dependencies: AnalyzeImpactToolDependencies): void {
  server.registerTool(
    'analyze_impact',
    {
      description: '分析指定文档变更的影响范围',
      inputSchema: AnalyzeImpactInput,
      outputSchema: AnalyzeImpactResult,
      annotations: {
        title: 'Analyze Impact',
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const docPath = normalizeProjectRelativePath(dependencies.projectRoot, input.docPath, '影响分析');
      const result = dependencies.impactService.analyzeImpact({
        docPath,
        confidenceThreshold: input.confidenceThreshold,
      });

      return createStructuredResult(result);
    },
  );
}
