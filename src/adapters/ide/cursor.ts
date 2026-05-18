import { join } from 'node:path';
import { detectCursor } from './detector.js';
import type { IIdeAdapter } from './interfaces.js';
import { createNodeMcpEntry, stringifyJson, writeCordOwnedFile, writeProtectedFile } from './shared.js';

const CURSOR_RULE_FILE = '.cursor/rules/cord-relations.mdc';
const CURSOR_MCP_FILE = '.cursor/mcp.json';

export class CursorAdapter implements IIdeAdapter {
  readonly name = 'cursor' as const;

  detect(projectRoot: string): boolean {
    return detectCursor(projectRoot);
  }

  generateMcpConfig(projectRoot: string): void {
    writeProtectedFile(
      join(projectRoot, CURSOR_MCP_FILE),
      stringifyJson({
        mcpServers: {
          cord: createNodeMcpEntry(),
        },
      }),
    );
  }

  generateInstructionFile(projectRoot: string): void {
    writeCordOwnedFile(join(projectRoot, CURSOR_RULE_FILE), buildCursorRuleFile());
  }
}

function buildCursorRuleFile(): string {
  return [
    '---',
    'description: "CORD 文档关系维护"',
    'alwaysApply: false',
    'globs: ["**/*.md", "**/*.mdx", "docs/**/*"]',
    '---',
    '',
    '本项目使用 CORD 管理文档关系。',
    '',
    '编辑需求、架构、Epic、Story 等文档前先调用 `query_relations`。',
    '变更完成后调用 `analyze_impact` 判断受影响文档。',
    '如 CORD 返回同步建议，再调用 `sync_docs`。',
    '如果 `.cord/cord.db` 不存在，先运行 `init_graph`。',
    '',
  ].join('\n');
}