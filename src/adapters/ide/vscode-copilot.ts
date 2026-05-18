import { join } from 'node:path';
import { detectVscodeCopilot } from './detector.js';
import type { IIdeAdapter } from './interfaces.js';
import { createVscodeMcpEntry, stringifyJson, upsertAgentsSection, writeProtectedFile } from './shared.js';

const COPILOT_INSTRUCTIONS_FILE = '.github/copilot-instructions.md';
const VSCODE_MCP_FILE = '.vscode/mcp.json';

export class VscodeCopilotAdapter implements IIdeAdapter {
  readonly name = 'vscode-copilot' as const;

  detect(projectRoot: string): boolean {
    return detectVscodeCopilot(projectRoot);
  }

  generateMcpConfig(projectRoot: string): void {
    writeProtectedFile(
      join(projectRoot, VSCODE_MCP_FILE),
      stringifyJson({
        servers: {
          cord: createVscodeMcpEntry(),
        },
      }),
    );
  }

  generateInstructionFile(projectRoot: string): void {
    writeProtectedFile(join(projectRoot, COPILOT_INSTRUCTIONS_FILE), buildCopilotInstructions());
    upsertAgentsSection(join(projectRoot, 'AGENTS.md'));
  }
}

function buildCopilotInstructions(): string {
  return [
    '# CORD Copilot Instructions',
    '',
    '- Before editing requirement, architecture, epic, or story documents, call `query_relations` to inspect context.',
    '- After saving meaningful document changes, call `analyze_impact` to identify affected documents.',
    '- When CORD reports drift that should be synchronized, call `sync_docs`.',
    '- If the graph has not been initialized yet, call `init_graph` first.',
    '- Use `AGENTS.md` as the shared fallback instructions file for tools that also consume it.',
    '',
  ].join('\n');
}