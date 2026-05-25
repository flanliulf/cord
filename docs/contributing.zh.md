# 贡献指南

[English](contributing.md) | [简体中文](contributing.zh.md)

本文说明 CORD 贡献者在提交代码、文档、测试和框架适配器时应遵守的流程。贡献前请先确认你的改动目标：修复现有问题、补充文档、扩展 CLI/MCP 能力，还是新增框架适配器。

框架适配器贡献的核心原则是：通过适配层扩展能力，不修改扫描、查询和影响分析核心模块。

## 开发前检查

开始前请确认：

- 使用 Node.js 20 LTS 或更高版本。
- 已安装依赖：`npm install`。
- 已阅读与你改动相关的用户文档：
  - CLI 改动：同步阅读 [CLI 参考](cli-reference.zh.md)。
  - MCP Tool 改动：同步阅读 [MCP Tools 参考](mcp-tools-reference.zh.md)。
  - 配置改动：同步阅读 [配置参考](configuration.zh.md)。
  - 框架适配器改动：同步阅读 [框架适配器开发指南](adapter-guide.zh.md)。

## 贡献类型

| 类型       | 常见改动                                   | 必须同步检查                                                          |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------- |
| 文档       | README、快速开始、参考文档、贡献指南       | 链接是否有效，示例命令是否与 CLI/MCP 实际行为一致。                   |
| CLI        | `src/cli/**`、CLI 输出、退出码             | [CLI 参考](cli-reference.zh.md)、测试和 JSON 输出示例。               |
| MCP        | `src/mcp/**`、Tool schema、结构化输出      | [MCP Tools 参考](mcp-tools-reference.zh.md)、schema 名称和示例。      |
| 配置       | `cord.config.*` 解析、默认值、IDE 模板     | [配置参考](configuration.zh.md)、快速开始中的初始化说明。             |
| 框架适配器 | `src/adapters/framework/<framework-name>/` | [框架适配器开发指南](adapter-guide.zh.md)、集成测试和核心零修改确认。 |

## 本地开发流程

1. 安装依赖：`npm install`。
2. 修改前先阅读相关文档和测试，确认行为 owner。
3. 小步提交代码、测试和文档；用户可见能力变更必须同步用户文档。
4. 运行与你改动范围匹配的验证命令。
5. 在 PR 中说明变更目的、测试结果和文档同步情况。

常用开发命令见 [开发指南](../knowledge-base/development-guide.md)。

## 文档同步规则

用户可见行为变化需要同步对应文档：

- 新增或调整 CLI 命令、选项、退出码：更新 [CLI 参考](cli-reference.zh.md)。
- 新增或调整 MCP Tool、字段、schema 或示例：更新 [MCP Tools 参考](mcp-tools-reference.zh.md)。
- 调整配置字段、默认值、扫描边界或 IDE 模板：更新 [配置参考](configuration.zh.md)。
- 改变首次使用路径：更新 [快速开始](getting-started.zh.md) 和 [README](../README.md)。
- 改变贡献流程或测试要求：更新本文和相关开发文档。

文档示例应优先使用可复制的命令和 project-relative 路径，避免依赖开发者本机绝对路径。

## 框架适配器贡献边界

新增框架能力前请确认：

- 新框架能力可以通过 `src/adapters/framework/<framework-name>/` 表达。
- 不需要修改 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts`。
- 至少能提供一个 fixture 项目和一条可验证的预设关系。

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

    try {
      const result = await service.scan({ projectRoot, rebuild: true, force: true });
      const relationCountAfterFirstScan = repo.getRelationCount();

      expect(result.documentsFound).toBeGreaterThan(0);
      expect(result.relationsDiscovered).toBeGreaterThanOrEqual(1);
      expect(repo.getAllDocuments().some((doc) => doc.docType === 'example-spec')).toBe(true);
      expect(
        repo.getAllRelations().some((relation) => relation.source === 'framework_preset'),
      ).toBe(true);

      const repeatedResult = await service.scan({ projectRoot });

      expect(repeatedResult.documentsFound).toBe(0);
      expect(repeatedResult.relationsDiscovered).toBe(0);
      expect(repo.getRelationCount()).toBe(relationCountAfterFirstScan);
    } finally {
      service.close();
    }
  });
});
```

模板中的 `example-project` 应替换为你的 fixture 名称，`example-spec` 应替换为你的文档类型名称。

## 验证命令

提交前至少运行与改动范围匹配的命令。文档改动至少运行格式检查；代码改动至少运行测试。

通用验证：

```bash
npm run format:check
npm run type-check
npm run test
```

框架适配器贡献还必须确认核心模块没有被改动：

```bash
git diff -- src/scanner src/services/query-service.ts src/services/impact-service.ts
```

第二条命令必须没有输出。若出现 diff，说明本次适配器贡献越过了扩展边界，应回到适配层重新设计。

发布或打包相关改动建议补充运行：

```bash
npm run lint
npm run build
npm run smoke:bin
npm run pack:check
```

## PR 规范

PR 描述应包含：

- 变更目的：解决什么用户、贡献者或维护者问题。
- 影响范围：CLI、MCP、配置、文档、框架适配器或内部实现。
- 文档同步：列出已更新或确认无需更新的用户文档。
- 测试说明：列出运行过的命令和结果。

框架适配器 PR 还应包含：

- 适配器名称：对应 `config.framework` 的值。
- 文档类型清单：新增或调整的 `DocTypeDefinition`。
- 预设规则清单：新增或调整的 `PresetRule`，包含关系类型和置信度。
- 核心零修改确认：说明 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts` 无源码修改。

建议提交粒度：

- `feat(adapter): add <framework> framework adapter`
- `test(adapter): cover <framework> scan integration`
- `docs(adapter): document <framework> usage notes`
- `docs(readme): clarify public documentation entry points`
- `fix(cli): reject invalid project paths before service init`

## 常见 PR 最小清单

### 文档-only PR

- 说明文档要解决的读者问题。
- 检查所有新增或调整的本地链接。
- 运行 `npm run format:check`。
- 如果修改 README、快速开始、贡献指南或参考文档，说明是否同步了相关入口。

### CLI bugfix PR

- 写明触发 bug 的命令、参数和预期退出码。
- 补充或更新 CLI 单元测试或集成测试。
- 更新 [CLI 参考](cli-reference.zh.md) 中受影响的命令、输出或退出码。
- 运行 `npm run type-check`、`npm run test`，必要时补充 `npm run lint`。

### MCP schema PR

- 写明新增或修改的 Tool、input/output 字段和兼容性影响。
- 更新 `src/mcp/tools/schemas.ts` 相关测试。
- 更新 [MCP Tools 参考](mcp-tools-reference.zh.md) 中的 schema 表格和调用示例。
- 运行 `npm run type-check`、`npm run test`。

## 审阅流程

维护者审阅时会按以下顺序检查：

1. 用户影响：行为变化是否清楚、必要且向后兼容。
2. 契约一致性：CLI/MCP/config/schema 和文档是否同步。
3. 测试覆盖：是否覆盖成功路径、错误路径和关键边界。
4. 回归风险：验证命令是否通过，是否避免无关改动。
5. 文档体验：新用户或贡献者能否按文档完成任务。

框架适配器 PR 还会额外检查：

1. 扩展边界：适配器是否只通过 `src/adapters/framework/**` 扩展能力。
2. 激活链：注册顺序是否正确，`GenericFrameworkAdapter` 是否仍为最后兜底。
3. 检测逻辑：`detectFramework()` 是否足够明确，避免误判普通项目。
4. 数据声明：文档类型和预设规则是否稳定、可解释、可测试。
5. 测试覆盖：是否有 fixture 和集成测试证明扫描结果。
6. 核心路径 diff：`src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts` 是否为空。
7. 文档体验：贡献者是否能按 `docs/adapter-guide.md` 在 4 小时内完成最小可用适配模块。

审阅可能要求补充 fixture、收紧检测信号、拆分过宽的文档类型，或降低不稳定预设规则的置信度。非阻塞建议可以作为后续 issue，但影响核心边界、测试可靠性或用户配置语义的问题必须在合并前解决。
