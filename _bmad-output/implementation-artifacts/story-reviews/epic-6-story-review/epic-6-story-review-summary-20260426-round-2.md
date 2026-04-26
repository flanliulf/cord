---
Epic: 6
Scope: epic
Round: 2
Date: 2026-04-26
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 2
---

# Epic 6 Story 设计审查总结（Round 2）

## 审查结论

复审。共复审 Epic 6 下 2 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：1 个

总体判断：Round 1 的 6 条发现中，3 条已完全修复，1 条维持非阻塞待办，另有 2 条仅部分闭合且在修订过程中暴露出更具体的契约残留。当前最大阻塞仍在 Story 6.2 的 MCP canonical contract 漂移；Story 6.1 则只剩 NFR8 的验证锚点需要收敛到真实结构边界。本轮后不建议直接进入开发，仍需先做一次小范围规格修订。

## 审查范围

- Story 文件：
  - `6-1-framework-adapter-contributor-docs.md`
  - `6-2-user-docs-and-readme.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/prd.md`
  - `planning-artifacts/epics/epic-6社区贡献体验与文档交付.md`
  - `planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `planning-artifacts/architecture/05-project-structure-boundaries.md`
  - `implementation-artifacts/stories/2-1-framework-adapter-interface-and-generic-fallback.md`
  - `implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
  - `implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`
  - `implementation-artifacts/stories/5-2-mcp-tools-relation-management.md`
  - `implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md`
  - `implementation-artifacts/story-reviews/epic-6-story-review/epic-6-story-review-summary-20260424-round-1.md`
  - `implementation-artifacts/story-reviews/epic-6-story-review/epic-6-story-review-evaluation-20260424-round-1.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 6.1 教程未覆盖适配器注册与激活契约
   - 修复位置：Story 6.1 AC2、adapter-guide.md 内容大纲。
   - 验证结果：已显式补入 registry、`resolveAdapter`、`config.framework`、`detectFramework()` 和 Generic fallback，和 Story 2.1 共享契约对齐。

2. Round 1 / Finding #5 — 6.1 adapter-guide 与 contributing 职责越界
   - 修复位置：Story 6.1 AC3、Tasks 1/2/4、Dev Notes。
   - 验证结果：集成测试指南与 PR 流程已迁回 `docs/contributing.md`，与 architecture 05 的目录职责一致。

3. Round 1 / Finding #6 — 6.2 configuration 文档范围缺口
   - 修复位置：Story 6.2 AC5、Task 5、配置文档说明、References。
   - 验证结果：已补回框架适配配置，以及 YAML/JSON 双格式与 JSON Schema 规则。

### 仍待闭合

1. Round 1 / Finding #2 — 6.1 的 4 小时交付与 NFR8 验收边界
   - 已补入计时起止点、最小闭环和测试动作。
   - 复审结果：新增的 `src/core/**` diff 锚点与架构基线不一致，未视为完全修复。

2. Round 1 / Finding #3 — 6.2 的 MCP Tool 文档契约漂移
   - 已将 AC4 收紧为“覆盖全部 7 个 Tool 的命名 inputSchema / outputSchema”。
   - 复审结果：Dev Notes、References 和 `relationId` 语义仍未完全对齐 Epic 5 canonical contract，未视为完全修复。

### 仍为非阻塞待办

1. Round 1 / Finding #4 — 6.2 的 `< 5 分钟阅读` 缺少测量口径
   - 维持上一轮评估结论：作为 Epic 6 收尾期的体验回归项处理，本轮未升级为阻塞。

## 新发现

### 1. 【高】【遗留】6.2 的 7 个 MCP Tool 清单与来源归属仍与 Epic 5 canonical contract 不一致

- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - Story 6.2 的 Dev Notes 仍将 Story 5.1 写成 `scan_docs`、`query_relations`、`analyze_impact`、`get_status`，将 Story 5.2 写成 `add_relation`、`remove_relation`、`sync_docs`；References 又把 `sync_docs` 单文档边界挂到 Story 5.2。基准文件 [5-1-mcp-server-core-and-4-tools.md] 固定的是 `analyze_impact`、`query_relations`、`init_graph`、`sync_docs`，[5-2-mcp-tools-relation-management.md] 固定的是 `add_relation`、`remove_relation`、`deprecate_relation`。
- **影响** - Task 4 虽然表面承接了 AC4，但实施者仍会按错误清单撰写 `mcp-tools-reference.md`，导致用户文档继续偏离真实 canonical contract。
- **建议** - 将 Dev Notes 与 References 统一回写为唯一正确的 7 Tool 清单：Story 5.1 = `analyze_impact`、`query_relations`、`init_graph`、`sync_docs`；Story 5.2 = `add_relation`、`remove_relation`、`deprecate_relation`；`sync_docs` 单文档边界只引用 Story 5.1。

### 2. 【高】【新】6.2 把 `relationId` 误写为 `query_relations` 的输入参数语义

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - Story 6.2 的 AC4 与 MCP Tool 清单都写成“`query_relations` 含 `relationId` 参数语义”或“inputSchema（含 `relationId` 参数语义）”。但 [5-1-mcp-server-core-and-4-tools.md] 明确 `relationId` 位于 `query_relations` 的输出 DTO，[5-2-mcp-tools-relation-management.md] 才将 `relationId` 作为 `remove_relation` 与 `deprecate_relation` 的输入句柄。
- **影响** - 文档实现阶段可能会把一个不存在的输入字段写进 `query_relations` 的 schema 说明，直接破坏输入/输出契约边界。
- **建议** - 将 `relationId` 的说明从 `query_relations` 输入语义移到其 outputSchema 或返回结果说明，并注明它是后续 `remove_relation` / `deprecate_relation` 的消费字段。

### 3. 【中】【遗留】6.1 的 NFR8 零变更校验仍锚定到不存在的 `src/core/**`

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - Story 6.1 的 AC7 和 Task 5 新增“diff 验证 `src/core/**` 零修改”。但 [05-project-structure-boundaries.md] 与 [project-context.md] 的正式结构边界为 `src/scanner/`、`src/services/query-service.ts`、`src/services/impact-service.ts` 等，不存在统一的 `src/core` 目录。
- **影响** - 当前验证动作无法准确覆盖 PRD NFR8 所指的真实核心模块，可能在“检查通过”的情况下仍遗漏对核心代码的改动。
- **建议** - 将 NFR8 的零变更校验锚点改为真实结构边界，例如 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts`，或直接使用“scanner/query/impact 核心模块源码零修改”的统一表述，并让 AC7 与 Task 5 完全一致。

## 逐篇审查结论

### Story 6.1: 框架适配贡献者文档

#### Story 6.1 结论

有条件通过

#### Story 6.1 优点

- 上轮缺失的适配器激活链已经补回到 AC2 和教程大纲。
- `adapter-guide.md` 与 `contributing.md` 的职责边界已与架构基线重新对齐。

#### Story 6.1 关键问题

1. **NFR8 零变更验证锚点仍不正确** — `src/core/**` 不是当前项目结构中的有效核心模块边界。

#### Story 6.1 建议动作

- 将 AC7 与 Task 5 的 diff 校验路径改为 architecture 05 与 project-context 已定义的真实核心模块路径。

### Story 6.2: 用户文档与 README

#### Story 6.2 结论

硬阻塞

#### Story 6.2 优点

- AC4 已从 Round 1 的模糊“schema”收紧到命名 inputSchema / outputSchema。
- AC5、Task 5 和配置文档说明已经补回框架适配配置与双格式规则。

#### Story 6.2 关键问题

1. **7 个 Tool 的 canonical roster 仍漂移** — Dev Notes 和 References 还在引用错误的 Tool 名与来源归属。
2. **`relationId` 输入/输出边界写反** — `query_relations` 被错误描述为消费 `relationId` 输入。

#### Story 6.2 建议动作

- 统一修正 AC4、Dev Notes 与 References 的 Tool 清单、来源 Story 和 `relationId` 语义，再进入开发。

## 通过项

- Round 1 中关于 6.1 激活链、文档职责分工、6.2 configuration 范围缺口的修订已经闭合。
- Story 6.2 的 `< 5 分钟阅读` 口径问题仍为已知非阻塞待办，且本轮未发现其进一步恶化。
- 两个 Story 仍保持完整的 Story / AC / Tasks / Dev Notes / References 基本结构。

## 结论

- **结论**：不通过
- **阻塞项**：Story 6.2 的 MCP canonical contract 残留漂移；Story 6.1 的 NFR8 零变更验证锚点无效
- **建议**：先修正 Story 6.2 的 Tool roster、References 与 `relationId` 语义，再收敛 Story 6.1 的核心模块校验路径，随后执行 SR Round 3 复审。
