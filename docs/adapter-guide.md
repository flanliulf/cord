# 框架适配器开发指南

本指南面向希望为 CORD 增加新框架支持的贡献者。目标是在不修改核心扫描、查询和影响分析模块的前提下，用一个最小适配模块完成：文档类型注册、至少 1 条预设关系规则、以及集成测试验证。

## 适配器模型

CORD 的框架适配层由三部分组成：

1. `IFrameworkAdapter`：所有适配器必须实现的统一接口。
2. `AbstractFrameworkAdapter`：推荐继承的基类，提供默认扫描路径、排除路径合并和 Markdown 文件发现逻辑。
3. 具体适配器：例如 BMAD 的 `BmadFrameworkAdapter`，或兜底的 `GenericFrameworkAdapter`。

新增框架时，只在 `src/adapters/framework/<framework-name>/` 下放置框架专属文件，并在 `src/adapters/framework/index.ts` 注册适配器。不要改动 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts` 等核心模块。

## IFrameworkAdapter API

接口定义位于 `src/adapters/framework/interfaces.ts`。

| 成员 | 类型 | 作用 | 最小实现建议 |
|------|------|------|--------------|
| `readonly name` | `string` | 适配器唯一名称，也是 `config.framework` 的匹配值 | 使用小写 kebab 或单词名，例如 `bmad`、`generic` |
| `detectFramework(projectRoot)` | `(projectRoot: string) => boolean` | 自动检测当前项目是否属于该框架 | 检查配置文件、目录结构、依赖或 frontmatter 信号 |
| `getDocumentTypes()` | `() => DocTypeDefinition[]` | 声明该框架可识别的文档类型 | 从单独的 `doc-types.ts` 导出常量 |
| `getPresetRules()` | `() => PresetRule[]` | 声明框架内置关系规则 | 从单独的 `preset-rules.ts` 导出常量 |
| `getScanPaths(config)` | `(config: CordConfig) => string[]` | 给出默认扫描路径，并允许用户配置覆盖 | 通常继承 `AbstractFrameworkAdapter` 默认实现 |
| `getExcludePaths(config)` | `(config: CordConfig) => string[]` | 给出默认排除路径，并合并用户配置 | 通常继承 `AbstractFrameworkAdapter` 默认实现 |
| `discoverDocuments(projectRoot, scanPaths, excludePaths)` | `(projectRoot: string, scanPaths: string[], excludePaths: string[]) => string[]` | 发现最终参与扫描的 Markdown 文件 | 通常继承 `AbstractFrameworkAdapter` 默认实现 |

相关数据结构：

```ts
interface DocTypeDefinition {
  name: string;
  patterns: string[];
  description: string;
}

interface PresetRule {
  sourceDocType: string;
  targetDocType: string;
  relationType: RelationType;
  confidence: number;
}
```

## AbstractFrameworkAdapter 基类

`AbstractFrameworkAdapter` 位于 `src/adapters/framework/abstract-base.ts`。它已经处理了适配器最容易写错的通用逻辑：

- 去重和清理扫描路径。
- 合并默认排除路径与用户配置。
- 递归发现 Markdown 文件。
- 跳过符号链接。
- 将文件结果排序，保证测试和扫描结果稳定。

推荐每个新适配器继承它，只重写以下方法：

```ts
protected override getDefaultScanPaths(): string[] {
  return ['docs'];
}

protected override getDefaultExcludePaths(): string[] {
  return ['src/', 'node_modules/', '.git/', 'dist/'];
}
```

只有当框架需要扫描非 Markdown 文件，或有特殊文件发现规则时，才考虑重写 `discoverDocuments()`。

## 激活链与选择顺序

适配器激活链从注册表开始，由 `resolveAdapter(config, projectRoot)` 统一选择。

1. 在 `src/adapters/framework/index.ts` 中导入并注册适配器。注册表顺序很重要，`GenericFrameworkAdapter` 必须始终放在最后。
2. `resolveAdapter(config, projectRoot)` 先检查 `config.framework`。
3. 如果 `config.framework` 有值，CORD 只按名称查找显式指定的适配器。找不到时抛出 `ConfigError`，不会继续自动检测。
4. 如果未设置 `config.framework`，CORD 按注册表顺序调用每个适配器的 `detectFramework()`。
5. 第一个返回 `true` 的适配器被选中。
6. `GenericFrameworkAdapter` 的 `detectFramework()` 恒定返回 `true`，因此作为最后兜底。

这意味着 `config.framework` 的覆盖优先级最高；自动检测只在没有显式配置时发生。

## 从零创建最小适配模块

下面以 `example` 框架为例。

### 1. 创建目录

```text
src/adapters/framework/example/
  adapter.ts
  doc-types.ts
  preset-rules.ts
```

### 2. 文档类型注册

```ts
// src/adapters/framework/example/doc-types.ts
import type { DocTypeDefinition } from '../interfaces.js';

export const EXAMPLE_DOCUMENT_TYPES: DocTypeDefinition[] = [
  {
    name: 'example-spec',
    patterns: ['**/specs/**/*.md'],
    description: 'Example framework specification documents',
  },
  {
    name: 'example-task',
    patterns: ['**/tasks/**/*.md'],
    description: 'Example framework task documents',
  },
];
```

`name` 是 CORD 图谱中的文档类型值；`patterns` 只用于候选文件分类，不应扩大扫描范围；扫描范围由 `getScanPaths()` 和配置共同决定。

### 3. 编写 1 条预设规则

```ts
// src/adapters/framework/example/preset-rules.ts
import { RELATION_TYPES } from '../../../types/index.js';
import type { PresetRule } from '../interfaces.js';

export const EXAMPLE_PRESET_RULES: PresetRule[] = [
  {
    sourceDocType: 'example-spec',
    targetDocType: 'example-task',
    relationType: RELATION_TYPES.DERIVED_FROM,
    confidence: 0.9,
  },
];
```

预设规则适合表达框架内稳定、可重复推导的关系。`confidence` 建议不低于 `0.9`，避免把弱约定伪装成强关系。

### 4. 实现适配器

```ts
// src/adapters/framework/example/adapter.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AbstractFrameworkAdapter } from '../abstract-base.js';
import type { DocTypeDefinition, PresetRule } from '../interfaces.js';
import { EXAMPLE_DOCUMENT_TYPES } from './doc-types.js';
import { EXAMPLE_PRESET_RULES } from './preset-rules.js';

const EXAMPLE_DEFAULT_SCAN_PATHS = ['docs', 'specs'];
const EXAMPLE_DEFAULT_EXCLUDE_PATHS = ['src/', 'node_modules/', '.git/', 'dist/'];

export class ExampleFrameworkAdapter extends AbstractFrameworkAdapter {
  readonly name = 'example';

  detectFramework(projectRoot: string): boolean {
    return existsSync(join(projectRoot, 'example.config.json'));
  }

  getDocumentTypes(): DocTypeDefinition[] {
    return EXAMPLE_DOCUMENT_TYPES;
  }

  getPresetRules(): PresetRule[] {
    return EXAMPLE_PRESET_RULES;
  }

  protected override getDefaultScanPaths(): string[] {
    return EXAMPLE_DEFAULT_SCAN_PATHS;
  }

  protected override getDefaultExcludePaths(): string[] {
    return EXAMPLE_DEFAULT_EXCLUDE_PATHS;
  }
}
```

### 5. 注册适配器

在 `src/adapters/framework/index.ts` 中注册：

```ts
import { ExampleFrameworkAdapter } from './example/adapter.js';

export { ExampleFrameworkAdapter } from './example/adapter.js';

export const frameworkAdapters: IFrameworkAdapter[] = [
  new BmadFrameworkAdapter(),
  new ExampleFrameworkAdapter(),
  new GenericFrameworkAdapter(),
];
```

保持 `GenericFrameworkAdapter` 在最后。如果你的适配器检测条件很宽，应放在更具体的适配器之后。

## 4 小时最小可用路径

按下面顺序推进，通常可以在 4 小时内交付最小可用适配模块：

| 时间盒 | 目标 | 完成标准 |
|--------|------|----------|
| 0-30 分钟 | 阅读本指南和 BMAD 参考实现 | 能说明 `resolveAdapter(config, projectRoot)` 的选择顺序 |
| 30-90 分钟 | 创建适配器目录和 `adapter.ts` | `detectFramework()` 能命中一份本地 fixture |
| 90-150 分钟 | 注册文档类型 | 至少 1 个 `DocTypeDefinition` 能分类 fixture 文档 |
| 150-210 分钟 | 添加预设规则 | 至少 1 条 `PresetRule` 在扫描后生成关系 |
| 210-240 分钟 | 编写并运行集成测试 | `npm run test` 通过，核心源码路径无修改 |

验收时请确认：文档类型注册完成、至少 1 条预设规则生效、集成测试通过、核心模块没有被改动。

## 自检清单

- [ ] 新适配器实现 `IFrameworkAdapter`，优先继承 `AbstractFrameworkAdapter`。
- [ ] 已在 `src/adapters/framework/index.ts` 注册，且 `GenericFrameworkAdapter` 仍在最后。
- [ ] `config.framework` 显式指定时能选择新适配器。
- [ ] 未显式配置时，`detectFramework()` 可自动检测。
- [ ] 包含至少 1 个 `DocTypeDefinition`。
- [ ] 包含至少 1 条 `PresetRule`。
- [ ] 有集成测试覆盖扫描结果。
- [ ] `npm run test` 通过。
- [ ] `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts` 无修改。