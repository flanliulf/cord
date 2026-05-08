# Story 2.4: 配置加载与文档管辖范围

Status: done

## Story

As a 用户，
I want 通过 cord.config 配置文件控制文档扫描范围和行为，
So that 我可以自定义哪些文档被扫描、哪些路径被排除。

## Acceptance Criteria (AC)

1. **Given** Stories 2.1-2.3 就绪 **When** 实现配置加载 **Then** `src/utils/config-loader.ts` 支持加载 `cord.config.yaml`（优先）和 `cord.config.json`
2. **Given** 配置加载 **When** 验证 **Then** 配置通过 Zod schema 验证
3. **Given** 配置系统 **When** 检查配置项 **Then** 支持 7 项配置：framework、ide、scanPaths、excludePaths、confidenceThreshold、relationTypes、adapters（其中 `relationTypes` 为已有 9 类关系的启用/禁用配置，不支持扩展新类型）
4. **Given** 未配置时 **When** 使用默认值 **Then** 所有配置项均可选，使用合理默认值
5. **Given** 管辖范围 **When** 检查 **Then** 包括框架产出文档、AI IDE 指令规范文档、用户文档（FR38）（v0.1：AI IDE 指令规范文档通过手动配置 scanPaths 包含；IDE adapter 预设路径属 Epic 5 范围，v0.1 不实现）
6. **Given** 排除规则 **When** 检查 **Then** 排除 src/、node_modules/、.git/、dist/（FR39）
7. **Given** 框架预设 **When** 检查 **Then** 支持已支持框架的预设文档路径（FR40）（v0.1：仅支持框架预设路径；IDE 预设路径延至 Epic 5，config.ide 存在时 v0.1 始终跳过）
8. **Given** 用户自定义 **When** 覆盖配置 **Then** 用户配置可覆盖预设（FR41）
9. **Given** 实现完毕 **When** 运行测试 **Then** 覆盖 YAML/JSON 加载 + Zod 验证 + 默认值回退 + 路径排除

## Tasks / Subtasks

- [x] Task 1: 实现 config-loader.ts (AC: #1, #2, #3, #4)
  - [x] 1.1 加载优先级：cord.config.yaml > cord.config.json
  - [x] 1.2 复用 `src/schemas/config.ts` 的 `configSchema` 进行 Zod schema 验证（与 Story 1.3 共享 schema，禁止创建私有 schema）
  - [x] 1.3 默认值合并
- [x] Task 2: 默认配置定义 (AC: #4, #6)
  - [x] 2.1 默认 excludePaths: ["src/", "node_modules/", ".git/", "dist/"]
  - [x] 2.2 默认 confidenceThreshold: 0.50
  - [x] 2.3 默认 scanPaths: ["."]
- [x] Task 3: 框架预设路径集成（IDE 预设路径延至 Epic 5）(AC: #5, #7, #8)
- [x] Task 4: 更新 index.ts 门面
- [x] Task 5: 编写测试 (AC: #9)

## Dev Notes

### 配置加载函数签名

```typescript
// src/utils/config-loader.ts
export function loadConfig(projectRoot: string): CordConfig
```

- 同步函数（启动阶段调用）
- 文件不存在时返回默认配置（不报错）
- 文件存在但无效时抛出 ConfigError

### YAML 解析

使用 `gray-matter`（已安装）的 YAML 解析能力，或直接解析 YAML。配置文件不含 frontmatter，直接解析整个文件为 YAML 对象。

### 默认配置

```typescript
const DEFAULT_CONFIG: CordConfig = {
  scanPaths: ['.'],
  excludePaths: ['src/', 'node_modules/', '.git/', 'dist/', '.cord/'],
  confidenceThreshold: 0.50,
  // framework: undefined — 未指定时由 adapter resolution 自动检测
  // ide: undefined — 未指定时不启用 IDE 特定文档路径
  // relationTypes: undefined — 未指定时 9 类关系全部启用
  // adapters: undefined — 未指定时使用内置 adapter registry
};
```

### relationTypes 语义说明

`relationTypes` 的产品语义为「对已有 9 类关系的启用/禁用配置」，**不支持扩展新关系类型**。这与 Story 1.3 的 `RELATION_TYPES` (`as const` 9 种固定类型) 保持一致。

```typescript
// 示例配置：禁用特定关系类型
relationTypes:
  references: { enabled: true }
  contains: { enabled: true }
  deprecated: { enabled: false }  // 禁用该类型的自动发现
```

### effectiveScanPaths 计算契约

config-loader 导出的 `loadConfig()` 返回 `CordConfig` 后，ScanService（Story 2.5）需要将用户配置、框架预设路径和默认值组合为一个确定性的 **有效扫描路径集合（effectiveScanPaths）**。规则如下：

1. **基础路径**：`config.scanPaths`（默认 `['.']`）
2. **框架预设追加**：已解析的框架 adapter 的 `getScanPaths(config)` 返回的路径**追加**到基础路径（不替换）
3. **IDE 预设追加**：`config.ide` 已配置时，通过对应 IDE adapter 的 `getScanPaths(config)` 追加 IDE 特定路径（如 AI IDE 指令规范目录）；`config.ide` 未配置时跳过此步骤（v0.1：IDE adapter 属 Epic 5 范围，尚未实现；v0.1 中 `config.ide` 默认为空，此步骤始终跳过）
4. **排除过滤**：`config.excludePaths` + 框架/IDE adapter 的 `getExcludePaths(config)` 在最终路径上统一过滤
5. **优先级**：用户 `excludePaths` > 框架/IDE 预设 `excludePaths` > 默认排除（`src/`、`node_modules/`、`.git/`、`dist/`）
6. **glob 生效范围**：Story 2.3 的文档类型 glob（如 `**/*validation*.md`）仅在 effectiveScanPaths 发现的候选文件上匹配，不在全仓库范围匹配

> **设计决策**：effectiveScanPaths 的计算逻辑位于 ScanService.scan() 方法中（Story 2.5 步骤 2b，步骤 3 之前），而非 config-loader 中。config-loader 只负责加载和验证配置，不依赖 adapter。

### 架构约束

- **D6**: YAML + JSON 双格式，YAML 优先
- Zod 验证失败 → ConfigError

### Project Structure Notes

- `src/utils/config-loader.ts` — 配置加载器
- `tests/unit/utils/config-loader.test.ts` — 测试
- `tests/fixtures/configs/valid-config.yaml` — 有效配置 fixture
- `tests/fixtures/configs/invalid-config.yaml` — 无效配置 fixture

### References

- [Source: architecture/core-architectural-decisions.md#D6] — 配置文件格式
- [Source: prd.md#FR38-FR41] — 文档管辖范围
- [Source: prd.md#cord.config] — 配置 schema
- [Source: epics.md#Story 2.4] — 验收标准来源

## Dev Agent Record

### Agent Model Used

- GPT-5.4

### Debug Log References

- `npm test -- tests/unit/utils/config-loader.test.ts tests/unit/adapters/framework/bmad/adapter.test.ts`
- `npm test -- tests/unit/adapters/framework.test.ts tests/unit/adapters/framework/bmad/adapter.test.ts tests/unit/adapters/framework/bmad/classification.test.ts tests/unit/utils/errors.test.ts tests/unit/utils/logger.test.ts tests/unit/utils/config-loader.test.ts`
- `npm test && npm run type-check && npm run lint`

### Completion Notes List

- 实现 `src/utils/config-loader.ts`，支持 `cord.config.yaml` 优先于 `cord.config.json` 加载，并在无配置文件时返回默认配置。
- 复用 `src/schemas/config.ts` 中的共享校验逻辑完成 7 项配置验证，非法 YAML/JSON 或 schema 违例统一抛出 `ConfigError`。
- 为 BMAD 适配器补充框架预设扫描路径 `_bmad-output` 与 `docs`，并保持用户 `scanPaths` 可覆盖预设；IDE 预设路径按 Story 范围继续延后到 Epic 5。
- 新增/更新单元测试覆盖 YAML/JSON 加载优先级、默认值回退、Zod 校验、BMAD 预设路径与用户覆盖路径场景。

### File List

- src/utils/config-loader.ts
- src/utils/index.ts
- src/adapters/framework/bmad/adapter.ts
- tests/unit/utils/config-loader.test.ts
- tests/unit/adapters/framework/bmad/adapter.test.ts
- _bmad-output/implementation-artifacts/stories/2-4-config-loading-and-document-scope.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-05-08: 实现 cord.config 加载器、默认配置、BMAD 预设扫描路径与对应测试。
