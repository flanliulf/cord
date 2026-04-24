---
Epic: 5
Scope: epic
Round: 5
Date: 2026-04-24
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

# Epic 5 Story 设计审查总结

## 审查结论

第 5 轮复审。共审查 Epic 5 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：1 个
- 有条件通过：2 个
- 硬阻塞：2 个

总体判断：round-4 的两条主修订已经继续收敛，`query_relations` 与 `init_graph` 的 canonical DTO 回写基本闭合，`AGENTS.md` appendable 例外也已经进入子 Story、`project-context.md` 与 `04-implementation-patterns-consistency-rules.md`；但 Epic 5 仍有两条高优先级问题没有关完。一条是旧阻塞的最后残段：`AnalyzeImpactResult` 仍未与 Story 3.3 / 4.3 的 canonical 结果结构真正同构，导致 NFR13 / NFR11 在 analyze_impact 这条主路径上仍不可执行。另一条是本轮新发现：Skills 生成仍是孤立模块定义，没有被 `IIdeAdapter` 或 `InitService` 的一键初始化编排接住，FR31 还没有形成端到端交付合同。Epic 5 已接近 ready-for-dev，但本轮后仍不建议直接进入开发。

## 审查范围

- Story 文件：
  - `5-1-mcp-server-core-and-4-tools.md`
  - `5-2-mcp-tools-relation-management.md`
  - `5-3-ide-adapter-and-auto-detection.md`
  - `5-4-initservice-one-click-init-cord-init.md`
  - `5-5-hooks-auto-trigger-and-skills-generation.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/epics/epic-5ai-ide-集成mcp-server-hooks-指令注入.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
  - `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
  - `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
  - `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-summary-20260424-round-4.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-evaluation-20260424-round-4.md`
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

1. Round 4 / Finding #1 的 `query_relations` 与 `init_graph` 子项 — canonical DTO 回写已关闭
   - Story 3.1 已引入 `QueryRelationsOutput { relations, totalCount }`，Story 5.1 的 `QueryRelationsResult` 与之对齐；Story 2.5 的 `ScanResult` 与 Story 5.1 的 `InitGraphResult` 也已对齐到 `documentsFound`、`relationsDiscovered`、`warnings`、`duration`。
   - 验证结果：`query_relations` 与 `init_graph` 这两条输出合同不再存在 round-4 的双口径问题，本轮不再构成阻塞。

### 部分修复但仍未闭合

1. Round 4 / Finding #1 — canonical DTO owner 回写
   - `query_relations` 与 `init_graph` 分支已经关闭，但 `analyze_impact` 分支仍未真正完成：Story 3.3 仍以 `propagationType + suggestedAction` 作为 canonical source，Story 4.3 继续要求附带 `updateStrategy` 元数据，而 Story 5.1 的 `AnalyzeImpactResult` 目前只有 `propagationType + updateStrategy + reason`。
   - 验证结果：DTO 回写不是“完全未做”，但最后一条主线仍未闭合，本轮继续跟踪。

2. Round 4 / Finding #2 — `AGENTS.md` appendable 例外
   - Story 5.3、Story 5.4、`project-context.md` 与 `04-implementation-patterns-consistency-rules.md` 已写入 appendable 例外与 `AGENTS_MD_CONFLICT`。
   - 验证结果：最直接的零侵入冲突已被裁决，但 `03-core-architectural-decisions.md` 仍未同步该决策，父 Epic 5 的测试口径也仍未承接例外，本轮继续跟踪。

### 仍为非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 新发现

### 1. 【高】【新】Skills 生成仍是孤立模块，尚未形成由 init 或 adapter 接住的一键交付合同

- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：5-3、5-4、5-5
- **证据** - 父 Epic 5 与 PRD FR31 都把 Skills 视为 `cord init` 交付闭环的一部分；但 Story 5.3 的 `IIdeAdapter` 目前只有 `generateMcpConfig()`、`generateInstructionFile()`、`generateHooksConfig?()`，没有任何 Skills 生成 seam；Story 5.4 的 InitService 流程也只编排 MCP、指令文件与 Hooks，没有 Skills 步骤或测试 owner；Story 5.5 则只定义了 `src/adapters/ide/skills-generator.ts` 和 4 个 Skills 内容要求，没有把“谁在 init 中调用它、何时调用、为哪个 IDE 调用”回写到 5.3 / 5.4 的共享接口或任务中。
- **影响** - FR31 目前仍可能被实现成“存在一个技能生成器模块”，而不是“`cord init` 一键交付 Skills”。这会让 5.5 成为孤立模块 Story，也让 NFR11 的端到端验证缺少明确前置条件，因为 Skills 产物没有被稳定挂到 init provision 流程里。
- **建议** - 在 5.3 / 5.4 / 5.5 之间选定唯一编排 owner：要么扩展 `IIdeAdapter` 暴露明确的 Skills 生成入口，要么在 InitService 中增加独立的 Skills 生成步骤，并把该步骤同步写入 5.4 的 AC / Tasks / Tests 与 5.5 的任务依赖。

## 逐篇审查结论

### Story 5.1: MCP Server 核心与 4 个 Tools

#### 5.1 结论

硬阻塞

#### 5.1 优点

- `query_relations` 与 `init_graph` 的共享 DTO 漂移已经基本关闭，不再像 round-4 那样在 MCP 侧单边定义全部输出。
- `sync_docs` 的单文档语义与映射边界保持稳定，本轮未再出现越过 Epic 4 metadata-only 的写入漂移。

#### 5.1 关键问题

1. **`AnalyzeImpactResult` 仍未与 canonical `ImpactResult` 真正同构** — Story 3.3 要求 `propagationType + suggestedAction`，Story 4.3 又要求 `updateStrategy` 元数据，而 Story 5.1 目前仍只有 `propagationType + updateStrategy + reason`。
2. **NFR13 / NFR11 在 analyze_impact 路径上仍不可执行** — CLI、MCP、Skills 和 sync_docs 映射仍没有单一字段基线。

#### 5.1 建议动作

- 先在 Story 3.3 / 4.3 裁决 canonical 输出结构，再让 Story 5.1 的 `AnalyzeImpactResult` 完全跟随该结构。
- 若 `updateStrategy` 必须保留，应明确标为附加元数据而不是 parity 字段，并让 `sync_docs` 只消费显式映射后的 wrapper DTO。

### Story 5.2: MCP Tools 关系管理能力

#### 5.2 结论

通过

#### 5.2 优点

- 输入模型、输出模型和测试 owner 均已闭合，`relationId` 与业务三元组职责边界稳定。
- 与 Story 4.1 的 `RelationService` 保持一致，本轮未发现新的局部合同缺口。

### Story 5.3: IDE 适配器与自动检测

#### 5.3 结论

有条件通过

#### 5.3 优点

- `AGENTS.md` appendable 例外已经进入 Story 文本，create / preserve / conflict 三分支不再只停留在口头约定。
- detector 规则与 `--ide` override 主线保持清晰，没有回退到 round-3 之前的双口径。

#### 5.3 关键问题

1. **appendable 例外仍未完成项目级镜像同步** — 03 规则文档与父 Epic 测试口径还没完全跟进。

#### 5.3 建议动作

- 将 appendable 例外同步到 03，并让父 Epic 5 的 NFR12 测试说明显式区分“严格零侵入文件”和“允许注释边界追加的共享文件”。

### Story 5.4: InitService 一键初始化（cord init）

#### 5.4 结论

有条件通过

#### 5.4 优点

- `DetectionResult`、`AMBIGUOUS_IDE`、`--json` 与 `--format json` 的主流程仍然稳定，没有回退。
- `AGENTS.md` appendable 例外已经进入 InitService 流程说明，non-TTY 的 `AGENTS_MD_CONFLICT` 也有了明确方向。

#### 5.4 关键问题

1. **共享文件例外还没有提升为完整 owner** — `AGENTS.md` 三分支目前主要存在于 Dev Notes，父级 AC / 测试口径仍未完全承接。
2. **Skills 生成还未进入 init 编排** — 目前流程走到 Hooks 后即结束，没有单独的 Skills 生成步骤或明确 owner。

#### 5.4 建议动作

- 把 `AGENTS.md` 例外从 Dev Notes 下沉到更明确的验收 / 测试口径。
- 为 Skills 生成补一个明确的 init 编排步骤，并同步到 Tasks / Tests。

### Story 5.5: Hooks 文档变更自动触发与 Skills 生成

#### 5.5 结论

硬阻塞

#### 5.5 优点

- 4 个 Skills 的 schema 引用已经稳定下来，不再使用自然语言描述“预期输出格式”。
- `sync_docs` 的单文档约束也与 5.1 现状保持一致，没有回退到 batch facade。

#### 5.5 关键问题

1. **Skills 生成器仍未被一键初始化流程接住** — 当前只有模块与内容合同，没有明确编排 owner。
2. **AnalyzeImpactResult 仍引用未完全闭合的 canonical 合同** — 5.5 会把 5.1 当前的局部 DTO 继续固化到消费侧。

#### 5.5 建议动作

- 先为 Skills 生成补足 init / adapter 侧 owner，再把 5.5 的任务与测试挂到该编排路径。
- 待 5.1 完成 analyze_impact 的 canonical 对齐后，再最终冻结 `AnalyzeImpactResult` 的消费基线。

## 通过项

- `query_relations` 与 `init_graph` 的 canonical DTO 回写已经关闭，不再构成 epic 级阻塞。
- Story 5.2 仍保持完整通过状态，本轮未出现新的关系管理 contract 回退。
- `AGENTS.md` appendable 例外已经进入子 Story、`project-context.md` 与 04 规则文档，说明共享文件冲突已经从“无裁决”进入“半闭合”状态。

## 结论

- **结论**：不通过
- **阻塞项**：Story 5.1 的 `AnalyzeImpactResult` 尚未与 Story 3.3 / 4.3 的 canonical 输出结构真正同构；Story 5.5 的 Skills 生成仍未形成由 init 或 adapter 接住的一键交付合同。
- **建议**：优先修订 Story 3.3 / 4.3 / 5.1 的 analyze_impact 共享 DTO，再补 Story 5.3 / 5.4 / 5.5 的 Skills 编排 owner；同时把 `AGENTS.md` appendable 例外同步到 03，并修正父 Epic 5 的 NFR12 测试口径。完成后启动第 6 轮 SR 复审。
