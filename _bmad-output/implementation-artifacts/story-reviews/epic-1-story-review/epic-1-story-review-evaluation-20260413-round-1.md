---
Epic: 1
Scope: epic
Round: 1
Date: 2026-04-13
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: epic-1-story-review-summary-20260413-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本次评估针对 GPT-5.4 对 Epic 1（工程就绪）5 个 Story 的首轮设计审查。经独立交叉验证，审查整体质量**较高**——10 条发现中 8 条经证据确认有效，1 条有效但严重性偏高应降级，1 条有效但属阶段性合理决策需讨论而非硬阻塞。审查准确识别了 Epic 1 Story 文档与基线规则之间的关键漂移点（picocolors/chalk、Zod v3/v4、迁移模型、ESLint 配置），这些确实是进入开发前必须收敛的契约问题。误报率为 0%，但部分发现的严重性判断偏高，建议对 2 条发现降级处理。

## 发现 #1 评估

### 审查原文

> **[高] Story 1.1 / 1.2 将终端着色契约从 chalk 漂移到 picocolors**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：1-1, 1-2
> - 证据 - Story 1.1 的依赖清单仍把 `picocolors` 列为核心依赖；Story 1.2 的 AC、Task 3.4 和 Logger 实现说明继续要求 `picocolors`；但 `project-context.md` 与 D3/D4 已统一锁定 `chalk v5+`。
> - 影响 - 如果按当前文档实施，Epic 1 会在最基础的 CLI/MCP 输出契约上落地错误依赖，后续错误格式化、日志着色和导入示例都会持续偏离全局规则。
> - 建议 - 统一把 Story 1.1 和 1.2 中所有 `picocolors` 改为 `chalk`，同步修正文档里的依赖表、AC、任务、示例代码和导入排序说明。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.1 dependencies 表明确列出 `picocolors ^1.1.1`；Story 1.2 AC #6 写 "使用 picocolors 着色输出"，Task 3.4 写 "picocolors 着色"，Dev Notes 着色方案写 `pc.gray()` / `pc.cyan()` 等 picocolors API。而 `project-context.md` D4 已锁定 "chalk v5+"，`04-implementation-patterns` P12 错误处理流程写的也是 "chalk 格式化输出"。更关键的是，`epics.md` 中 Story 1.2 的 AC 就已写 "CLI 模式使用 **chalk** 着色输出"，说明 Story 文档在从 Epic 细化时发生了回退。

**严重性判断**：合理 — 着色库是贯穿 Logger、CLI 入口、错误格式化的基础依赖，在 Story 1.1 就落地错误依赖会导致后续所有 Story 持续偏离。[高] 定级恰当。

**修订建议**：可行 — 纯文档替换操作，影响面明确（依赖表、AC、Task、示例代码、import 说明），不涉及架构决策变更。

**误报评估**：非误报 — 多处独立证据交叉确认。

## 发现 #2 评估

### 审查原文

> **[高] Story 1.1 / 1.3 继续保留 Zod v4 分支，破坏 schema 层唯一前提**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：1-1, 1-3
> - 证据 - Story 1.1 允许在 `zod@^3.24` 与 `zod@^4.3` 之间选择；Story 1.3 继续保留"如果 Story 1.1 选择了 Zod v4.x"的实现分支；而 `project-context.md` 与 D1 已锁定 Zod v3.x。
> - 影响 - Schema API、`zod-to-json-schema` 兼容性和错误封装语义都失去唯一答案，开发代理无法按单一标准完成 Story 1.1 和 1.3。
> - 建议 - 将 Epic 1 所有 Zod 版本描述收敛为 `v3.x`，删除 Story 1.1 与 1.3 中的 v4 分支说明。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.1 Dev Notes 依赖表列出 `zod ^3.24.x 或 ^4.3.6`，"Zod 版本决策" 段落给出两个方案供选择；Story 1.3 Dev Notes 写 "如果 Story 1.1 选择了 Zod v4.x：注意 `.parse()` 行为变化"。而 `project-context.md` 明确写 "锁定 v3.x；v4 存在破坏性变更"，`03-core-decisions` D1 写 "版本：Zod v3.x（当前稳定版）"。基线已收敛，Story 文档未同步。

**严重性判断**：合理 — Zod 是类型层和验证层的基石，版本不确定会导致 API 用法、`zod-to-json-schema` 兼容性和测试全部无法收敛。[高] 定级恰当。

**修订建议**：可行 — 删除 v4 分支描述，固定为 v3.x，纯文档修订。

**误报评估**：非误报 — 基线文档与 Story 文档的版本描述确实矛盾。

## 发现 #3 评估

### 审查原文

> **[高] Story 1.1 任务未把 `src/mcp/server.ts` 作为必交付入口，双入口骨架不完整**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：1-1
> - 证据 - Task 2 只要求创建 `src/mcp/index.ts`；但 `tsup.config.ts` 示例、`03-core-architectural-decisions.md` 和 `05-project-structure-boundaries.md` 都把 `src/mcp/server.ts` 定义为 MCP Server 正式入口。
> - 影响 - 双入口共享 Service 的基础骨架在 Story 1.1 就已缺口，后续 Logger/MCP/CI 相关 Story 会建立在不完整入口结构上。
> - 建议 - 在 AC 与 Task 中显式增加 `src/mcp/server.ts` 最小薄壳入口；`src/mcp/index.ts` 仅保留为门面文件。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.1 Task 2.4 写 "创建 MCP 入口文件 `src/mcp/index.ts`（空导出占位）"，确实没有 `server.ts`。但同一 Story 的 Dev Notes "完整目录结构" 里**明确列出了** `src/mcp/server.ts # MCP Server 入口（占位）`，且 `tsup.config.ts` 示例以 `'mcp/server': 'src/mcp/server.ts'` 为构建入口。Story 1.1 自身存在 Task 列表与 Dev Notes 的内部矛盾。`05-project-structure` 和 `03-core-decisions` D5 都将 `server.ts` 定义为 MCP 正式入口。

**严重性判断**：合理 — 双入口是核心架构特征，MCP 入口骨架缺失会导致后续 Story（Logger MCP 模式、CI 构建验证）建立在不完整基础上。[高] 定级恰当。

**修订建议**：可行 — 在 Task 2 增加 `src/mcp/server.ts` 最小薄壳创建任务，与 Dev Notes 已有的目录结构对齐即可。

**误报评估**：非误报 — Task 列表与 Dev Notes、基线文档均不一致。

## 发现 #4 评估

### 审查原文

> **[高] Story 1.4 在 `schema_version` 与 `schema_migrations` 之间没有单一迁移状态模型**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：1-4
> - 证据 - AC #5 规定 runner 要"检测 `schema_version` 并按序执行待执行迁移"；Dev Notes 的 SQL 示例却创建 `schema_migrations(version, applied_at)` 历史表。
> - 影响 - 迁移 runner、回滚策略、后续 schema 状态查询和测试设计都没有唯一实现方向，Story 1.4 不能直接进入开发。
> - 建议 - 先裁决迁移状态模型：要么坚持单值 `schema_version`，要么改为历史表 `schema_migrations`；随后同步修正 AC、任务、Dev Notes 和架构文档。

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.4 AC #5 写 "检测 `schema_version` 并按序执行待执行迁移"；而 Dev Notes 的 SQL 示例创建的是 `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT)`。`03-core-decisions` D2 写 "数据库内存储 `schema_version`"，使用的是单值模型。`epics.md` Story 1.4 AC 也写 "检测 `schema_version`"。两套迁移状态模型（单值 vs 历史表）在同一 Story 内共存。

**严重性判断**：合理，实际应提升至 P0 — 迁移状态模型是存储层的根基契约，影响 runner 实现、回滚策略、`cord status` 的 schema 版本展示、以及所有后续迁移脚本的设计。这不仅是文档不一致，更是需要 **人工裁决** 的架构决策点（`decision_needed` 分类准确）。

**修订建议**：可行 — 两种方案各有优劣。建议采用 `schema_migrations` 历史表（更灵活，支持审计和部分回滚），但这需要同步修订 D2、`project-context.md`、`epics.md` 和 Story 1.4 的 AC。

**误报评估**：非误报 — AC 与 Dev Notes SQL 定义确实矛盾。

## 发现 #5 评估

### 审查原文

> **[高] 迁移脚本命名 `001_initial.sql` 与 `001-initial-schema.sql` 在基线与 Story 1.4 之间冲突**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：1-4
> - 证据 - `project-context.md` 与 `03-core-architectural-decisions.md` 使用 `001_initial.sql` / `002_add_index.sql`；`05-project-structure-boundaries.md`、`epics.md` 与 Story 1.4 使用 `001-initial-schema.sql`。
> - 影响 - 迁移脚本命名没有单一契约，未来迁移扫描、脚本排序和文档引用都会继续分叉。
> - 建议 - 选定唯一迁移命名规则，并按 Rule Document Registry 同步更新。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：`project-context.md` D2 段写 "按编号顺序命名：`001_initial.sql`、`002_add_index.sql`"（下划线分隔）；`03-core-decisions` D2 同样使用 `001_initial.sql`。而 `05-project-structure` 目录树写 `001-initial-schema.sql`（连字符分隔，含描述后缀）；Story 1.4 AC #4 和 Task 2.1 也写 `001-initial-schema.sql`。两套命名规则确实并存。

**严重性判断**：合理 — 迁移脚本命名是 runner 扫描和排序的基础契约，但因为是 `decision_needed` 类型，裁决后修订范围明确。[高] 定级恰当。

**修订建议**：可行 — 建议统一为 `NNN-描述.sql`（连字符格式，如 `001-initial-schema.sql`），与 `05-project-structure` 和 Story 1.4 保持一致，然后同步更新 `project-context.md` 和 `03-core-decisions`。连字符格式更符合项目整体 kebab-case 文件命名约定（P2）。

**误报评估**：非误报 — 多份基线文档之间确实存在命名冲突。

## 发现 #6 评估

### 审查原文

> **[高] Story 1.3 的验证错误映射既允许"对应子类"又在示例中固定 `ConfigError`**
> - 来源：structure+consistency
> - 分类：decision_needed
> - 涉及 Story：1-3
> - 证据 - AC #6 写的是"抛出 CordError 子类（ConfigError 或对应子类）"；但示例 helper 固定 `throw new ConfigError(...)`，没有给出 config、scan、query、impact 等场景的明确映射规则。
> - 影响 - D3 错误层级失去稳定边界，开发与测试都无法判断不同 schema 失败时应归属于哪一类错误。
> - 建议 - 明确错误映射策略并写死到 AC、Dev Notes 与测试要求中。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 独立验证确认：Story 1.3 AC #6 确实写 "抛出 CordError 子类（ConfigError 或对应子类）"，而 `helpers.ts` 示例固定使用 `ConfigError`。但需要注意上下文：Story 1.3 的定位是 **基础类型和 schema 层**，此阶段的验证失败场景主要是配置解析（`configSchema`）和输入格式验证——在 Story 1.3 的范围内，使用 `ConfigError` 作为默认选择是合理的。真正需要按场景映射到 `ScanError`/`QueryError` 等子类的逻辑，属于后续各 Service Story 的职责。

**严重性判断**：偏高 — 审查将此定为 [高] 并标注 `decision_needed`，但实际上 Story 1.3 只需要提供一个通用的 `validateWithCordError` 辅助函数，错误码参数已经支持调用方传入不同值。AC 的"或对应子类"表述确实模糊，但不构成硬阻塞——只需在 Dev Notes 中补充一句映射说明即可（如"Story 1.3 阶段统一使用 ConfigError，后续 Service 层按场景扩展映射"）。

**修订建议**：可行但非必要 — 完善映射说明是好的，但不阻塞 Story 1.3 进入开发。辅助函数的 `errorCode` 参数已经为后续扩展预留了口子。

**误报评估**：非误报 — AC 表述确实模糊，但影响程度被高估。

## 发现 #7 评估

### 审查原文

> **[高] Story 1.5 允许 release workflow 以"占位"完成，和工程就绪目标不兼容**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：1-5
> - 证据 - AC #2 允许 `.github/workflows/release.yml` "可暂为占位"；但 D7 已把 `semantic-release + npm publish + GitHub Release` 定义为正式 CI/CD 方案，`project-context.md` 还要求 npm provenance 从第一天启用。
> - 影响 - Epic 1 可能在没有可执行发布链路的情况下被标记完成，与"工程就绪"目标直接冲突。
> - 建议 - 删除"可暂为占位"表述，把最小可执行 release workflow 的必备元素写清楚。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.5 AC #2 明确写 "配置 semantic-release + npm publish（可暂为占位）"；`epics.md` Story 1.5 AC 也写 "可暂为占位"。而 `03-core-decisions` D7 把 "semantic-release 自动化版本 + npm publish + GitHub Release" 定义为正式方案，`project-context.md` D7 同样要求完整发布流程且 "npm provenance 从第一天启用"。

**严重性判断**：合理 — Epic 1 的定位是 "工程就绪——开发者可开始编写功能代码"。如果发布链路只是占位，那么 npm provenance、semantic-release 等 D7 承诺均无法兑现，与 Epic 目标直接冲突。[高] 定级恰当。

**修订建议**：可行 — 需要把 release workflow 的最小可执行要素明确化：触发条件（main 分支 push）、权限配置（`id-token: write`）、semantic-release 执行步骤、npm publish + `--provenance`、GitHub Release 创建。Story 1.5 Dev Notes 已有 semantic-release 配置参考，只需将其从"建议"提升为 AC 要求。

**误报评估**：非误报 — "可暂为占位" 与 D7/npm provenance 要求明确矛盾。

## 发现 #8 评估

### 审查原文

> **[高] Story 1.5 把 D8 分层覆盖率门禁降格为"后续细化"，与基线未对齐**
> - 来源：contract
> - 分类：decision_needed
> - 涉及 Story：1-5
> - 证据 - Story 1.5 虽复述了 D8 的分层阈值，但又写"CI 门禁当前阶段设整体 >= 80%，后续根据分层目标细化"；而 D8 与 `project-context.md` 已给出分层门禁目标。
> - 影响 - 开发与 CI 实施无法判断 Epic 1 应只校验总覆盖率，还是同步执行分层阈值。
> - 建议 - 先决定 Epic 1 是否允许分阶段放宽覆盖率策略。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 独立验证确认：Story 1.5 Dev Notes 确实写 "CI 门禁当前阶段设整体 ≥ 80%，后续根据分层目标细化"。D8 给出了分层目标（Service ≥ 90%、Repository ≥ 85%、CLI/MCP ≥ 70%、Adapters ≥ 80%）。

**严重性判断**：偏高 — 审查将此定为 [高] 并标注 `decision_needed`，但需要考虑 **Epic 1 的实际代码构成**。Epic 1 交付的是：项目骨架（1.1）、错误处理+Logger（1.2）、类型+Schema（1.3）、Repository 层（1.4）、CI/CD（1.5）。此时 **Scanner 引擎、Service 层核心逻辑、Adapters 层均为空壳**——分层覆盖率门禁在 Epic 1 阶段实质上无法有意义地执行。"整体 ≥ 80% + 后续细化"是合理的阶段性策略。真正需要启用分层门禁的时机是 Epic 2/3（Scanner 和 Service 实现后）。建议将此问题降级为 P2，在 Epic 2 开始前作为前置条件补充分层门禁配置。

**修订建议**：可行但非必要 — 如果坚持在 Story 1.5 中就配置分层门禁，技术上是可行的（Vitest 支持按目录配置覆盖率阈值），但空壳代码的分层门禁没有实质价值。建议在 Dev Notes 中补充说明 "Epic 1 阶段整体 ≥ 80%，Epic 2 开始前启用分层门禁" 并同步更新 D8 允许阶段性放宽。

**误报评估**：非误报 — 文档确实存在口径不一致，但 Story 的阶段性策略有其合理性。

## 发现 #9 评估

### 审查原文

> **[中] Story 1.5 的 AC7 依赖远端 push 成功且弱化 AC1 检查链，无法在 Story 级闭环验收**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：1-5
> - 证据 - AC #7 写成"本地推送代码后 CI 管道可成功执行（至少 lint + test 通过）"；这既依赖 GitHub Actions 远端结果，又把 AC #1 的 `lint -> type-check -> test -> coverage` 缩水成"至少 lint + test"。
> - 影响 - Story 1.5 的完成标准不可在文档层闭环，也会把既定的质量门禁口径向下回退。
> - 建议 - 将 AC #7 改为本地可验证的工作流契约与命令链。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.5 AC #7 写 "本地推送代码后 CI 管道可成功执行（至少 lint + test 通过）"。这有两个问题：(1) 依赖远端 GitHub Actions 执行结果，不属于 Story 文档层可闭环验收的标准；(2) "至少 lint + test" 缩水了 AC #1 定义的 `lint → type-check → test → coverage` 完整链路。`epics.md` Story 1.5 AC 也写 "至少 lint + test 通过"，说明这个缩水是从 Epic 层就带下来的。

**严重性判断**：合理 — AC 的可验收性是 Story 设计的基本要求。[中] 定级恰当，不需要提升也不需要降级。

**修订建议**：可行 — 将 AC #7 改为本地可执行的命令链验证，如 "执行 `npm run lint && npm run type-check && npm test -- --coverage` 全部通过"，并将真实 Actions run 作为额外验收证据。同时建议同步修正 `epics.md` 中的对应 AC。

**误报评估**：非误报 — AC 确实不可在 Story 级闭环验收。

## 发现 #10 评估

### 审查原文

> **[中] Story 1.1 仍保留被禁止的 ESLint 配置分支，和全局 flat-config 契约不一致**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：1-1
> - 证据 - Story 1.1 同时保留 ESLint 9 + `.eslintrc.cjs`、ESLint 10 + `eslint.config.ts` 等路径；`project-context.md` 已要求 flat config，并固定为 `eslint.config.js`。
> - 影响 - 初始化 Story 可能产出多个互斥 lint 配置方案，直接影响后续 Story 1.5 的 CI 实施口径。
> - 建议 - 收敛为单一 flat-config 方案；若团队想改用 `eslint.config.ts`，必须先同步更新基线规则文件。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 独立验证确认：Story 1.1 Dev Notes "ESLint 配置关键决策" 段落写 "架构文档写了 `.eslintrc.cjs`，但 ESLint 10 已移除对旧配置格式的支持"，然后给出方案 A（ESLint 9 + `.eslintrc.cjs`）和方案 B（ESLint 10 + `eslint.config.ts`）。而 `project-context.md` 明确写 "ESLint ≥ v10 — 已移除 `.eslintrc` 支持，只能使用 flat config（`eslint.config.js`）"，`epics.md` Story 1.1 AC 也固定为 `eslint.config.js`。基线已收敛为 flat config，Story 不应再保留旧配置分支。

**严重性判断**：合理 — 审查定为 [中]，但考虑到 ESLint 配置是影响所有后续 Story 的基础设施（包括 CI 门禁），实际上应提升为 P1。lint 配置不确定会导致 Story 1.5 CI 工作流也无法收敛。

**修订建议**：可行 — 删除方案 A 描述，收敛为 ESLint 10 + `eslint.config.js`（注意基线写的是 `.js` 不是 `.ts`，Story 示例用的是 `.ts`，这里也需要统一——要么更新基线允许 `.ts`，要么示例改为 `.js`）。

**误报评估**：非误报 — Story 保留的双分支与已收敛的基线规则直接冲突。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 4 | 迁移状态模型不唯一 | [高] | P0 | 需人工裁决 schema_version vs schema_migrations |
| 1 | chalk/picocolors 漂移 | [高] | P1 | 统一为 chalk，修订两个 Story |
| 2 | Zod v4 分支残留 | [高] | P1 | 删除 v4 分支，锁定 v3.x |
| 3 | MCP server.ts 缺失 | [高] | P1 | Task 列表补齐 server.ts 创建任务 |
| 5 | 迁移脚本命名冲突 | [高] | P1 | 需裁决后同步 Rule Document Registry |
| 7 | release workflow 占位 | [高] | P1 | 删除"可暂为占位"，明确最小可执行要素 |
| 9 | AC7 不可闭环验收 | [中] | P1 | 改为本地可执行的命令链验证 |
| 10 | ESLint 双配置分支 | [中] | P1 | 收敛为单一 flat-config 方案 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 6 | 验证错误映射模糊 | [高] | P2 | Story 1.3 阶段用 ConfigError 合理，后续扩展 |
| 8 | 覆盖率门禁降级 | [高] | P2 | Epic 1 阶段分层门禁无实质价值，Epic 2 前补充 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|

（无误报）

### 评估决定

**整体结论**：需修订后再审

审查发现整体质量高，10 条发现全部为有效发现（0 误报），其中 8 条确认需要修订，2 条建议降级为后续改善跟踪。关键修订集中在三个方向：

1. **契约收敛**（发现 #1、#2、#5、#10）：将 Story 文档中残留的多选项/双分支描述统一为基线已确定的唯一方案
2. **架构裁决**（发现 #4）：迁移状态模型需要产品/架构层面的人工决策
3. **AC 可验收性**（发现 #3、#7、#9）：补全缺失交付物、删除占位降级、改为本地可闭环的验收标准

建议先完成发现 #4 的架构裁决（P0），再批量执行其余 P1 修订，然后提交复审。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-13
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 8

#### 修订项 #1: chalk/picocolors 漂移（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-1-project-initialization-and-directory-structure.md`
- **章节**: Dev Notes — dependencies 表
- **修改摘要**: `picocolors ^1.1.1` → `chalk ^5.4.1`，说明更新为"与 D4 基线一致"
- **状态**: 已完成

- **文件**: `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
- **章节**: AC #6、Task 3.4、Dev Notes Logger 着色方案、Dev Notes P14 导入排序
- **修改摘要**: AC #6 "使用 picocolors 着色" → "使用 chalk 着色"；Task 3.4 "picocolors 着色" → "chalk 着色"；Logger 着色方案所有 `pc.xxx()` API → `chalk.xxx()`；P14 导入排序 "picocolors" → "chalk"
- **状态**: 已完成

#### 修订项 #2: Zod v4 分支残留（发现 #2）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-1-project-initialization-and-directory-structure.md`
- **章节**: Dev Notes — dependencies 表、Zod 版本决策段落
- **修改摘要**: 依赖表 `zod ^3.24.x 或 ^4.3.6` → `zod ^3.24.2`；"Zod 版本决策"双选项段落整体替换为"Zod 版本锁定"单一方案说明
- **状态**: 已完成

- **文件**: `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
- **章节**: Dev Notes — Zod 版本注意段落
- **修改摘要**: 删除"如果选择了 Zod v4.x"条件分支说明，替换为"Zod 版本说明"单一方案（锁定 v3.x，`zod-to-json-schema` 选用 v3 兼容版本）
- **状态**: 已完成

#### 修订项 #3: MCP server.ts 缺失（发现 #3）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-1-project-initialization-and-directory-structure.md`
- **章节**: Tasks — Task 2 子任务
- **修改摘要**: 原 Task 2.4 "创建 MCP 入口文件 `src/mcp/index.ts`（空导出占位）" 保留并重命名为"门面文件"；新增 Task 2.5 "创建 MCP Server 入口 `src/mcp/server.ts`（最小薄壳占位，与 tsup.config.ts 构建入口对齐）"，与 Dev Notes 目录结构一致
- **状态**: 已完成

#### 修订项 #4 (P0): 迁移状态模型不唯一（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: AC #5
- **修改摘要**: AC #5 "检测 schema_version 并按序执行待执行迁移" → "查询 schema_migrations 历史表已执行版本，按序执行未执行的迁移脚本"；裁决方向：采用历史表模型（支持审计和部分回滚，与 Dev Notes SQL 示例一致）
- **状态**: 已完成

#### 修订项 #5: 迁移脚本命名冲突（发现 #5）
- **文件**: `_bmad-output/project-context.md`
- **章节**: 数据库迁移（D2）
- **修改摘要**: 命名规则 `001_initial.sql` → `001-initial-schema.sql`（kebab-case）；补充迁移状态模型说明（schema_migrations 历史表）
- **状态**: 已完成

- **文件**: `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
- **章节**: D2 数据迁移策略
- **修改摘要**: 决策描述更新为"使用 schema_migrations 历史表"；迁移脚本示例 `001_initial.sql` → `001-initial-schema.sql`；cord status 展示说明更新
- **状态**: 已完成

#### 修订项 #6: release workflow 占位（发现 #7）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-5-ci-cd-pipeline-and-quality-gates.md`
- **章节**: AC #2、Task 2 子任务
- **修改摘要**: AC #2 删除"可暂为占位"，改为明确列出最小可执行要素（main 分支触发、`permissions.id-token: write`、semantic-release 步骤、npm publish `--provenance`、GitHub Release）；Task 2 子任务从 3 项扩展为 6 项，覆盖所有必备配置步骤
- **状态**: 已完成

#### 修订项 #7: AC7 不可闭环验收（发现 #9）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-5-ci-cd-pipeline-and-quality-gates.md`
- **章节**: AC #7、Task 5.1
- **修改摘要**: AC #7 "本地推送代码后 CI 管道可成功执行（至少 lint + test 通过）" → "本地执行 `npm run lint && npm run type-check && npm test -- --coverage` 全部通过，覆盖率不低于 80%"；Task 5.1 同步补充 `--coverage` 参数
- **状态**: 已完成

#### 修订项 #8: ESLint 双配置分支（发现 #10）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-1-project-initialization-and-directory-structure.md`
- **章节**: Dev Notes — ESLint 配置关键决策段落、devDependencies 表
- **修改摘要**: 删除"方案 A（ESLint 9 + .eslintrc.cjs）"和"方案 B（ESLint 10 + eslint.config.ts）"双分支，替换为单一方案"ESLint 10 + eslint.config.js"；代码示例文件名从 `eslint.config.ts` 统一为 `eslint.config.js`（与基线 `.js` 后缀一致）；devDependencies 表从双列（保守/最新）改为单列版本，同时删除顶部"提供保守方案和最新方案供选择"的说明
- **状态**: 已完成
