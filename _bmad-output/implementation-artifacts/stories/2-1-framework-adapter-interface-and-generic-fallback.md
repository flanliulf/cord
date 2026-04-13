# Story 2.1: 框架适配器接口与通用规则退化

Status: ready-for-dev

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

- [ ] Task 1: 定义 IFrameworkAdapter 接口 (AC: #1)
  - [ ] 1.1 `src/adapters/framework/interfaces.ts` — 接口定义
  - [ ] 1.2 定义 DocTypeDefinition 和 PresetRule 类型
- [ ] Task 2: 实现 AbstractFrameworkAdapter (AC: #2)
  - [ ] 2.1 `src/adapters/framework/abstract-base.ts` — 通用逻辑：路径过滤、文件发现、默认排除模式
- [ ] Task 3: 实现 GenericFrameworkAdapter (AC: #3, #4, #5)
  - [ ] 3.1 `src/adapters/framework/generic/adapter.ts`
  - [ ] 3.2 默认排除 src/、node_modules/、.git/、dist/
  - [ ] 3.3 detectFramework() 始终返回 true（兜底适配器）
- [ ] Task 4: 更新 index.ts 门面 (AC: #6)
- [ ] Task 5: 编写单元测试 (AC: #7)

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
  discoverDocuments(projectRoot: string, config: CordConfig): string[];
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

### Debug Log References

### Completion Notes List

### File List
