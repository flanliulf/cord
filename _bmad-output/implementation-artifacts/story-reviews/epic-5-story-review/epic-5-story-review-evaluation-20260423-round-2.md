---
Epic: 5
Scope: epic
Round: 2
Date: 2026-04-23
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-5-story-review-summary-20260423-round-2.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 5 Story 设计审查评估（Round 2）

## 评估总结

第 2 轮 SR 复审共提出 5 条新发现，全部经证据交叉验证后 **确认成立、无误报**。Round 1 的 6 个原始阻塞已在本轮被审查者确认实际写入对应 Story（5.1 FR32 并发 AC、5.2 输入 schema、5.3 Copilot 交付物、5.4 `--format json`/`--ide` override 等），但修订过程中暴露出 4 个二阶契约缺口（关系查询 `relationId` 闭环、`sync_docs` 可执行 Service 映射、MCP Tool 输出 schema 冻结、`cord init` 自动化场景组合合同），以及 1 个新出现的检测信号冲突（`AGENTS.md` 共享化与 Codex CLI 排他探针）。其中 4 条 [高] 全部按 P1 阻塞处理；1 条 [中]（#5）虽涉及共享文档与 detector 规则冲突，但属于会让自动检测在 Copilot 项目中稳定误判的硬一致性问题，建议同样升级为 P1 阻塞。Epic 5 仍不建议进入开发，需完成本轮 5 项修订后再启动第 3 轮 SR 复审。

## 上轮问题回顾确认

### Round 1 / Finding #1：关系管理 MCP Tool 缺少对外稳定输入契约 — 已确认修复

Story 5.2 已写入业务三元组 + `relationId` 二分输入合同，并补共享 Zod schema。原始阻塞已关闭。本轮 #1 是修订引出的二阶问题（读侧未提供句柄），不属于本项的回归。

### Round 1 / Finding #2：Story 5.1 未承接 FR32 并发查询请求合同 — 已确认修复

Story 5.1 已新增 AC #11 和并发只读 Tool 调用测试要求。FR32 双语义（长驻 + 并发）现已显式进入 Story 合同。

### Round 1 / Finding #3：`sync_docs` 缺少与 Epic 4 一致的读侧契约 — 部分修复

Story 5.1 / 5.5 已将 `sync_docs` 收敛为只读建议 Tool，与 Epic 4 metadata-only 边界对齐。原始“是否越过 Epic 4 写入”的歧义已关闭；但本轮 #2 揭示其可执行 Service 映射尚未闭合，作为新发现继续跟踪。

### Round 1 / Finding #4：Copilot 产物清单与 PRD IDE 矩阵不一致 — 已确认修复

Story 5.3 AC #5 和 Task 3.3 均已写入 `copilot-instructions.md + AGENTS.md + MCP Host`。但本轮 #5 揭示 detector 规则未同步处理 `AGENTS.md` 共享化，作为新发现跟踪。

### Round 1 / Finding #5：多 IDE 自动检测缺少冲突裁决与显式覆盖 — 已确认修复

Story 5.3 已补优先级表，Story 5.4 已新增 `--ide` override 与多 IDE 命中交互。原始阻塞已关闭。

### Round 1 / Finding #6：`cord init` 配置格式与 `--json` 边界未闭合 — 部分修复

Story 5.4 已新增 `--format json` 生成 `cord.config.json`，并把 `--json` 收敛到非 TTY 自动化场景。D6 主路径已承接；但本轮 #4 揭示 `--json + 非 TTY + 多 IDE 命中` 的组合语义、以及 Dev Notes 仍写死 yaml-only 流程的二处遗漏，作为新发现继续跟踪。

### 历史非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 发现 #1 评估

### 审查原文

> **【高】【新】`query_relations` 仍未暴露 `relationId`，关系管理闭环依然断裂**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：3-1、5-1、5-2
> - 证据 - Story 5.2 已把 `remove_relation` / `deprecate_relation` 的外部入参收敛为 `relationId`，并明确“AI IDE 端使用 `relationId` 操作已有关系”；但 Story 3.1 当前查询结果仍只包含目标路径、关系类型、置信度、来源和 `status`，没有 `relationId` 字段；Story 5.1 又要求 CLI 与 MCP 对相同输入返回语义一致的输出。
> - 影响 - FR20 的典型“先查再删/废弃”路径仍走不通：AI IDE 无法从 `query_relations` 稳定拿到后续写操作所需的句柄，只能重新按业务三元组猜测已有边，等于把刚收敛好的 `relationId` 合同再次绕开。
> - 建议 - 先做二选一裁决并显式回写：要么把 `relationId` 正式加入 QueryResult / `query_relations` 输出；要么回到 Story 5.2 重新定义 remove / deprecate 的外部输入模型，避免“读侧不给句柄、写侧却强依赖句柄”的双轨合同并存。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已确认 Story 3.1 AC #2 列出的查询字段为“目标文档路径、关系类型、置信度、来源、status”，无 `relationId`；同时 5.2 写侧确实强依赖 `relationId`。
**严重性判断**：合理 — 跨 Story 共享句柄缺失会让 FR20 的“先查后改”路径在 v0.1 直接失败，属于硬阻塞。
**修订建议**：可行 — 二选一路径明确（QueryResult 加 `relationId` vs 回退 5.2 输入合同），首选前者一致性更好。
**误报评估**：非误报 — 双来源（consistency+contract）命中，并跨 3.1/5.1/5.2 三处证据闭环。

## 发现 #2 评估

### 审查原文

> **【高】【新】`sync_docs` 虽已收窄为只读 Tool，但仍没有可执行的 Service 映射与批处理契约**
> - 来源：structure+contract
> - 分类：decision_needed
> - 涉及 Story：5-1、5-5
> - 证据 - Story 5.1 现在把 `sync_docs` 定义为只读建议 Tool，输入为 `filePaths[]`，输出为 `suggestions[] + affectedCount`，Service owner 指向 ImpactService；但 Story 3.3 当前公开的服务入口仍是单文档的 `analyzeImpact(input: ImpactInput)`，只接受 `docPath`，并没有多文档聚合、去重或 suggestion DTO 的现成合同；Story 5.5 的 Skills 又直接依赖 `sync_docs` 的预期输出格式。
> - 影响 - 本轮修订关闭了“`sync_docs` 会不会执行写入”的边界问题，却没有回答“谁来把多文档输入折叠成建议列表”的实现前提。实现者仍需私自发明一个批处理 facade，MCP Tool 对外契约因此还没有真正落到现有 Service 层。
> - 建议 - 先把 owner 具体化：要么新增明确的 `SyncDocsService` / 应用层 facade，写清 `filePaths` 批处理、去重和输出 DTO；要么把 `sync_docs` 缩回单文档只读查询，直接复用 Story 3.3 的现有签名，不再声明一个尚未有承接者的批量契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 3.3 公开签名确实为 `analyzeImpact(input: ImpactInput)` 单文档入参；Story 5.1 `sync_docs` 输入为 `filePaths[]`，存在 1:N 阻抗失配，无现成 owner。
**严重性判断**：合理 — 即便 Tool 外壳已定义，MCP 契约仍无法落到可执行 Service，开发期会出现 facade 自创和 Skills 输出漂移。
**修订建议**：可行 — 二选一路径明确（新增 SyncDocs facade vs 缩回单文档），后者实现成本更低，前者扩展性更好。
**误报评估**：非误报 — 双来源（structure+contract）命中，跨 5.1/5.5/3.3 三处证据闭环。

## 发现 #3 评估

### 审查原文

> **【高】【新】MCP Tool 输出 schema 仍未冻结，NFR10 / NFR11 / FR31 目前无法可测闭合**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：5-1、5-2、5-5
> - 证据 - PRD 明确要求每个 MCP Tool 具备输入/输出 schema，并要求已有 4 个 Tool 的输入输出 JSON Schema 在新增 Tool 后保持不变；但当前 Story 5.1 / 5.2 的修订主要冻结了 input schema，`sync_docs` 只给出了 TypeScript interface 草图，关系管理 Tool 也未定义标准输出 DTO；Story 5.5 又要求 Skills 文件写出“预期输出格式”，却没有引用任何共享 schema 名称。
> - 影响 - NFR10 的 schema 快照、NFR11 的三 IDE 验证以及 FR31 的 Skills 输出格式，都会因为“只有输入稳定、输出仍靠自由文本描述”而失去可执行基线。开发时很容易出现 CLI/MCP 结构漂移，且测试无法稳定断言。
> - 建议 - 在 Story 5.1 / 5.2 中为全部 7 个 MCP Tool 补齐命名输出 DTO 与 Zod schema，并明确哪些字段直接复用 CLI JSON 输出、哪些字段属于 MCP 包裹层；Story 5.5 的 Skills 预期输出格式应改为引用同一套共享 schema，而不是继续用自然语言描述。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.1 AC #3 仅写“inputSchema 从 Zod 自动导出”，未对 outputSchema 做相同要求；NFR10 schema 稳定性与 Skills 的“预期输出格式”均缺共享 DTO 锚点。
**严重性判断**：合理 — 输出 schema 缺失会让 NFR10/NFR11/FR31 在测试期都无法稳定断言，属于跨 Story 共享契约缺口。
**修订建议**：可行 — 7 个 Tool 的 outputSchema 补齐工作量明确，且与 input schema 同源（Zod → JSON Schema）。
**误报评估**：非误报 — 双来源（consistency+contract）命中，跨 5.1/5.2/5.5 三处证据闭环。

## 发现 #4 评估

### 审查原文

> **【高】【新】`cord init` 在 `--json` + 非 TTY + 多 IDE 命中场景仍没有单一可执行合同**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：5-4
> - 证据 - Story 5.4 AC #9 规定 `--json` 在非 TTY / 自动化场景下必须跳过交互并直接返回机器可读 `InitResult`；但 AC #11 又要求多 IDE 命中时通过交互向导要求用户选择，除非显式传入 `--ide`；同时 AC #12 已新增 `--format json` 生成 `cord.config.json`，但 Dev Notes 流程仍写死“生成 `cord.config.yaml`”。
> - 影响 - 实现者现在没有一条唯一可执行的 CLI 语义：在非 TTY 且多命中时，到底应该返回结构化错误、按优先级兜底，还是意外阻塞；配置文件格式也在 AC 与 Dev Notes 间保留了 yaml/json 双口径。自动化 init、CI 使用和测试断言因此都会不稳定。
> - 建议 - 把 Story 5.4 补成完整 CLI 合同：明确 `--json + 非 TTY + 多命中` 时必须返回机器可读错误并附 `candidates`，或明确要求该场景强制传入 `--ide`；同时把 Dev Notes 的 InitService 流程同步改成 yaml/json 双分支，避免实现时继续默认写死 yaml。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已确认 AC #9（非 TTY 跳过交互）与 AC #11（多命中要交互）在 `--json + 非 TTY + 多命中` 三角下相互冲突；Dev Notes 流程第 6 步仍写“生成 cord.config.yaml”未承接 AC #12。
**严重性判断**：合理 — CI / 自动化场景没有唯一语义，会直接破坏 `cord init` 的脚本化可用性。
**修订建议**：可行 — 三角组合的两条裁决路径（结构化错误 vs 强制 `--ide`）清晰，Dev Notes 同步改写工作量小。
**误报评估**：非误报 — 双来源（structure+consistency）命中，AC 内部矛盾可在 Story 文件中直接复现。

## 发现 #5 评估

### 审查原文

> **【中】【新】`AGENTS.md` 已变成共享产物，但 5.3 仍把它当作 Codex CLI 的独占检测信号**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：5-3、5-4
> - 证据 - PRD IDE 矩阵和 Story 5.3 现在都要求 VS Code Copilot 也生成 `AGENTS.md`；但 Story 5.3 的 detector 规则仍把“.vscode/ → Copilot”“`AGENTS.md` → Codex CLI”作为并列检测标志，并规定多命中时不得静默选择；Story 5.4 的 init 流程也没有补共享 `AGENTS.md` 文件的 owner / merge 规则。
> - 影响 - 一旦按 Story 5.3 初始化过 Copilot 项目，同时存在 `.vscode/` 与 `AGENTS.md` 将成为常态，自动检测会稳定落入“Copilot + Codex 双命中”。这会削弱 FR2 的自动检测价值，并把共享文档错误地继续当作某一 IDE 的排他探针。
> - 建议 - 不要再把 `AGENTS.md` 当成 Codex CLI 的独占 marker。要么为 Codex 引入更专用的检测信号，要么在 Story 5.3 / 5.4 中明确：当 `AGENTS.md` 与 Copilot 专属产物同时存在时，应视为共享文档而不是新的 IDE 命中；同时补充 `AGENTS.md` 的生成、跳过和冲突提示规则。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.3 line 53 / 64 仍把 `AGENTS.md` 单列为 Codex CLI 检测信号，AC #5 又要求 Copilot 同时生成 `AGENTS.md`，detector 与 generator 输出自相矛盾。
**严重性判断**：偏低 — 原始 [中]，但 Copilot 一旦初始化，多命中将稳定发生，自动检测的实际可用性归零，建议升级为 P1。
**修订建议**：可行 — 二选一路径清晰（Codex 改用更专用 marker vs `AGENTS.md` 与 Copilot 专属产物共存时不计为新命中）。
**误报评估**：非误报 — 双来源（consistency+contract）命中，跨 5.3/5.4 证据闭环。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | `query_relations` 未暴露 `relationId` | [高] | P1 | 跨 3.1/5.1/5.2 句柄闭环必须打通 |
| 2 | `sync_docs` 缺可执行 Service 映射 | [高] | P1 | 新增 facade 或缩回单文档查询 |
| 3 | MCP Tool 输出 schema 未冻结 | [高] | P1 | 7 个 Tool 补齐 outputSchema |
| 4 | `cord init --json + 非 TTY + 多命中` 无单一合同 | [高] | P1 | 解 AC #9/#11 冲突并同步 Dev Notes |
| 5 | `AGENTS.md` 共享化与 detector 规则冲突 | [中] | P1 | Codex 改专用 marker 或共享时不计命中 |

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

建议下一步：将本轮 5 项 P1 修订交由 SR-03 修订器统一落地，重点顺序为：(1) Story 3.1 在 QueryResult 中补 `relationId` 并联动 5.1 `query_relations` 输出；(2) Story 5.1 `sync_docs` 二选一裁决（facade 或缩回单文档）；(3) Story 5.1/5.2 为全部 7 个 MCP Tool 补 outputSchema，5.5 Skills 改为引用共享 schema 名称；(4) Story 5.4 补 `--json + 非 TTY + 多命中` 单一合同并同步 Dev Notes；(5) Story 5.3/5.4 解决 `AGENTS.md` 共享化与 detector 冲突。完成后启动第 3 轮 SR 复审。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-23
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 5 项（涉及 Story 3.1、5.1、5.2、5.3、5.4、5.5）

#### 修订项 #1: `query_relations` 未暴露 `relationId`，关系管理闭环断裂
- **文件**: `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`；`5-1-mcp-server-core-and-4-tools.md`（outputSchema 章节联动）
- **章节**: 3-1 AC #2、Dev Notes QueryService 设计；5-1 MCP Tool Output Schema 章节（`QueryRelationsResult` 含 `relationId`）
- **修改摘要**:
  - Story 3.1 AC #2 在字段列表中增加 `` `relationId` ``，并注明"供后续 `remove_relation` / `deprecate_relation` 操作使用，FR20 先查后改路径依赖"
  - Dev Notes QueryService 设计由无类型描述升级为含 `QueryResultItem` 接口的完整 TypeScript 代码，包含 `relationId: string` 字段
  - Story 5.1 `QueryRelationsResult` outputSchema 中包含 `relationId: z.string()` 字段，FR20 先查后改路径现在完全可以在 MCP 层闭合
- **状态**: 已完成

#### 修订项 #2: `sync_docs` 缺可执行 Service 映射与批处理契约
- **文件**: `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`；`5-5-hooks-auto-trigger-and-skills-generation.md`（联动）
- **章节**: 5-1 AC #3/#8、Task 2.4、sync_docs Tool 契约章节；5-5 Skills 文件结构表格
- **修改摘要**:
  - **裁决：缩回单文档**，直接复用 `ImpactService.analyzeImpact()` 现有签名，无需新增 facade
  - sync_docs 输入 schema 从 `filePaths: z.array(...)` 改为 `filePath: z.string()`（单文档）
  - 补充 Service 映射说明："直接调用 `ImpactService.analyzeImpact({ docPath: input.filePath })` 并将结果转换为 SyncDocsResult"
  - Story 5.5 Skills 场景注明：多文档触发时 MCP Host 按文件依次调用 `sync_docs`，无批处理 facade 依赖
- **状态**: 已完成

#### 修订项 #3: MCP Tool 输出 schema 未冻结
- **文件**: `5-1-mcp-server-core-and-4-tools.md`（4 个 Tool）；`5-2-mcp-tools-relation-management.md`（3 个 Tool）；`5-5-hooks-auto-trigger-and-skills-generation.md`（引用变更）
- **章节**: 5-1 AC #3/#8 + 新增 "MCP Tool Output Schema" Dev Notes 章节；5-2 新增同名章节；5-5 Skills 文件结构改为表格并引用 schema 名称
- **修改摘要**:
  - Story 5.1 AC #3 扩展为"inputSchema 和 outputSchema 均从命名 Zod schema 自动导出，在 `src/mcp/tools/schemas.ts` 统一导出"；AC #8 扩展为"input 和 output schema 均不变"
  - Story 5.1 新增 4 个 Tool 的命名 outputSchema：`AnalyzeImpactResult`、`QueryRelationsResult`（含 relationId）、`InitGraphResult`、`SyncDocsResult`
  - Story 5.2 新增 3 个 Tool 的命名 outputSchema：`AddRelationResult`（含 relationId）、`RemoveRelationResult`、`DeprecateRelationResult`
  - Story 5.5 Skills 文件结构改为引用 schema 名称的表格，不再使用自然语言描述预期输出
- **状态**: 已完成

#### 修订项 #4: `cord init --json + 非 TTY + 多命中` 无单一合同
- **文件**: `_bmad-output/implementation-artifacts/stories/5-4-initservice-one-click-init-cord-init.md`
- **章节**: Acceptance Criteria（新增 AC #13）、Tasks / Subtasks（Task 2.1 引用）、Dev Notes InitService 流程（步骤 6）
- **修改摘要**:
  - 新增 AC #13：`--json + 非 TTY + 多 IDE 命中`时返回结构化错误 JSON `{ "error": "AMBIGUOUS_IDE", "candidates": [...], "suggestion": "..." }` 并退出，不进入交互向导，明确解除 AC #9（非 TTY 跳过交互）与 AC #11（多命中要交互）的语义冲突
  - Dev Notes 流程步骤 6 从"生成 cord.config.yaml"改为"生成 cord.config.yaml 或 cord.config.json（取决于 --format 选项）"，承接 AC #12
- **状态**: 已完成

#### 修订项 #5: `AGENTS.md` 共享化与 detector 规则冲突
- **文件**: `_bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md`
- **章节**: Dev Notes IDE 检测策略（Codex CLI 规则）、IDE 检测优先级与冲突裁决（新增规则）
- **修改摘要**:
  - IDE 检测策略 Codex CLI 条目更新为"检查 `AGENTS.md` **且 `.vscode/` 目录不存在**"，并注明发现#5 裁决原因
  - 冲突处理规则新增"AGENTS.md 共享文档规则"：当 `AGENTS.md` 与 `.vscode/` 共存时，不计为 Codex CLI 命中，视为 Copilot 适配器的共享产物；只有在项目中存在 `AGENTS.md` 且不存在任何其他 IDE 专属标志时，才将其计为 Codex CLI 命中
- **状态**: 已完成
