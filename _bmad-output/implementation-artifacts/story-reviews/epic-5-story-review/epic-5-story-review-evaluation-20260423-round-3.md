---
Epic: 5
Scope: epic
Round: 3
Date: 2026-04-24
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-5-story-review-summary-20260423-round-3.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 5 Story 设计审查评估（Round 3）

## 评估总结

第 3 轮 SR 复审仅产出 2 条新发现，相比 round-2 的 5 条已大幅收敛，反映 Epic 5 的设计正快速向稳态靠近。本轮 2 条发现经证据交叉验证后 **全部成立、无误报**：#1（`query_relations` I/O 合同未真正闭合）属于跨 3.1/5.1 的输入侧 schema 缺失 + `SyncDocsResult.action` 字段映射断裂，仍属硬一致性问题；#2（父 Epic 5 仍保留 round-2 之前的旧验收口径）是子 Story 已修订但父级文档漂移的典型「父子合同回流」风险，必须在进入开发前同步。同时审查者对 round-2 的 5 项修订给出了细粒度回顾（1 项已修复 + 4 项部分修复），本轮评估亦确认其判断准确：5.1 `sync_docs` 字段映射、5.2 关系管理 Tool output schema 任务化、5.4 检测返回值与 AC #13 任务/测试 owner、5.3 共享文件零侵入合同——这 4 项「部分修复」事实上仍构成下一轮必须收口的工作面。建议本轮按 P1 / P2 分级处理：#1 阻塞，#2 至少 P1（防止父级漂移把已闭合的边界重新带回）。

## 上轮问题回顾确认

### Round 2 / Finding #1：`query_relations` 未暴露 `relationId` — 已确认修复

Story 3.1 AC #2 与 5.1 `QueryRelationsResult` 均已包含 `relationId`。原始「完全拿不到稳定句柄」问题关闭。但本轮 #1 揭示「输入侧 schema 与字段映射」仍未真正统一，作为新发现继续跟踪。

### Round 2 / Finding #2：`sync_docs` 缺可执行 Service 映射 — 部分修复

Story 5.1 已收窄为单文档 `filePath` 输入，并在 Dev Notes 写入「直接调用 `ImpactService.analyzeImpact` 并将结果转换为 SyncDocsResult」。批处理歧义关闭，但 `AnalyzeImpactResult.updateStrategy` (auto/suggest/log_only) → `SyncDocsResult.action` (update/review/log_only) 的字段映射规则未写实，本轮 #1 一并跟踪。

### Round 2 / Finding #3：MCP Tool 输出 schema 未冻结 — 部分修复

Story 5.1 4 个核心 Tool 已补命名 outputSchema 并集中导出至 `src/mcp/tools/schemas.ts`；Story 5.5 Skills 已改为引用 schema 名称。但 Story 5.2 的 3 个关系管理 Tool output schema 仍只在 Dev Notes 出现，AC / Task / 测试均未承接，本轮审查者已在「逐篇结论」5.2 段落明确指出该缺口。

### Round 2 / Finding #4：`cord init --json + 非 TTY + 多命中` 无单一合同 — 部分修复

Story 5.4 已新增 AC #13（`AMBIGUOUS_IDE` 结构化错误），并把 `--format json` 写入 Dev Notes。但 Dev Notes 流程仍写「`detectIde(projectRoot) → IIdeAdapter`」单值返回模型，无法承接多命中候选；AC #13 也未挂到 Task 2 / Task 3 owner，本轮审查者已在「逐篇结论」5.4 段落明确指出。

### Round 2 / Finding #5：`AGENTS.md` 共享化与 detector 规则冲突 — 部分修复

Story 5.3 已新增「`AGENTS.md` 与 `.vscode/` 共存时不计为 Codex 命中」规则，最直接的双命中问题已缓解。但「检测策略」段（`AGENTS.md` 且 `.vscode/` 不存在）与「共享文档规则」段（`AGENTS.md` 且不存在任何其他 IDE 专属标志）仍是双口径；零侵入策略对共享文件 owner / merge / skip 的合同也仍空白，本轮审查者已在「逐篇结论」5.3 段落明确指出。

### 历史非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 发现 #1 评估

### 审查原文

> **【高】【新】`query_relations` 的统一输入/输出合同仍未真正闭合**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-1、5-1
> - 证据 - Story 3.1 已把读侧结果定义为 `QueryResultItem[]`，并补入 `relationId`、`type`、`includeDeprecated` 等共享语义；但 Story 5.1 当前只冻结了 `QueryRelationsResult` 的 MCP 输出包裹结构（`relations + totalCount`），没有显式补出 `QueryRelationsInput` 命名 schema，也没有写清 CLI JSON 与 MCP 输出在字段形状、排序规则上的统一约束。PRD 的 FR14 与 NFR13 仍要求查询过滤能力和 CLI/MCP 语义一致。
> - 影响 - round-2 的「补 relationId 句柄」虽然解决了最核心的写后读闭环，但 `query_relations` 的完整 I/O 合同仍可能在 CLI 与 MCP 两端继续漂移，尤其是 `type` / `includeDeprecated` 过滤和 JSON 返回形状会重新落回实现者自由裁量。
> - 建议 - 在 Story 3.1 与 5.1 中显式共用同一套 `QueryRelationsInput` / `QueryRelationsResult` 命名 schema，并写明 CLI JSON 模式与 MCP Tool 返回结构的字段名、包裹层和排序规则完全一致。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.1 仅在 schema 集中区出现 `QueryRelationsResult`，并未出现 `QueryRelationsInput` 的命名定义；同时 `SyncDocsResult.action`（update/review/log_only）与 `AnalyzeImpactResult.updateStrategy`（auto/suggest/log_only）枚举值不一致，Dev Notes 仅一句「将结果转换为 SyncDocsResult」未说明字段映射规则。两处证据可在 Story 文件直接复现。
**严重性判断**：合理 — 即便 outputSchema 已冻结，缺少命名 input schema + 字段映射规则会让 CLI/MCP 两端在 `type`/`includeDeprecated`/排序/`action` 推导上重新漂移，与 NFR13 直接冲突。
**修订建议**：可行 — 增补 `QueryRelationsInput` 命名 schema + `AnalyzeImpactResult → SyncDocsResult` 字段映射表（含 `updateStrategy → action` 推导规则），工作量明确。
**误报评估**：非误报 — 双来源（consistency+contract）命中，跨 3.1/5.1 双 Story 闭环。

## 发现 #2 评估

### 审查原文

> **【中】【新】父 Epic 5 仍保留 round-2 之前的旧验收口径**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：5-1、5-3、5-4、5-5
> - 证据 - 父 Epic 仍把 5.1 的 schema 口径写成「每个 Tool 的 inputSchema」，没有承接 5.1 当前的 input/output 双 schema 冻结；仍把 Copilot 交付物写成 `copilot-instructions.md + MCP Host`，没有同步 5.3 当前的 `AGENTS.md` 共享口径；仍只写「支持 `--json` 输出」，没有同步 5.4 的 `--format json` 和 `AMBIGUOUS_IDE` 结构化错误；Skills 仍写成自然语言「预期输出格式」，没有承接 5.5 当前对命名 schema 的直接引用。
> - 影响 - 子 Story 的 round-2 修订已经生效，但父 Epic 仍在教授旧合同。后续若继续以 Epic 作为计划入口、复审入口或验收入口，已关闭的问题会被以「父级文档漂移」的形式重新带回。
> - 建议 - 同步更新 Epic 5 中 5.1、5.3、5.4、5.5 的摘要与 AC，至少补齐 input/output 双 schema、Copilot + `AGENTS.md`、`--format json` / `AMBIGUOUS_IDE`，以及 Skills 直接引用命名 schema 这 4 处已裁决边界。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Epic 5 文件已逐条验证：line 20 仍写「inputSchema」单边；line 59 Copilot 仍是 `copilot-instructions.md + MCP Host`；line 82 仅「支持 `--json` 输出」；line 99 Skills 仍写「预期输出格式」自然语言。4 处全部命中。
**严重性判断**：偏低 — 原始 [中]，但与本仓库「父子合同回流」历史模式一致（Epic 4 也曾出现过类似漂移）：父 Epic 是计划/复审/验收的入口，漂移会在下一轮以「计划入口讲旧合同」的形式把已闭合的问题重新拉回。建议升级为 P1 阻塞，与子 Story 修订同批落地。
**修订建议**：可行 — 4 处文本同步工作量小，且无需对子 Story 做额外裁决。
**误报评估**：非误报 — 双来源（structure+consistency）命中，4 处证据可直接复现。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | `query_relations` I/O 合同未真正闭合 | [高] | P1 | 补 `QueryRelationsInput` + `action` 字段映射 |
| 2 | 父 Epic 5 保留 round-2 之前旧验收口径 | [中] | P1 | 同步 4 处已裁决边界，防止合同回流 |
| — | （审查者点出的部分修复项）5.2 output schema 任务化 | — | P1 | AC/Task/测试承接 3 个关系管理 Tool DTO |
| — | （审查者点出的部分修复项）5.4 `DetectionResult` + AC #13 owner | — | P1 | 单值检测改多命中合同；AC #13 挂 Task 2/3 |
| — | （审查者点出的部分修复项）5.3 共享文件零侵入合同 + Codex 命中谓词单一化 | — | P1 | create-if-absent / preserve-if-exists / explicit-conflict |

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

建议下一步：将本轮 2 条新发现 + 4 项「部分修复继续跟踪」共 5 个工作面统一交由 SR-03 修订器处理，建议顺序为：(1) Story 5.1 补 `QueryRelationsInput` 命名 schema 与 `AnalyzeImpactResult → SyncDocsResult` 字段映射表；(2) Story 5.2 把 3 个关系管理 Tool 的 outputSchema 提升至 AC / Task / 测试层；(3) Story 5.4 把 `detectIde` 收敛为 `DetectionResult`（含 matches/selected/ambiguity/error），并把 AC #13 挂到 Task 2 / Task 3；(4) Story 5.3 统一 Codex 命中谓词并补共享文件 owner / merge / skip 合同；(5) 同步更新父 Epic 5 文件中 5.1/5.3/5.4/5.5 4 处旧验收口径。完成后启动第 4 轮 SR 复审。

---

## 修订执行记录

- **Date**: 2026-04-24
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 5 项（涉及 Story 5.1、5.2、5.3、5.4、父 Epic 5）

| # | 文件 | 章节 | 修改摘要 | 状态 |
|---|------|------|---------|------|
| 1 | `stories/5-1-mcp-server-core-and-4-tools.md` | Dev Notes MCP Tool Input/Output Schema | 新增 `QueryRelationsInput` 命名 Zod schema（docPath、type?、includeDeprecated?）；新增 `updateStrategy→action` 映射表（auto→update / suggest→review / log_only→log_only）；AC #3/#8 及 schemas 部分补充 output schema 稳定性约束 | ✅ 已完成 |
| 2 | `epics/epic-5ai-ide-集成mcp-server-hooks-指令注入.md` | Story 5.1/5.3/5.4/5.5 AC 边界 | 同步 4 处已裁决边界：5.1 inputSchema 扩为 input+output；5.3 Copilot 适配补 AGENTS.md；5.4 --json 扩为含 AMBIGUOUS_IDE + --format json + --ide override；5.5 outputSchema 改为直接引用 schemas.ts 命名 schema | ✅ 已完成 |
| 3 | `stories/5-2-mcp-tools-relation-management.md` | AC、Task 1、Task 3 | 新增 AC #7（AddRelationResult / RemoveRelationResult / DeprecateRelationResult output schema 约束，NFR10）；新增 Task 1.5（schemas.ts 导出 3 个命名 output schema）；Task 3 引用扩展至 AC #5, #6, #7 | ✅ 已完成 |
| 4 | `stories/5-4-initservice-one-click-init-cord-init.md` | Task 2、Task 3、Dev Notes InitService 流程 | Task 2 增加 AC #11/#13；Task 3 增加 AC #13；流程步骤 1 由 `detectIde → IIdeAdapter` 改为 `detectIde → DetectionResult`（含 matches/selected/ambiguous/error）；补多命中/非 TTY AMBIGUOUS_IDE 分支说明 | ✅ 已完成 |
| 5 | `stories/5-3-ide-adapter-and-auto-detection.md` | IDE 检测策略、冲突处理规则、零侵入策略 | Codex CLI 检测谓词由「`.vscode/` 不存在」统一为「不存在 `.claude/`、`.cursor/`、`.vscode/` 等任意 IDE 专属标志」；冲突规则同步对齐；零侵入策略节后新增「共享文件处理合同」（create-if-absent / preserve-if-exists / explicit-conflict） | ✅ 已完成 |
