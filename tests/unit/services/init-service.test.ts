import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IFrameworkAdapter } from '../../../src/adapters/framework/index.js';
import type { IIdeAdapter, SkillsArtifact } from '../../../src/adapters/ide/index.js';
import { InitService } from '../../../src/services/init-service.js';
import { ConfigError } from '../../../src/utils/index.js';

class FakeFrameworkAdapter implements IFrameworkAdapter {
  readonly name = 'generic';

  detectFramework(): boolean {
    return true;
  }

  getDocumentTypes(): [] {
    return [];
  }

  getPresetRules(): [] {
    return [];
  }

  getScanPaths(): string[] {
    return ['docs'];
  }

  getExcludePaths(): string[] {
    return ['node_modules/', '.git/', 'dist/', 'src/'];
  }

  discoverDocuments(): string[] {
    return [];
  }
}

class FakeClaudeIdeAdapter implements IIdeAdapter {
  readonly name = 'claude-code' as const;

  detect(): boolean {
    return true;
  }

  generateMcpConfig(projectRoot: string): void {
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'settings.json'), '{"mcpServers":{}}\n', 'utf8');
  }

  generateInstructionFile(projectRoot: string): void {
    mkdirSync(join(projectRoot, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'rules', 'cord-relations.md'), '# rules\n', 'utf8');
  }

  generateHooksConfig(projectRoot: string): void {
    mkdirSync(join(projectRoot, '.claude', 'hooks'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'hooks', 'cord-post-edit.sh'), '#!/usr/bin/env sh\n', 'utf8');
  }

  generateSkills(): SkillsArtifact[] {
    return [
      {
        targetPath: '.claude/skills/cord-init.md',
        content: '# init skill\n',
      },
    ];
  }
}

class FakeCursorIdeAdapter implements IIdeAdapter {
  readonly name = 'cursor' as const;

  detect(): boolean {
    return true;
  }

  generateMcpConfig(projectRoot: string): void {
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });
    writeFileSync(join(projectRoot, '.cursor', 'mcp.json'), '{"mcpServers":{}}\n', 'utf8');
  }

  generateInstructionFile(projectRoot: string): void {
    mkdirSync(join(projectRoot, '.cursor', 'rules'), { recursive: true });
    writeFileSync(join(projectRoot, '.cursor', 'rules', 'cord-relations.mdc'), '# rules\n', 'utf8');
  }
}

function createProjectRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('InitService', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('writes skills artifacts and keeps only the selected config format', async () => {
    const projectRoot = createProjectRoot('cord-init-service-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const service = new InitService({
      ideRegistry: [new FakeClaudeIdeAdapter()],
      frameworkRegistry: [new FakeFrameworkAdapter()],
    });

    const firstRun = await service.init({ projectRoot, format: 'yaml' });
    const secondRun = await service.init({ projectRoot, format: 'json' });

    expect(firstRun.generatedSkills).toEqual(['.claude/skills/cord-init.md']);
    expect(firstRun.generatedFiles).not.toContain('.claude/skills/cord-init.md');
    expect(readFileSync(join(projectRoot, '.claude', 'skills', 'cord-init.md'), 'utf8')).toBe('# init skill\n');
    expect(secondRun.configPath).toBe(join(projectRoot, 'cord.config.json'));
    expect(secondRun.generatedFiles).not.toContain('.claude/skills/cord-init.md');
    expect(readFileSync(join(projectRoot, 'cord.config.json'), 'utf8')).toContain('"framework": "generic"');
    expect(() => readFileSync(join(projectRoot, 'cord.config.yaml'), 'utf8')).toThrow();
  });

  it('normalizes ambiguous IDE detection into a structured candidates list', async () => {
    const projectRoot = createProjectRoot('cord-init-ambiguous-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });

    const service = new InitService();

    await expect(service.init({ projectRoot })).rejects.toMatchObject({
      message: 'Multiple IDE environments were detected: claude-code, cursor',
      code: 'CORD_CONFIG_006',
      suggestion: '请使用 --ide 标志显式指定 IDE',
      context: {
        error: 'AMBIGUOUS_IDE',
        candidates: ['claude-code', 'cursor'],
      },
    } satisfies Partial<ConfigError>);
  });

  it('skips skills generation when the selected IDE adapter does not support it', async () => {
    const projectRoot = createProjectRoot('cord-init-no-skills-');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const service = new InitService({
      ideRegistry: [new FakeCursorIdeAdapter()],
      frameworkRegistry: [new FakeFrameworkAdapter()],
    });

    const result = await service.init({ projectRoot, format: 'yaml' });

    expect(result.generatedSkills).toEqual([]);
    expect(readFileSync(join(projectRoot, '.cursor', 'mcp.json'), 'utf8')).toContain('mcpServers');
  });
});