import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfigError } from '../../utils/index.js';
import type { ScanService } from '../../services/index.js';
import { InitGraphInput, InitGraphResult } from './schemas.js';
import { createStructuredResult } from './shared.js';

export interface InitGraphToolDependencies {
  projectRoot: string;
  scanService: ScanService;
}

export function registerInitGraphTool(server: McpServer, dependencies: InitGraphToolDependencies): void {
  server.registerTool(
    'init_graph',
    {
      description: '初始化或重建当前项目的文档关系图谱',
      inputSchema: InitGraphInput,
      outputSchema: InitGraphResult,
      annotations: {
        title: 'Init Graph',
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      if (input.force && !input.rebuild) {
        throw new ConfigError({
          message: '--force 只能与 rebuild=true 一起使用',
          suggestion: '请传入 { rebuild: true, force: true }，或移除 force。',
        });
      }

      const result = await dependencies.scanService.scan({
        projectRoot: dependencies.projectRoot,
        rebuild: input.rebuild,
        force: input.force,
      });

      return createStructuredResult(result);
    },
  );
}
