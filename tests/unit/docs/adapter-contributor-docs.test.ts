import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8');
}

describe('framework adapter contributor docs', () => {
  it('documents the IFrameworkAdapter API and adapter activation chain', () => {
    const content = readRepoFile('docs/adapter-guide.md');

    expect(content).toContain('IFrameworkAdapter');
    expect(content).toContain('AbstractFrameworkAdapter');
    expect(content).toContain('src/adapters/framework/index.ts');
    expect(content).toContain('resolveAdapter(config, projectRoot)');
    expect(content).toContain('config.framework');
    expect(content).toContain('detectFramework()');
    expect(content).toContain('GenericFrameworkAdapter');
    expect(content).toContain('文档类型注册');
    expect(content).toContain('预设规则');
  });

  it('documents integration test templates, PR norms, and review flow', () => {
    const content = readRepoFile('docs/contributing.md');

    expect(content).toContain('集成测试模板');
    expect(content).toContain('tests/integration');
    expect(content).toContain('npm run test');
    expect(content).toContain('PR 规范');
    expect(content).toContain('审阅流程');
    expect(content).toContain('src/scanner/**');
    expect(content).toContain('src/services/query-service.ts');
    expect(content).toContain('src/services/impact-service.ts');
  });

  it('keeps BMAD adapter source comments as a contributor reference implementation', () => {
    const adapterSource = readRepoFile('src/adapters/framework/bmad/adapter.ts');
    const docTypesSource = readRepoFile('src/adapters/framework/bmad/doc-types.ts');
    const presetRulesSource = readRepoFile('src/adapters/framework/bmad/preset-rules.ts');

    expect(adapterSource).toContain('参考实现');
    expect(docTypesSource).toContain('贡献者可复制');
    expect(presetRulesSource).toContain('贡献者可复制');
  });
});