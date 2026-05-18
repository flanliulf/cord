import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AdapterError } from '../../utils/index.js';

export const CORD_AGENTS_START_MARKER = '<!-- CORD:START -->';
export const CORD_AGENTS_END_MARKER = '<!-- CORD:END -->';

interface McpServerEntry {
  command: string;
  args: string[];
}

interface VscodeMcpServerEntry extends McpServerEntry {
  type: 'stdio';
}

export function createNodeMcpEntry(): McpServerEntry {
  return {
    command: 'node',
    args: ['./dist/mcp/server.js'],
  };
}

export function createVscodeMcpEntry(): VscodeMcpServerEntry {
  return {
    type: 'stdio',
    ...createNodeMcpEntry(),
  };
}

export function writeCordOwnedFile(filePath: string, content: string, executable = false): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');

  if (executable) {
    chmodSync(filePath, 0o755);
  }
}

export function ensureFileIfAbsent(filePath: string, content: string): void {
  if (existsSync(filePath)) {
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

export function writeProtectedFile(filePath: string, content: string): void {
  if (existsSync(filePath)) {
    const existingContent = readFileSync(filePath, 'utf8');

    if (existingContent === content) {
      return;
    }

    throw new AdapterError({
      message: `Refusing to overwrite existing IDE config file: ${filePath}`,
      code: 'CORD_ADAPTER_001',
      suggestion: 'Remove or rename the existing IDE config file before running CORD init again.',
      context: {
        error: 'IDE_CONFIG_CONFLICT',
        filePath,
      },
    });
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

export function stringifyJson(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildSharedAgentsSection(): string {
  return [
    CORD_AGENTS_START_MARKER,
    '# CORD Integration',
    '',
    '- Use `query_relations` before editing a document whose upstream/downstream context is unclear.',
    '- Use `analyze_impact` after changing PRD, architecture, epic, story, or other specification documents.',
    '- Use `sync_docs` when CORD reports that related documents are drifting.',
    '- If `.cord/cord.db` does not exist yet, run `init_graph` first to initialize the graph.',
    '- Prefer native IDE instruction files when present: `.claude/rules/cord-relations.md`, `.cursor/rules/cord-relations.mdc`, `.github/copilot-instructions.md`.',
    CORD_AGENTS_END_MARKER,
    '',
  ].join('\n');
}

export function upsertAgentsSection(filePath: string): void {
  const section = buildSharedAgentsSection();

  if (!existsSync(filePath)) {
    writeCordOwnedFile(filePath, section);
    return;
  }

  const existingContent = readFileSync(filePath, 'utf8');
  const startIndex = existingContent.indexOf(CORD_AGENTS_START_MARKER);
  const endIndex = existingContent.indexOf(CORD_AGENTS_END_MARKER);

  if (startIndex === -1 && endIndex === -1) {
    const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
    writeCordOwnedFile(filePath, `${existingContent}${separator}${section}`);
    return;
  }

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throwAgentsConflict(filePath);
  }

  const secondStartIndex = existingContent.indexOf(CORD_AGENTS_START_MARKER, startIndex + CORD_AGENTS_START_MARKER.length);
  const secondEndIndex = existingContent.indexOf(CORD_AGENTS_END_MARKER, endIndex + CORD_AGENTS_END_MARKER.length);

  if (secondStartIndex !== -1 || secondEndIndex !== -1) {
    throwAgentsConflict(filePath);
  }

  const beforeSection = existingContent.slice(0, startIndex);
  const afterSection = existingContent.slice(endIndex + CORD_AGENTS_END_MARKER.length);

  writeCordOwnedFile(filePath, `${beforeSection}${section.trimEnd()}${afterSection}`);
}

function throwAgentsConflict(filePath: string): never {
  throw new AdapterError({
    message: `AGENTS.md contains malformed CORD markers: ${filePath}`,
    code: 'CORD_ADAPTER_002',
    suggestion: 'Fix or remove the malformed CORD section in AGENTS.md, then retry.',
    context: {
      error: 'AGENTS_MD_CONFLICT',
      filePath,
    },
  });
}