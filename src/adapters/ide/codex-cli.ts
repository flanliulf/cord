import { join } from 'node:path';
import { detectCodexCli } from './detector.js';
import type { IIdeAdapter } from './interfaces.js';
import { upsertAgentsSection } from './shared.js';

export class CodexCliAdapter implements IIdeAdapter {
  readonly name = 'codex-cli' as const;

  detect(projectRoot: string): boolean {
    return detectCodexCli(projectRoot);
  }

  generateMcpConfig(): void {
    // Codex CLI v0.1 only receives the shared AGENTS.md integration.
  }

  generateInstructionFile(projectRoot: string): void {
    upsertAgentsSection(join(projectRoot, 'AGENTS.md'));
  }
}