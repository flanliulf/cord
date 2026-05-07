# Story 2.1: 框架适配器接口与通用规则退化

Status: done

## Story

As a 开发者，
I want IFrameworkAdapter 接口、AbstractFrameworkAdapter 抽象基类和通用适配器实现，
So that 扫描引擎可以在无框架时通过通用规则引擎进行关系发现，并为后续框架适配模块提供扩展基础。

## Acceptance Criteria (AC)

1. **Given** Epic 1 的项目基础设施已就绪 **When** 实现框架适配层 **Then** `src/adapters/framework/interfaces.ts` 定义 IFrameworkAdapter 接口（含文档类型注册、预设关系规则、框架检测方法）
2. **Given** 接口已定义 **When** 实现抽象基类 **Then** `src/adapters/framework/abstract-base.ts` 实现 AbstractFrameworkAdapter，提取通用逻辑复用
3. **Given** 基类已定义 **When** 实现通用适配器 **Then** `src/adapters/framework/generic/adapter.ts` 实现 GenericFrameworkAdapter
4. **Given** 通用适配器 **When** 配置扫描路径 **Then** 支持通过 cord.config 的 scanPaths 和 excludePaths 确定文档范围
5. **Given** 通用适配器 **When** 检查排除规则 **Then** 明确排除 src/ 目录下的所有文件（FR39）
6. **Given** 适配模块注册 **When** 注册方式 **Then** 通过声明式方式注册文档类型定义和预设关系规则（FR35）
7. **Given** 实现完毕 **When** 运行测试 **Then** 单元测试覆盖：接口契约验证 + 通用适配器文档发现 + 路径排除逻辑（≥ 80%）

## Tasks / Subtasks

- [x] Task 1: 定义 IFrameworkAdapter 接口 (AC: #1)
  - [x] 1.1 `src/adapters/framework/interfaces.ts` — 接口定义
  - [x] 1.2 定义 DocTypeDefinition 和 PresetRule 类型
- [x] Task 2: 实现 AbstractFrameworkAdapter (AC: #2)
  - [x] 2.1 `src/adapters/framework/abstract-base.ts` — 通用逻辑：路径过滤、文件发现、默认排除模式
- [x] Task 3: 实现 GenericFrameworkAdapter (AC: #3, #4, #5)
  - [x] 3.1 `src/adapters/framework/generic/adapter.ts`
  - [x] 3.2 默认排除 src/、node_modules/、.git/、dist/
  - [x] 3.3 detectFramework() 始终返回 true（兜底适配器）
- [x] Task 4: 更新 index.ts 门面 (AC: #6)
  - [x] 4.1 维护 adapter registry 数组，GenericFrameworkAdapter 始终在末尾
  - [x] 4.2 导出 `resolveAdapter(config, projectRoot)` 函数
- [x] Task 5: 编写单元测试 (AC: #7)
  - [x] 5.4 adapter resolution 测试：显式指定 / 自动检测优先级 / generic 兜底 / 无效名称报错

## Dev Notes

### IFrameworkAdapter 接口设计

```typescript
// src/adapters/framework/interfaces.ts
export interface DocTypeDefinition {
  name: string;          // 如 'prd'、'architecture'
  patterns: string[];    // 文件匹配模式，如 ['**/prd*.md', '**/prd/**/*.md']
  description: string;
}

export interface PresetRule {
  sourceDocType: string;
  targetDocType: string;
  relationType: RelationType;
  confidence: number;    // ≥ 0.90 for framework presets
}

export interface IFrameworkAdapter {
  readonly name: string;
  detectFramework(projectRoot: string): boolean;
  getDocumentTypes(): DocTypeDefinition[];
  getPresetRules(): PresetRule[];
  getScanPaths(config: CordConfig): string[];
  getExcludePaths(config: CordConfig): string[];
  discoverDocuments(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[];
  // 注意：discoverDocuments 接收由 ScanService.computeEffectiveScanPaths() 预计算的最终路径列表，
  // 不再直接消费 CordConfig。effectiveScanPaths 计算逻辑见 Story 2.4 契约。
}
```

### AbstractFrameworkAdapter 通用逻辑

- 文件发现：递归遍历 scanPaths，过滤 excludePaths，只保留 .md 文件
- 使用 `node:fs` 和 `node:path`（不引入外部 glob 库）
- 默认排除模式合并：框架特有排除 + 用户配置排除

### GenericFrameworkAdapter 特点

- `name` = `'generic'`
- `detectFramework()` 始终返回 `true`（作为兜底适配器）
- `getDocumentTypes()` 返回空数组（无特定文档类型）
- `getPresetRules()` 返回空数组（无预设规则）
- 纯依赖 scanPaths/excludePaths 和通用规则引擎

### Adapter Resolution 契约

适配器选择算法定义统一的优先级规则，确保适配器行为确定、可预测：

1. **显式指定**：`config.framework` 非空时，直接加载指定的适配器（如 `'bmad'`），跳过检测
2. **自动检测**：`config.framework` 为空时，按注册顺序依次调用每个适配器的 `detectFramework(projectRoot)`，**首个返回 `true` 的适配器命中**
3. **Generic 兜底**：GenericFrameworkAdapter 注册顺序必须为**最后一个**（`detectFramework()` 恒真），仅在所有特定适配器均未命中时生效

```typescript
// 伪代码：adapter resolution
function resolveAdapter(config: CordConfig, projectRoot: string, registry: IFrameworkAdapter[]): IFrameworkAdapter {
  if (config.framework) {
    return registry.find(a => a.name === config.framework) ?? throwConfigError(...);
  }
  // registry 末尾始终是 GenericFrameworkAdapter
  return registry.find(a => a.detectFramework(projectRoot))!;
}
```

- 注册表（registry）由 `src/adapters/framework/index.ts` 维护，顺序为：`[BmadFrameworkAdapter, ..., GenericFrameworkAdapter]`
- 当 `config.framework` 指定的名称不在 registry 中时，抛出 `ConfigError`

### 架构约束

- **P6**: 通过 `src/adapters/framework/index.ts` 导出
- **P7**: Service 层通过接口依赖适配器
- **P15**: 接口和公共方法必须有 JSDoc

### Project Structure Notes

- `src/adapters/framework/interfaces.ts` — IFrameworkAdapter + DocTypeDefinition + PresetRule
- `src/adapters/framework/abstract-base.ts` — AbstractFrameworkAdapter
- `src/adapters/framework/generic/adapter.ts` — GenericFrameworkAdapter
- `src/adapters/framework/index.ts` — 门面导出

### References

- [Source: architecture/project-structure-boundaries.md] — adapters 目录布局
- [Source: architecture/implementation-patterns-consistency-rules.md#P6-P7] — 模块导出和依赖注入
- [Source: prd.md#FR33-FR36] — 框架适配需求
- [Source: prd.md#FR38-FR41] — 文档管辖范围
- [Source: epics.md#Story 2.1] — 验收标准来源

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `npm test -- tests/unit/adapters/framework.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run test:coverage`

### Completion Notes List

- **AC#1**: `src/adapters/framework/interfaces.ts` 定义 `IFrameworkAdapter`、`DocTypeDefinition`、`PresetRule`，并为公共 API 补充 JSDoc。
- **AC#2**: `src/adapters/framework/abstract-base.ts` 实现通用扫描路径默认值、排除路径合并、递归 Markdown 发现和项目根目录边界保护。
- **AC#3**: `src/adapters/framework/generic/adapter.ts` 实现 `GenericFrameworkAdapter`，提供空文档类型/预设规则声明和恒真 `detectFramework()`。
- **AC#4**: Generic 适配器默认扫描项目根目录，支持 `scanPaths` 自定义范围；`discoverDocuments()` 直接消费 effective scan paths 结果。
- **AC#5**: 默认排除 `src/`、`node_modules/`、`.git/`、`dist/`，并与用户 `excludePaths` 合并生效。
- **AC#6**: `src/adapters/framework/index.ts` 建立声明式 `frameworkAdapters` 注册表，并导出支持显式指定/自动检测/兜底逻辑的 `resolveAdapter()`。
- **AC#7**: `tests/unit/adapters/framework.test.ts` 新增 9 个单元测试，覆盖接口契约、文档发现、路径排除、显式指定、自动检测优先级、generic 兜底和无效名称报错；完整覆盖率门槛通过，framework adapter slice 覆盖率达到 Stmts 86.79%、Branch 80.55%、Funcs 91.66%、Lines 86.79%。

### File List

- `src/adapters/framework/interfaces.ts` — 新增（框架适配器接口、文档类型定义、预设规则定义）
- `src/adapters/framework/abstract-base.ts` — 新增（通用扫描路径、排除路径与 Markdown 文档发现逻辑）
- `src/adapters/framework/generic/adapter.ts` — 新增（GenericFrameworkAdapter 兜底实现）
- `src/adapters/framework/index.ts` — 修改（门面导出、声明式注册表、resolveAdapter）
- `tests/unit/adapters/framework.test.ts` — 新增（framework adapter 单元测试）

## Change Log

- 2026-05-06: 实现 framework adapter 接口、抽象基类、generic fallback 与 adapter resolution，并补齐单元测试与覆盖率验证。
