---
Epic: 5
Scope: epic
Round: 5
Date: 2026-04-24
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-5-story-review-summary-20260424-round-5.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 5 Story 设计审查评估（Round 5）

## 评估总结

第 5 轮 SR 复审产出 1 条新发现 + 2 项继续跟踪（round-4 为 2 条新发现 → round-5 为 1 条新发现），整体收敛趋势保持。本轮 1 条新发现 + 2 项跟踪经证据交叉验证后 **全部成立、无误报**。

- **跟踪 #1（analyze_impact canonical DTO 残段）**：Story 3.3 line 64-65 canonical 输出为 `propagationType + suggestedAction`，Story 4.3 line 34-35 又附带 `updateStrategy` 元数据，而 Story 5.1 line 137-145 的 `AnalyzeImpactResult` 实际为 `propagationType + updateStrategy + reason`，**缺失 `suggestedAction`** 且把 `updateStrategy` 由元数据提升为主字段，三方仍不同构 → P1。
- **跟踪 #2（`AGENTS.md` appendable 例外项目级镜像）**：5.3/5.4/project-context.md/04 规则文档已同步，但 03-core-architectural-decisions.md **完全无 AGENTS / appendable / NFR12 例外** 提及，父 Epic 5 line 61-62 仍写「不修改用户已有 IDE 配置文件（NFR12）」+「零侵入验证（SHA-256 校验已有文件不变）」未承接例外 → P1（违反「Rule Document Registry 同步约束」）。
- **新发现 #1（Skills 生成无 init 编排 owner）**：Story 5.4 全文 **零 skill 提及**，Story 5.3 `IIdeAdapter` 无 Skills 生成入口，Story 5.5 仅在 AC #1 的 Given 子句提到「Story 5.4 init 就绪」作为前置，无实际编排 owner → P1（FR31 端到端交付合同断裂）。

Epic 5 已非常接近 ready-for-dev，但本轮后仍不建议进入开发，需先关闭这 3 条 P1 工作面（其中 2 项是 round-4 的尾巴、1 项为新发现）。

## 上轮问题回顾确认

### Round 4 / Finding #1：5.1 以 MCP 侧 DTO 代替共享源合同 — 部分修复

`query_relations` 与 `init_graph` 子项已完全闭合（Story 3.1 引入 `QueryRelationsOutput { relations, totalCount }`，Story 2.5 与 5.1 的 scan/init 输出字段集 `documentsFound + relationsDiscovered + warnings + duration` 已对齐）。但 `analyze_impact` 子项仍未闭合，本轮作为跟踪 #1 继续展开（详见下方独立评估）。

### Round 4 / Finding #2：`AGENTS.md` 追加策略与零侵入基线冲突 — 部分修复

5.3、5.4、`project-context.md`、`04-implementation-patterns-consistency-rules.md` 已同步 appendable 例外与 `AGENTS_MD_CONFLICT`。但 `03-core-architectural-decisions.md` **零提及**（违反「Rule Document Registry 同步约束」）；父 Epic 5 line 61-62 旧 NFR12 测试口径未更新，本轮作为跟踪 #2 继续展开。

### 历史非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 发现 #1 评估（新发现）

### 审查原文

> **【高】【新】Skills 生成仍是孤立模块，尚未形成由 init 或 adapter 接住的一键交付合同**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：5-3、5-4、5-5
> - 证据 - 父 Epic 5 与 PRD FR31 都把 Skills 视为 `cord init` 交付闭环的一部分；但 Story 5.3 的 `IIdeAdapter` 目前只有 `generateMcpConfig()`、`generateInstructionFile()`、`generateHooksConfig?()`，没有任何 Skills 生成 seam；Story 5.4 的 InitService 流程也只编排 MCP、指令文件与 Hooks，没有 Skills 步骤或测试 owner；Story 5.5 则只定义了 `src/adapters/ide/skills-generator.ts` 和 4 个 Skills 内容要求，没有把"谁在 init 中调用它、何时调用、为哪个 IDE 调用"回写到 5.3 / 5.4 的共享接口或任务中。
> - 影响 - FR31 目前仍可能被实现成"存在一个技能生成器模块"，而不是"`cord init` 一键交付 Skills"。这会让 5.5 成为孤立模块 Story，也让 NFR11 的端到端验证缺少明确前置条件。
> - 建议 - 在 5.3 / 5.4 / 5.5 之间选定唯一编排 owner：要么扩展 `IIdeAdapter` 暴露明确的 Skills 生成入口，要么在 InitService 中增加独立的 Skills 生成步骤，并把该步骤同步写入 5.4 的 AC / Tasks / Tests 与 5.5 的任务依赖。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 三处证据全部复现：(1) Story 5.4 全文 grep `skill|Skill|SKILL` 零结果，确认 InitService 编排无 Skills 步骤；(2) Story 5.3 line 36-49 `IIdeAdapter` 接口只暴露 MCP/Instruction/Hooks 三个 seam，无 Skills 生成入口；(3) Story 5.5 仅在 AC #1 的 Given 子句以「Story 5.4 init 就绪」作为前置条件，但 5.5 自身既不属于 init 编排步骤也不被 5.4 调用，形成「孤立模块 Story」。
**严重性判断**：合理 — 三来源命中（structure+consistency+contract）+ 跨 3 个 Story + 直接关联 PRD FR31 与 NFR11，属端到端交付合同断裂。FR31 若仅交付一个生成器模块而无编排 owner，`cord init` 不能保证一键 Skills 落地。
**修订建议**：可行 — 二选一路径明确（扩展 `IIdeAdapter` 暴露 `generateSkills?()` seam vs InitService 中增加独立 Skills 步骤）。前者与现有适配器结构对称（每个 IDE 决定是否产 Skills），后者更集中。建议 **前者**：扩展 `IIdeAdapter` 增加可选 `generateSkills?(targetDir): SkillsArtifact[]`，仅 Claude Code 适配器实现，InitService 在 Hooks 步骤后统一调用，并在 5.4 AC/Tasks/Tests 与 5.5 任务依赖中显式回写。
**误报评估**：非误报 — 三来源闭环、跨 Story 证据完整。

## 跟踪 #1 评估（Round 4 #1 残段）

### 审查原文

> **Round 4 / Finding #1 — canonical DTO owner 回写**
> `query_relations` 与 `init_graph` 分支已经关闭，但 `analyze_impact` 分支仍未真正完成：Story 3.3 仍以 `propagationType + suggestedAction` 作为 canonical source，Story 4.3 继续要求附带 `updateStrategy` 元数据，而 Story 5.1 的 `AnalyzeImpactResult` 目前只有 `propagationType + updateStrategy + reason`。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 三方证据均复现：
- Story 3.3 line 60「此结构为 canonical source；Story 5.1 AnalyzeImpactResult 与本结构对齐（NFR13）」，line 64-65 字段为 `propagationType + suggestedAction`。
- Story 4.3 line 34-35「`ImpactService` 在影响分析结果中附带每个文档的 `updateStrategy` 字段（只读输出）」「`updateStrategy` 是决策元数据」。
- Story 5.1 line 137-145 `AnalyzeImpactResult` 实际为 `propagationType + updateStrategy + reason`，**缺失 `suggestedAction`** 且把 `updateStrategy` 从「附加元数据」提升为主字段。

**严重性判断**：合理 — 三方不同构 → NFR13（CLI/MCP parity）与 NFR11 在 analyze_impact 这条主路径不可断言。`sync_docs` 字段映射表（5.1 line 116-124）虽已建立，但映射的源端基线仍漂移。
**修订建议**：可行 — 应在 Story 3.3 / 4.3 共同裁决一个 canonical DTO（建议：`{ propagationType, suggestedAction, updateStrategy }`，三字段并存，`suggestedAction` 与 `updateStrategy` 分别承担「人读建议」与「机器决策元数据」语义），再让 Story 5.1 的 `AnalyzeImpactResult` 完全跟随；若 `suggestedAction` 与 `updateStrategy` 在语义上重复，需显式声明哪个是 parity 字段、哪个是附加元数据。
**误报评估**：非误报。

## 跟踪 #2 评估（Round 4 #2 残段）

### 审查原文

> **Round 4 / Finding #2 — `AGENTS.md` appendable 例外**
> Story 5.3、Story 5.4、`project-context.md` 与 `04-implementation-patterns-consistency-rules.md` 已写入 appendable 例外与 `AGENTS_MD_CONFLICT`。最直接的零侵入冲突已被裁决，但 `03-core-architectural-decisions.md` 仍未同步该决策，父 Epic 5 的测试口径也仍未承接例外。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 证据复现：
- `03-core-architectural-decisions.md` grep `AGENTS|appendable|append|preserve|零侵入|NFR12` **零结果**，确认决策文档未同步 appendable 例外。
- 父 Epic 5 line 61「全局指令文件生成采用独立文件注入策略，不修改用户已有 IDE 配置文件（NFR12）」、line 62「单元测试：4 种 IDE 检测 + 各适配器配置文件生成 + 零侵入验证（SHA-256 校验已有文件不变）」均未承接 appendable 例外，对 `AGENTS.md` 共享文件的 SHA-256 假设仍是「文件不变」（与 5.3/5.4 的「append CORD 段」直接矛盾）。

**严重性判断**：偏低 — 原始 [按跟踪项处理]，但根据本仓库 `CLAUDE.md` 中的「**规则变更同步约束**」明确要求「凡确认/修改/新增规则边界…必须在同一次操作中同步更新 Rule Document Registry 中列出的所有文档，不得遗漏」，03/04/project-context.md 三者必须互为镜像。当前 03 缺失 + 父 Epic 测试口径错锁，构成已生效但残缺的同步约束违反，同时让 NFR12 测试在 `AGENTS.md` 上无法稳定执行。**升级为 P1**。
**修订建议**：可行 — (1) 在 03 中新增一条 ADR（推荐编号续接当前序列），明确 `AGENTS.md` 为 NFR12 appendable 例外、CORD 注释边界、conflict UX、非 TTY 行为；(2) 修订父 Epic 5 line 61-62，区分「严格零侵入文件」与「允许注释边界追加的共享文件（`AGENTS.md`）」，并把 SHA-256 校验拆为「严格不变」与「CORD 段外不变」两类断言。
**误报评估**：非误报。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | Skills 生成无 init 编排 owner | [高] | P1 | 扩展 `IIdeAdapter` 增加 `generateSkills?()` seam，并由 InitService 编排 |
| 2 | `analyze_impact` canonical DTO 三方不同构 | [跟踪] | P1 | 在 3.3 / 4.3 共同裁决 canonical 字段集，5.1 完全跟随 |
| 3 | `AGENTS.md` appendable 例外 03 / 父 Epic 未同步 | [跟踪] | P1 | 03 增加 ADR + 父 Epic 5 测试口径区分两类零侵入文件 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| — | — | — | — | 本轮无 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | — | — | 本轮无误报 |

### 评估决定

**整体结论**：需修订后再审

建议下一步：将本轮 3 项 P1 修订交由 SR-03 修订器统一落地，建议顺序为：(1) 在 Story 3.3 / 4.3 共同裁决 `analyze_impact` canonical 字段集（建议 `{ propagationType, suggestedAction, updateStrategy }` 三字段并存并标注 parity / 元数据角色），并让 Story 5.1 `AnalyzeImpactResult` 完全跟随，同步检查 5.5 消费侧引用与 5.1 的 `SyncDocsResult` 映射表；(2) 在 Story 5.3 扩展 `IIdeAdapter` 增加 `generateSkills?(targetDir): SkillsArtifact[]` 可选 seam，在 Story 5.4 InitService 流程末段增加 Skills 编排步骤并落到 AC / Tasks / Tests，把 Story 5.5 任务依赖回写到该编排路径；(3) 在 `03-core-architectural-decisions.md` 新增 `AGENTS.md` appendable 例外 ADR，并修订父 Epic 5 line 61-62 的 NFR12 测试口径，区分「严格零侵入文件」与「CORD 注释段外不变的共享文件」（按 Rule Document Registry 同步约束确保 03 / 04 / project-context.md / Epic 5 四处口径一致）。完成后启动第 6 轮 SR 复审，预计可关闭 Epic 5 进入开发。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-24
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 7 项（涉及 Story 3.3、4.3、5.1、5.3、5.4、5.5、03-core-architectural-decisions.md、父 Epic 5）

#### 修订项 #1：Story 3.3 ImpactedDoc 补 updateStrategy 字段并标注双字段语义
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: Dev Notes / ImpactService 设计
- **修改摘要**: `ImpactedDoc` 接口新增 `updateStrategy: UpdateStrategy` 字段（Story 4.3 元数据），并在注释中明确 `suggestedAction`（人读 parity 字段）与 `updateStrategy`（机器决策元数据）的语义分工（跟踪#1 裁决）
- **状态**: ✅ 已完成

#### 修订项 #2：Story 4.3 updateStrategy 语义标注双字段角色
- **文件**: `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
- **章节**: Dev Notes / v0.1 交付边界裁决
- **修改摘要**: 补充 `updateStrategy` 为「机器决策元数据」、`ImpactedDoc.suggestedAction` 为「人读 parity 字段」，两者并存语义不重叠（跟踪#1 裁决），与 Story 3.3 canonical 结构对齐
- **状态**: ✅ 已完成

#### 修订项 #3：Story 5.1 AnalyzeImpactResult 补 suggestedAction 字段
- **文件**: `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`
- **章节**: Dev Notes / MCP Tool Output Schema
- **修改摘要**: `AnalyzeImpactResult` 的 `impactedDocs` 每项新增 `suggestedAction: z.string()` 字段（FR17 parity 字段），并补注各字段语义标注（`suggestedAction` 人读 parity / `updateStrategy` 机器决策元数据）
- **状态**: ✅ 已完成

#### 修订项 #4：Story 5.3 IIdeAdapter 增 generateSkills?() 可选 seam
- **文件**: `_bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md`
- **章节**: Dev Notes / IIdeAdapter 接口
- **修改摘要**: `IIdeAdapter` 接口新增 `generateSkills?(targetDir: string): SkillsArtifact[]` 可选方法，标注仅 Claude Code 实现，其他 IDE 适配器不实现（FR31）
- **状态**: ✅ 已完成

#### 修订项 #5：Story 5.4 AC/Tasks/Tests/流程补 Skills 编排步骤
- **文件**: `_bmad-output/implementation-artifacts/stories/5-4-initservice-one-click-init-cord-init.md`
- **章节**: AC、Tasks/Subtasks、Dev Notes / InitService 流程
- **修改摘要**: 新增 AC #14（Skills 生成编排，FR31）；Task 1 增加子任务 1.3（generateSkills? 调用）并引用 AC #14；新增 Task 4（Skills 生成测试，验证 Claude Code 产出/其他 IDE 跳过）；InitService 流程步骤 8 明确 generateSkills? 编排逻辑（支持/不支持两个分支）
- **状态**: ✅ 已完成

#### 修订项 #6：Story 5.5 AC #1 回写编排 owner 说明
- **文件**: `_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md`
- **章节**: AC #1
- **修改摘要**: AC #1 补充「Skills 生成由 Story 5.4 InitService 通过 `IIdeAdapter.generateSkills?()` 调用本 Story SkillsGenerator 实现（FR31 编排 owner = InitService）」，消除孤立模块 Story 问题
- **状态**: ✅ 已完成

#### 修订项 #7：03-core-architectural-decisions.md 新增 ADR D9 + 父 Epic 5 测试口径修订
- **文件**: `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`，`_bmad-output/planning-artifacts/epics/epic-5ai-ide-集成mcp-server-hooks-指令注入.md`
- **章节**: Decision Impact Analysis 末尾（03）、Story 5.3 AC 部分（父 Epic）
- **修改摘要**: (a) 03 追加 ADR D9：AGENTS.md 为 NFR12 appendable 例外，含三策略（create-if-absent/preserve-if-exists/explicit-conflict）、SHA-256 校验分两类、与其他文档镜像关系；(b) 父 Epic 5 line 61-62 修订：NFR12 补例外声明，SHA-256 校验拆为「严格不变（IDE 专属）」与「CORD 注释段外不变（AGENTS.md）」两类断言
- **状态**: ✅ 已完成
