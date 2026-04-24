---
Epic: 5
Scope: epic
Round: 1
Date: 2026-04-23
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-5-story-review-summary-20260423-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 5 Story 设计审查评估（Round 1）

## 评估总结

本轮评估对 Epic 5 首轮 SR 审查的 6 条发现逐一验证，结论为 **全部成立、无误报**。3 条 [高] 发现（#1 / #2 / #3）均触及 MCP 入口层最核心的对外契约（关系管理输入模型、FR32 并发承诺、`sync_docs` 与 Epic 4 metadata-only 边界），证据可在 5-1 / 5-2 / 5-3 Story 文件中直接复现，必须在进入开发前修订。3 条 [中] 发现（#4 / #5 / #6）分别涉及 PRD IDE 矩阵、`cord init` 自动检测的确定性以及架构决策 D6 / `--json` CLI 契约，虽严重性原始标注为中，但都属于会让交付物或 CLI 行为偏离已闭合上游契约的硬一致性问题，建议同样按 P1 阻塞处理。整体结论：Epic 5 暂不进入开发，需先完成上述 6 项修订后再审。

## 发现 #1 评估

### 审查原文

> **[高] 关系管理 MCP Tool 缺少对外稳定输入契约**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：5-2
> - 证据 - Story 5.2 只要求注册 `add_relation`、`remove_relation`、`deprecate_relation` 三个 Tool 并“暴露原子化 CRUD”，但没有定义 MCP 层究竟接收 `relationId` 还是 `sourcePath + targetPath + relationType` 这组业务键；与此同时，Story 4.1 已把 `removeRelation` / `deprecateRelation` 收敛为对象入参并围绕 `relationId` 草拟 Service 契约。当前 Story 5.2 没有任何 Zod schema、共享输入类型或“AI IDE 解析后应提交什么结构”的说明。
> - 影响 - MCP Tool 无法形成稳定可测的 schema，开发者会在“暴露内部 relationId”与“入口层自行查找业务键”之间自行裁决，直接影响 Tool schema、测试样例和后续 Agent 调用方式。
> - 建议 - 在 Story 5.2 中先统一关系管理 Tool 的外部输入模型：明确使用 `relationId` 还是业务三元组；补充 `AddRelationInput`、`RemoveRelationInput`、`DeprecateRelationInput` 的共享 Zod schema / type 任务，并把它们与 Story 4.1 的 Service 签名一起写实。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已确认 Story 5.2 全文未出现 `relationId` / `sourcePath` 或共享 Zod schema，只有 NFR10 的 Tool schema 稳定性约束，没有任何输入字段定义。
**严重性判断**：合理 — MCP 入口契约一旦发布即对外稳定，不能在开发期再改；且 AI IDE 端依赖此 schema 编排意图。
**修订建议**：可行 — Story 4.1 已为 Service 端选定 `relationId` 路线，Story 5.2 只需作为 MCP 入口对齐并补共享 schema 任务即可。
**误报评估**：非误报 — 双来源（consistency+contract）命中，与历史经验中“新增 MCP Tool 必须先定外部输入契约”的模式一致。

## 发现 #2 评估

### 审查原文

> **[高] Story 5.1 没有真正承接 FR32 的“并发查询请求”合同**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：5-1
> - 证据 - PRD 的 FR32 明确要求“MCP Server 可以作为长驻进程运行，响应 AI Agent 的并发查询请求”；但 Story 5.1 的 AC #4 只保留了“作为长驻进程运行（FR32）”，Task 和测试也只覆盖 4 个 Tool 端到端、SIGTERM 和输入验证失败，没有任何并发调用、并发只读查询或请求隔离的口径。
> - 影响 - 当前 Story 5.1 即使完成，也只能证明“能跑起来”，不能证明它满足 PRD 对 MCP Host 的核心并发能力要求。后续开发者可能把并发支持静默降级为单请求串行行为，却仍误以为 FR32 已关闭。
> - 建议 - 在 Story 5.1 中补一条显式 AC 和测试要求，至少覆盖并发只读 Tool 调用的基本合同；若 v0.1 实际只承诺单并发，则应先同步收窄 PRD / Epic 对 FR32 的表述，而不是在 Story 层默认降级。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已确认 5-1 AC #4 仅写“长驻进程运行（FR32）”，全文无“并发”相关 AC / Task / 测试。
**严重性判断**：合理 — FR32 双语义（长驻 + 并发）若只承接其一，即为契约残缺；且向下决定 Service 调用的隔离与可重入要求。
**修订建议**：可行 — 补一条并发只读 Tool 的 AC + 集成测试即可，路径成本低且必要；若 v0.1 决定收窄，则需要先回写 PRD/Epic，避免 Story 默认降级。
**误报评估**：非误报 — 与仓库历史模式 “Story 5.1 must carry FR32 concurrent-query semantics explicitly” 完全一致。

## 发现 #3 评估

### 审查原文

> **[高] `sync_docs` Tool 仍缺少与 Epic 4 已闭合边界一致的读侧契约**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：5-1、5-5
> - 证据 - Story 5.1 只写 `src/mcp/tools/sync-docs.ts` “触发关联文档同步建议”，Story 5.5 又把“同步建议”作为第 4 个 Skills 意图直接映射到 `sync_docs`；但 Story 4.3 已明确 v0.1 的 `updateStrategy` 只是 ImpactService 结果中的只读决策元数据，“不自动触发同步、不实现 orchestration 逻辑”。当前全仓没有任何上游 Story 为 `sync_docs` 定义服务归属、输入参数和返回结构，架构文档也只列出了工具文件名，没有给出共享输出契约。
> - 影响 - 实现者无法判断 `sync_docs` 是“返回同步建议的只读 Tool”还是“真正执行文档同步的编排 Tool”。若前者，当前缺少与 ImpactService / `updateStrategy` 的复用边界；若后者，则会直接越过 Epic 4 已经裁定的 v0.1 范围。
> - 建议 - 先在 Story 5.1 中做边界裁决并写成显式契约：建议将 `sync_docs` 收敛为只读建议 Tool，复用 ImpactService 的建议动作和 `updateStrategy` 元数据，不执行文档写入；同时补充输入 / 输出 schema、Service owner 和与 Story 5.5 Skills 场景的对应关系。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.1 仅有“触发关联文档同步建议”一句话定义；Story 4.3 在 Round 4 评估中已经将 `updateStrategy` 收敛为 metadata-only 的事实可由仓库 epic-4 review 历史与 memory 中“Epic 4 metadata-only updateStrategy boundary”规则交叉验证。
**严重性判断**：合理 — 跨 Epic 共享契约缺口，会让 5.1/5.5 同时偏离 Epic 4 已闭合裁决。
**修订建议**：可行 — 在 5.1 收敛 `sync_docs` 为只读建议 Tool、补 schema 与 Service owner 是最小成本闭合方案，与 Epic 4 边界一致。
**误报评估**：非误报 — 三来源命中（structure+consistency+contract），可信度高。

## 发现 #4 评估

### 审查原文

> **[中] VS Code Copilot 产物清单与 PRD IDE 矩阵不一致**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：5-3
> - 证据 - PRD 的 IDE 集成矩阵明确把 VS Code Copilot 的指令文件格式定义为 `copilot-instructions.md + AGENTS.md`，文档管辖范围 FR38 也把 `AGENTS.md` 纳入 AI IDE/Agent 指令文档；但 Story 5.3 AC #5 只要求 `copilot-instructions.md + MCP Host`，把 `AGENTS.md` 只放到了 Codex CLI 的基础集成中。
> - 影响 - 这会让 Copilot 适配器的交付物与 PRD 不一致，也让后续 `cord init` 无法按统一规则生成 Copilot 所需的完整指令面。实现者如果只照 Story 5.3 做，会留下一个表面“已支持 Copilot”、实际少交一份指令文件的假闭环。
> - 建议 - 在 Story 5.3 中把 VS Code Copilot 的交付物补齐为 `copilot-instructions.md + AGENTS.md + MCP Host`，或者明确裁决 `AGENTS.md` 在 Copilot v0.1 中不生成，并同步回写 PRD / Epic。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 5-3 AC #5 / #6 已被实际文件确认，Copilot 缺 `AGENTS.md`，仅 Codex CLI 列出。
**严重性判断**：偏低 — 原始标注 [中]，但这是 PRD IDE 矩阵的硬一致性偏差，会直接影响 5.4 init 生成产物，建议升级为 P1 阻塞。
**修订建议**：可行 — 二选一裁决路径明确（补齐交付物 vs 收窄 PRD），任一路径成本均低。
**误报评估**：非误报 — 与 memory 模式 “Copilot review baseline includes both copilot-instructions.md and AGENTS.md” 一致。

## 发现 #5 评估

### 审查原文

> **[中] 多 IDE 自动检测缺少确定性的冲突裁决与显式覆盖路径**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：5-3、5-4
> - 证据 - Story 5.3 的检测策略只列出“.claude/ 或 CLAUDE.md → Claude Code、.cursor/ → Cursor、.vscode/ → Copilot、AGENTS.md → Codex CLI”，但没有定义一个项目同时存在多种 IDE 痕迹时如何选择；Story 5.4 又直接依赖“自动检测 IDE 并选择适配器”，也没有补充显式 override 流程。
> - 影响 - 在真实项目里，多 IDE 文件并存是高概率场景。当前没有优先级、冲突提示或显式 override，`cord init` 的行为会变得不可预测，导致生成错误的配置文件或把“用户只是保留旧目录”误判为当前 IDE。
> - 建议 - 在 Story 5.3 中补充检测优先级和冲突处理规则，并在 Story 5.4 的 init 流程里写清“自动检测命中多个 IDE 时的提示/选择/覆盖”行为；如果允许显式配置覆盖自动检测，也应写入 AC。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 5-3 检测策略仅枚举命中规则，未定义冲突仲裁；5-4 直接消费“自动检测”输出无 override 路径。
**严重性判断**：偏低 — 多 IDE 共存在真实场景中是高概率事件，缺裁决会直接导致 `cord init` 行为不可预测，建议升级为 P1。
**修订建议**：可行 — 补充优先级表 + override CLI 选项即可闭合。
**误报评估**：非误报 — 跨 Story (5.3+5.4) 的契约联合缺口。

## 发现 #6 评估

### 审查原文

> **[中] `cord init` 的配置文件格式分支与 CLI 输出边界没有闭合**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：5-4
> - 证据 - 架构决策 D6 已明确 `cord init` 默认生成 `cord.config.yaml`，并可通过 `--format json` 生成 `cord.config.json`；Story 2.4 也已把两种配置格式都定义为共享配置契约。但 Story 5.4 只承接了“生成 `cord.config.yaml` 默认配置文件”和“支持 `--json` 输出”，既没有 `--format json` 的生成分支，也没有定义 `--json` 与 `@clack/prompts` 交互向导在非 TTY / 自动化场景下如何共存。
> - 影响 - 当前 Story 5.4 即便实现，也无法完整满足已存在的配置格式决策；同时 `--json` 的行为边界不明，容易出现“命令想要机器可读输出，却先进入交互向导”的接口歧义。
> - 建议 - 在 Story 5.4 中补充两类 CLI 契约：一是显式承接 `--format json` 生成 `cord.config.json` 的路径；二是明确 `--json` 下的 TTY / 非 TTY 行为、交互是否允许、以及机器可读输出的最终结构。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.4 仅 AC #9 提到 `--json` JSON 输出，未提 `--format` 或 `cord.config.json`，TTY 行为未定义。
**严重性判断**：偏低 — 直接偏离架构决策 D6，且 `--json` 与交互向导的 TTY 边界是 CLI 自动化场景的核心可用性问题，建议升级为 P1。
**修订建议**：可行 — 双契约（`--format json` 生成路径 + `--json` TTY 行为表）补齐工作量小。
**误报评估**：非误报 — 与 memory 中 “`cord init` reviews must cross-check architecture D6” 模式一致。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 关系管理 MCP Tool 缺少对外稳定输入契约 | [高] | P1 | 必须在 5.2 内统一 schema |
| 2 | Story 5.1 未承接 FR32 并发请求合同 | [高] | P1 | 加并发 AC/测试或回写收窄 PRD |
| 3 | `sync_docs` 缺少与 Epic 4 一致的读侧契约 | [高] | P1 | 5.1 收敛为只读建议 Tool 并定 schema |
| 4 | Copilot 产物清单缺 `AGENTS.md` | [中] | P1 | 与 PRD IDE 矩阵硬一致性偏差 |
| 5 | 多 IDE 自动检测无冲突裁决/override | [中] | P1 | 5.3+5.4 联合补优先级与覆盖路径 |
| 6 | `cord init` 配置格式与 `--json` 边界未闭合 | [中] | P1 | 偏离 D6，需补 CLI 契约 |

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

建议下一步：将上述 6 项 P1 修订交由 SR-03 修订器在 Story 5.1 / 5.2 / 5.3 / 5.4（涉及联动的 5.5 同步对齐）中按发现编号统一落地，完成后启动第 2 轮 SR 审查复核。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-23
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 6 项（涉及 Story 5.1、5.2、5.3、5.4、5.5）

#### 修订项 #1: 关系管理 MCP Tool 缺少对外稳定输入契约
- **文件**: `_bmad-output/implementation-artifacts/stories/5-2-mcp-tools-relation-management.md`
- **章节**: Acceptance Criteria、Tasks / Subtasks、Dev Notes
- **修改摘要**:
  - AC #2 补充"通过显式 Zod input schema 定义各 Tool 对外契约"
  - 新增 AC #6：明确 `add_relation` 使用业务三元组 `{ sourcePath, targetPath, relationType }`，`remove_relation` / `deprecate_relation` 使用 `{ relationId }`，与 Story 4.1 RelationService 签名一致
  - Task 1 补 1.4（定义并导出共享 Zod input schema）；Task 3 引用更新至 AC #5, #6
  - Dev Notes 新增"MCP 层输入 Schema 契约（发现#1 裁决）"章节，含完整 Zod schema 代码示例和裁决依据
- **状态**: 已完成

#### 修订项 #2: Story 5.1 没有真正承接 FR32 的"并发查询请求"合同
- **文件**: `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`
- **章节**: Acceptance Criteria、Tasks / Subtasks
- **修改摘要**:
  - 新增 AC #11：明确"同时收到多个并发只读 Tool 调用时，每个调用独立返回结果，无共享状态干扰（承接 FR32『并发查询请求』合同）"
  - Task 5 引用更新至 AC #5, #6, #8, #10, #11（新增并发测试覆盖）
- **状态**: 已完成

#### 修订项 #3: sync_docs Tool 仍缺少与 Epic 4 已闭合边界一致的读侧契约
- **文件**: `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`（主）、`5-5-hooks-auto-trigger-and-skills-generation.md`（联动对齐）
- **章节**: Tasks / Subtasks（Task 2.4）、Dev Notes（新增章节）；5-5 Dev Notes
- **修改摘要**:
  - 5-1 Task 2.4 补注："`sync-docs.ts` — 只读建议 Tool，委托 ImpactService 查询 updateStrategy 并返回建议动作列表，不执行任何文档写入"
  - 5-1 Dev Notes 新增"sync_docs Tool 契约（发现#3 裁决）"章节：包含 Service owner（ImpactService/Story 3.3）、输入 schema（`SyncDocsInput`）、输出 schema（`SyncDocsResult`）及边界约定（不执行写入、复用 ImpactService 输出）
  - 5-5 Dev Notes Skills 文件结构第 4 条补注"只读建议 Tool，返回同步动作建议列表，不执行文档写入；与 Story 5.1 sync_docs 契约对应"
- **状态**: 已完成

#### 修订项 #4: VS Code Copilot 产物清单与 PRD IDE 矩阵不一致
- **文件**: `_bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md`
- **章节**: Acceptance Criteria、Tasks / Subtasks
- **修改摘要**:
  - AC #5 从 `copilot-instructions.md + MCP Host` 更新为 `copilot-instructions.md + AGENTS.md + MCP Host（与 PRD IDE 矩阵对齐）`
  - Task 3.3 补注"生成 copilot-instructions.md + AGENTS.md + MCP Host 配置"
- **状态**: 已完成

#### 修订项 #5: 多 IDE 自动检测缺少确定性的冲突裁决与显式覆盖路径
- **文件**: `_bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md`（检测规则）、`5-4-initservice-one-click-init-cord-init.md`（init 流程 AC）
- **章节**: 5-3 Dev Notes（新增章节）；5-4 Acceptance Criteria、Tasks / Subtasks
- **修改摘要**:
  - 5-3 Dev Notes 新增"IDE 检测优先级与冲突裁决（发现#5 裁决）"章节：4 级优先级表（Claude Code > Cursor > VS Code Copilot > Codex CLI）、多 IDE 冲突不静默选择规则、`--ide <name>` override 路径
  - 5-4 新增 AC #11：自动检测命中多个 IDE 时展示列表并要求用户选择，`--ide <name>` 显式覆盖
  - 5-4 Task 2.1 补注多 IDE 冲突提示与 `--ide` override 能力；Task 3 引用更新至 AC #10, #11, #12
- **状态**: 已完成

#### 修订项 #6: cord init 的配置文件格式分支与 CLI 输出边界没有闭合
- **文件**: `_bmad-output/implementation-artifacts/stories/5-4-initservice-one-click-init-cord-init.md`
- **章节**: Acceptance Criteria、Tasks / Subtasks
- **修改摘要**:
  - AC #9 从"Given --json When 传入 Then JSON 输出"扩展为"在非 TTY/自动化场景下传入，跳过 @clack/prompts 交互向导，直接以机器可读 JSON 格式输出 InitResult（不混入进度文本）"
  - 新增 AC #12：`--format json` 传入时生成 cord.config.json 而非 cord.config.yaml（对齐架构决策 D6）
  - Task 2.1 补注 `--format json` 生成 cord.config.json 和 `--json` 跳过交互并输出机器可读 JSON 两类能力
- **状态**: 已完成
