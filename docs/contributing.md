# 贡献指南

本文说明 CORD 贡献者在提交框架适配器、文档和测试时应遵守的流程。框架适配器贡献的核心原则是：通过适配层扩展能力，不修改扫描、查询和影响分析核心模块。

## 开发前检查

开始前请确认：

- 使用 Node.js 20 LTS 或更高版本。
- 已安装依赖：`npm install`。
- 新框架能力可以通过 `src/adapters/framework/<framework-name>/` 表达。
- 不需要修改 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts`。

## 集成测试编写指南

框架适配器必须有集成测试证明它能在真实扫描路径中工作。优先放在 `tests/integration/cli/` 或 `tests/integration/`，并使用 `tests/fixtures/sample-projects/` 下的 fixture 项目。

集成测试至少覆盖：

- `resolveAdapter(config, projectRoot)` 能选择目标适配器。
- 扫描后目标文档类型被识别。
- 至少 1 条预设规则生成关系。
- 重复扫描不会破坏已有图谱。
- 测试不依赖开发者本机绝对路径。

### 集成测试模板

```ts
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteGraphRepository } from '../../../src/repositories/index.js';
import { ScanService } from '../../../src/services/index.js';

function createTempProjectFromFixture(fixtureName: string): string {
  const targetRoot = mkdtempSync(join(tmpdir(), `cord-${fixtureName}-`));
  const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'sample-projects', fixtureName);
  cpSync(fixtureRoot, targetRoot, { recursive: true });
  return targetRoot;
}

describe('example framework scan integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('scans the example fixture and persists documents and preset relations', async () => {
    const projectRoot = createTempProjectFromFixture('example-project');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.cord'), { recursive: true });

    const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));
    const service = new ScanService(repo);

    const result = await service.scan({ projectRoot, rebuild: true, force: true });

    expect(result.documentsFound).toBeGreaterThan(0);
    expect(result.relationsDiscovered).toBeGreaterThanOrEqual(1);
    expect(repo.getAllDocuments().some((doc) => doc.docType === 'example-spec')).toBe(true);
    expect(repo.getAllRelations().some((relation) => relation.source === 'framework_preset')).toBe(true);

    service.close();
  });
});
```

模板中的 `example-project` 应替换为你的 fixture 名称，`example-spec` 应替换为你的文档类型名称。

## 验证命令

提交前至少运行：

```bash
npm run test
git diff -- src/scanner src/services/query-service.ts src/services/impact-service.ts
```

第二条命令必须没有输出。若出现 diff，说明本次适配器贡献越过了扩展边界，应回到适配层重新设计。

如果改动包含格式或类型层面的调整，也建议运行：

```bash
npm run lint
npm run type-check
```

## PR 规范

PR 描述应包含：

- 变更目的：新增哪个框架、解决什么贡献者或用户问题。
- 适配器名称：对应 `config.framework` 的值。
- 文档类型清单：新增或调整的 `DocTypeDefinition`。
- 预设规则清单：新增或调整的 `PresetRule`，包含关系类型和置信度。
- 测试说明：列出运行过的命令和结果。
- 核心零修改确认：说明 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts` 无源码修改。

建议提交粒度：

- `feat(adapter): add <framework> framework adapter`
- `test(adapter): cover <framework> scan integration`
- `docs(adapter): document <framework> usage notes`

## 审阅流程

维护者审阅时会按以下顺序检查：

1. 扩展边界：适配器是否只通过 `src/adapters/framework/**` 扩展能力。
2. 激活链：注册顺序是否正确，`GenericFrameworkAdapter` 是否仍为最后兜底。
3. 检测逻辑：`detectFramework()` 是否足够明确，避免误判普通项目。
4. 数据声明：文档类型和预设规则是否稳定、可解释、可测试。
5. 测试覆盖：是否有 fixture 和集成测试证明扫描结果。
6. 回归风险：`npm run test` 是否通过，核心路径 diff 是否为空。
7. 文档体验：贡献者是否能按 `docs/adapter-guide.md` 在 4 小时内完成最小可用适配模块。

审阅可能要求补充 fixture、收紧检测信号、拆分过宽的文档类型，或降低不稳定预设规则的置信度。非阻塞建议可以作为后续 issue，但影响核心边界、测试可靠性或用户配置语义的问题必须在合并前解决。