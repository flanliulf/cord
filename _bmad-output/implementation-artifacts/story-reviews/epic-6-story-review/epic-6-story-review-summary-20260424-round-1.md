---
Epic: 6
Scope: epic
Round: 1
Date: 2026-04-24
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 2
---

# Epic 6 Story 设计审查总结

## 审查结论

首轮审查。共审查 Epic 6 下 2 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：1 个

总体判断：Epic 6 的两个 Story 都具备基本结构和目标文件落点，但当前规格仍存在父 Epic 契约下沉不完整的问题。Story 6.1 的主要问题是贡献者文档边界与可执行验收口径未锁定；Story 6.2 则直接遗漏了 MCP Tool 输入/输出 schema 与框架适配配置等上层硬约束。进入开发前应先补齐这些规格缺口，否则文档可以“写完”但仍与前序 Epic 和架构基线失配。

## 审查范围

- Story 文件：
  - `6-1-framework-adapter-contributor-docs.md`
  - `6-2-user-docs-and-readme.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/prd.md`
  - `planning-artifacts/epics/epic-6社区贡献体验与文档交付.md`
  - `planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `planning-artifacts/architecture/05-project-structure-boundaries.md`
  - `implementation-artifacts/stories/2-1-framework-adapter-interface-and-generic-fallback.md`
  - `implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
  - `implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`
  - `implementation-artifacts/stories/5-2-mcp-tools-relation-management.md`
  - `implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 新发现

### 1. 【高】6.1 的最小适配教程未覆盖适配器注册与激活共享契约

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - [2-1-framework-adapter-interface-and-generic-fallback.md] 已固定 adapter registry、`resolveAdapter(config, projectRoot)`、`config.framework` 显式优先、`detectFramework()` 自动检测和 Generic fallback 顺序；但 [6-1-framework-adapter-contributor-docs.md] 只要求接口 API、教程和参考实现说明，没有把这些激活条件写进验收边界。
- **影响** - 社区贡献者即使按文档完成最小适配器，也可能产出一个无法被 InitService/ScanService 选中的实现，直接破坏 Epic 6 的“4 小时可交付”目标。
- **建议** - 在 Story 6.1 的 AC 和 Dev Notes 中显式要求文档覆盖：`src/adapters/framework/index.ts` 注册、`resolveAdapter` 选择顺序、`config.framework` 覆盖优先级、`detectFramework()` 自动检测，以及 GenericFrameworkAdapter 最后兜底。

### 2. 【高】6.1 的 4 小时交付与 NFR8 验收边界不可执行

- **来源**：structure+contract
- **分类**：decision_needed
- **涉及 Story**：6-1
- **证据** - [6-1-framework-adapter-contributor-docs.md] 仅写“4 小时内完成最小可用适配模块”“核心模块测试 100% 通过”；而 [prd.md] 的 FR37(d) 已明确最小闭环至少包括文档类型注册、1 条预设规则和通过集成测试。
- **影响** - 当前 Story 无法稳定验收，也无法判断 NFR8 的“零核心源码修改”与“测试 100% 通过”是否真被满足。
- **建议** - 先裁定一个统一验收协议：计时从何时开始、由谁执行、最小适配模块的完成定义是什么、核心模块测试范围是什么；然后把协议写回 AC6/AC7 与对应 Tasks。

### 3. 【高】6.2 将 MCP Tool 文档契约降级为笼统 schema，且未锁定完整 Tool 范围

- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - [6-2-user-docs-and-readme.md] 的 AC4 只要求“每个 Tool 的 schema、场景、调用示例”；而 [prd.md] 要求“输入/输出 schema”，[5-1-mcp-server-core-and-4-tools.md] 与 [5-2-mcp-tools-relation-management.md] 又已冻结 7 个 Tool 的命名 input/output schema、`query_relations.relationId` 和 `sync_docs` 单文档边界。
- **影响** - 如果不把这些 canonical contract 写进 Story，最终用户文档很容易遗漏输出 DTO、关系管理 Tool 或关键字段语义，造成文档与 MCP 实际对外契约漂移。
- **建议** - 将 AC4 收紧为“覆盖全部 7 个 MCP Tool 的命名 inputSchema、命名 outputSchema、使用场景和调用示例”，并显式点名 `relationId` 与 `sync_docs` 的单文档输入边界。

### 4. 【高】6.2 的“< 5 分钟阅读”缺少唯一 happy path 与测量口径

- **来源**：structure+contract
- **分类**：decision_needed
- **涉及 Story**：6-2
- **证据** - [6-2-user-docs-and-readme.md] 的 AC2 只写 getting-started 文档应支持“< 5 分钟阅读”，但没有定义前置环境、唯一流程、计时起止点，也没有验证任务。
- **影响** - 这个 AC 目前不可验证，也无法在后续文档膨胀时做回归检查。
- **建议** - 先裁定唯一的首次上手路径与计时规则，再把它落实为 AC2 和一个明确的试读 / dry-run 任务。

### 5. 【中】6.1 的文档职责分工与架构基线冲突

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - [6-1-framework-adapter-contributor-docs.md] 的 AC3/AC4 与 Dev Notes 把集成测试指南、测试模板、PR 流程混在 adapter-guide 语义内；而 [05-project-structure-boundaries.md] 已把 `adapter-guide.md` 定义为接口 API + 最小适配教程，把 `contributing.md` 定义为 PR 规范 + 审阅流程 + 集成测试指南。
- **影响** - 两份文档的边界不清会导致实现时内容重复、遗漏，且最终产物可能与既定 docs 目录职责不一致。
- **建议** - 明确 adapter-guide 与 contributing 的职责分界；若沿用当前架构约定，应把集成测试指南与 PR 流程入口写回 contributing.md 的 AC / Dev Notes。

### 6. 【中】6.2 的 configuration 文档范围漏掉框架适配配置与双格式边界

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - [6-2-user-docs-and-readme.md] 的 AC5 只保留“cord.config 配置项 + IDE 配置模板”；但 [prd.md] 明确要求再加“框架适配配置”，[03-core-architectural-decisions.md] 还要求说明 YAML/JSON 双格式、加载优先级和 JSON Schema。
- **影响** - configuration 文档可能只覆盖用户常规配置，忽略适配器启用、扫描边界与配置格式规则，削弱 Epic 2 与 Epic 6 的衔接。
- **建议** - 把 AC5 和 Task 5 扩展为：配置项说明 + IDE 配置模板 + 框架适配配置 + 双格式与 Schema 规则，并在 Dev Notes 补充来源锚点。

## 逐篇审查结论

### Story 6.1: 框架适配贡献者文档

#### Story 6.1 结论

有条件通过

#### Story 6.1 优点

- 基本章节完整，目标文档和核心交付对象明确。
- 已显式绑定 FR37、FR42 与 NFR8，整体方向与父 Epic 一致。

#### Story 6.1 关键问题

1. **适配器共享契约未落入教程验收边界** — 目前没有要求文档覆盖 registry、resolveAdapter、config.framework 优先级和 Generic fallback。
2. **4 小时交付与 NFR8 验收协议不完整** — AC6/AC7 缺少计量和验证边界，Tasks 也没有对应验证动作。
3. **adapter-guide 与 contributing 的文档职责冲突** — 与架构 docs 目录约定不一致。

#### Story 6.1 建议动作

- 先补齐 Story 6.1 的 AC2/AC6/AC7 与 Tasks，使其覆盖适配器激活流程、最小交付闭环和 NFR8 验证证据。
- 再同步 adapter-guide / contributing 的职责边界，避免实现阶段再做口径裁剪。

### Story 6.2: 用户文档与 README

#### Story 6.2 结论

硬阻塞

#### Story 6.2 优点

- 已列出 README、快速开始、CLI 参考、MCP 参考、配置参考等主要交付文件。
- README 的高层结构和中文输出要求已经具备。

#### Story 6.2 关键问题

1. **MCP 文档契约缩窄** — AC4 未覆盖输入/输出 schema、7 个 Tool 总范围和关键字段语义。
2. **configuration 范围缺失** — AC5 漏掉框架适配配置与双格式 / JSON Schema 边界。
3. **快速开始时长不可验收** — AC2 缺少唯一 happy path 和测量规则。

#### Story 6.2 建议动作

- 先修正 AC2/AC4/AC5 及对应 Tasks，确保父 Epic、PRD 和 Epic 5 的 canonical contract 全部回写到 Story。
- 再补充 Dev Notes 中对 getting-started、mcp-tools-reference、configuration 的最小覆盖提纲与来源锚点。

## 通过项

- 两个 Story 都具备标准 Story / AC / Tasks / Dev Notes / References 章节，基础结构可继续迭代。
- Story 6.1 与 Story 6.2 都明确要求文档使用中文输出，符合 `document_output_language: Mandarin`。
- Story 6.2 已正确锁定 README、getting-started、cli-reference、mcp-tools-reference、configuration 等主文档落点。

## 总体结论

- **结论**：不通过
- **阻塞项**：Story 6.2 的 MCP / 配置文档契约缺口；Story 6.1 与 Story 6.2 的时长类 AC 缺少可执行验收口径
- **建议**：先修订 Epic 6 的 Story 规格，再进入开发。优先顺序建议为：先补 Story 6.2 的父契约缺项，再裁定两处时长类 AC 的测量协议，最后同步 Story 6.1 的文档职责与教程边界。
