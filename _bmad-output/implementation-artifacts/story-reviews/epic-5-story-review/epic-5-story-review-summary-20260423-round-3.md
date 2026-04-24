---
Epic: 5
Scope: epic
Round: 3
Date: 2026-04-23
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

# Epic 5 Story 设计审查总结

## 审查结论

第 3 轮复审。共审查 Epic 5 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：3 个
- 硬阻塞：2 个

总体判断：round-2 的 5 个 P1 修订已经明显推进了 Epic 5 的设计收敛度，尤其是 `relationId` 句柄、`sync_docs` 单文档化、命名 output schema、`AMBIGUOUS_IDE` 错误分支和 `AGENTS.md` 共享规则都已落到 Story 文档中；但本轮复审确认，其中 4 项仍只部分闭合，问题集中在“共享输入/输出合同没有真正统一”“AC 已新增但未落实到任务/测试 owner”“共享文件与零侵入策略仍存在双口径”以及“父 Epic 没有同步 round-2 的新边界”。Epic 5 仍不建议进入开发，但阻塞范围已经进一步收缩到 5.1 与 5.4 这两条主线。

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
  - `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
  - `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
  - `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
  - `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-summary-20260423-round-4.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-summary-20260423-round-2.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-evaluation-20260423-round-2.md`
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

1. Round 2 / Finding #1 — `query_relations` 未暴露 `relationId`
   - Story 3.1 的 AC #2 和 `QueryResultItem` 已补入 `relationId`，Story 5.1 的 `QueryRelationsResult` 也已包含 `relationId`。
   - 验证结果：原始“完全拿不到稳定句柄”的问题已关闭。

### 部分修复但仍未闭合

1. Round 2 / Finding #2 — `sync_docs` 缺可执行 Service 映射
   - Story 5.1 已将 `sync_docs` 从 `filePaths[]` 批处理收窄为单文档输入，批量 facade 缺失的问题已被规避。
   - 验证结果：批处理层面的歧义已关闭，但 `AnalyzeImpactResult -> SyncDocsResult` 的字段映射仍未写实，本轮继续跟踪。

2. Round 2 / Finding #3 — MCP Tool 输出 schema 未冻结
   - Story 5.1 已为 4 个核心 Tool 补入命名 output schema，Story 5.5 也已把 Skills 输出改为引用 schema 名称。
   - 验证结果：5.1 / 5.5 的主干路径已修复，但 Story 5.2 的 3 个关系管理 Tool output schema 仍只停留在 Dev Notes，本轮继续跟踪。

3. Round 2 / Finding #4 — `cord init --json + 非 TTY + 多命中` 无单一合同
   - Story 5.4 已新增 AC #13，并把 `--format json` 分支写入 Dev Notes。
   - 验证结果：语义裁决已存在，但检测返回值、任务 owner 和测试 owner 仍未真正承接，本轮继续跟踪。

4. Round 2 / Finding #5 — `AGENTS.md` 共享化与 detector 规则冲突
   - Story 5.3 已新增“.vscode + AGENTS.md 不计为 Codex 命中”的共享规则。
   - 验证结果：最直接的 Copilot/Codex 双命中问题已被缓解，但 Codex 命中谓词仍有双口径，零侵入文件 owner 也未闭合，本轮继续跟踪。

### 仍为非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 新发现

### 1. 【高】【新】`query_relations` 的统一输入/输出合同仍未真正闭合

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-1、5-1
- **证据** - Story 3.1 已把读侧结果定义为 `QueryResultItem[]`，并补入 `relationId`、`type`、`includeDeprecated` 等共享语义；但 Story 5.1 当前只冻结了 `QueryRelationsResult` 的 MCP 输出包裹结构（`relations + totalCount`），没有显式补出 `QueryRelationsInput` 命名 schema，也没有写清 CLI JSON 与 MCP 输出在字段形状、排序规则上的统一约束。PRD 的 FR14 与 NFR13 仍要求查询过滤能力和 CLI/MCP 语义一致。
- **影响** - round-2 的“补 relationId 句柄”虽然解决了最核心的写后读闭环，但 `query_relations` 的完整 I/O 合同仍可能在 CLI 与 MCP 两端继续漂移，尤其是 `type` / `includeDeprecated` 过滤和 JSON 返回形状会重新落回实现者自由裁量。
- **建议** - 在 Story 3.1 与 5.1 中显式共用同一套 `QueryRelationsInput` / `QueryRelationsResult` 命名 schema，并写明 CLI JSON 模式与 MCP Tool 返回结构的字段名、包裹层和排序规则完全一致。

### 2. 【中】【新】父 Epic 5 仍保留 round-2 之前的旧验收口径

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：5-1、5-3、5-4、5-5
- **证据** - 父 Epic 仍把 5.1 的 schema 口径写成“每个 Tool 的 inputSchema”，没有承接 5.1 当前的 input/output 双 schema 冻结；仍把 Copilot 交付物写成 `copilot-instructions.md + MCP Host`，没有同步 5.3 当前的 `AGENTS.md` 共享口径；仍只写“支持 `--json` 输出”，没有同步 5.4 的 `--format json` 和 `AMBIGUOUS_IDE` 结构化错误；Skills 仍写成自然语言“预期输出格式”，没有承接 5.5 当前对命名 schema 的直接引用。
- **影响** - 子 Story 的 round-2 修订已经生效，但父 Epic 仍在教授旧合同。后续若继续以 Epic 作为计划入口、复审入口或验收入口，已关闭的问题会被以“父级文档漂移”的形式重新带回。
- **建议** - 同步更新 Epic 5 中 5.1、5.3、5.4、5.5 的摘要与 AC，至少补齐 input/output 双 schema、Copilot + `AGENTS.md`、`--format json` / `AMBIGUOUS_IDE`，以及 Skills 直接引用命名 schema 这 4 处已裁决边界。

## 逐篇审查结论

### Story 5.1: MCP Server 核心与 4 个 Tools

#### 5.1 结论

硬阻塞

#### 5.1 优点

- 4 个核心 Tool 现在都已显式引入命名 output schema，MCP schema 冻结不再只停留在 input 侧。
- `sync_docs` 已被收敛为只读、单文档、无写入的 Tool，没有越过 Epic 4 metadata-only 边界。

#### 5.1 关键问题

1. **`query_relations` 的完整 I/O 合同仍未写实** — 只补了 `relationId` 和 output DTO，但没有把输入 schema 与 CLI/MCP 同构关系一并冻结。
2. **`sync_docs` 的输出映射仍未闭合** — 单文档化后，`AnalyzeImpactResult` 如何稳定转换成 `SyncDocsResult` 仍无字段映射表，`action` 的来源尤其不清楚。

#### 5.1 建议动作

- 把 `QueryRelationsInput` 命名 schema 提升到 Story 5.1 明文合同，显式承接 `docPath`、`type`、`includeDeprecated`。
- 为 `sync_docs` 补一张明确的字段映射表，或直接复用 `AnalyzeImpactResult`，避免额外 DTO 翻译缺口。

### Story 5.2: MCP Tools 关系管理能力

#### 5.2 结论

有条件通过

#### 5.2 优点

- 关系管理 Tool 的输入模型已经稳定，`relationId` 与业务三元组的职责边界不再混乱。
- 3 个 Tool 的 output schema 已经被设计出来，不再完全缺席。

#### 5.2 关键问题

1. **output schema 仍只停留在 Dev Notes** — 当前 AC、任务和测试都还没有真正承接 `AddRelationResult` / `RemoveRelationResult` / `DeprecateRelationResult` 的导出与校验。

#### 5.2 建议动作

- 把 3 个关系管理 Tool 的 output schema 提升到 AC / Task / 测试层，避免 round-2 的修订再次退化成“只存在于设计注释里”。

### Story 5.3: IDE 适配器与自动检测

#### 5.3 结论

有条件通过

#### 5.3 优点

- Copilot 与 Codex CLI 的 `AGENTS.md` 共享化已被正式纳入 detector 规则，最直接的双命中冲突得到缓解。
- Copilot 交付物和 `--ide` override 的核心边界仍保持与 PRD 主线一致。

#### 5.3 关键问题

1. **Codex 命中条件仍有双口径** — “检测策略”里是“`AGENTS.md` 且 `.vscode/` 不存在”，而“共享文档规则”里则写成“`AGENTS.md` 且不存在任何其他 IDE 专属标志”。
2. **零侵入策略仍未写清共享文件 owner** — 目前只有抽象的“不修改已有配置”表述，没有 `AGENTS.md` / 其他指令文件已存在时的 skip / conflict / merge 规则。

#### 5.3 建议动作

- 把 Codex 命中谓词统一成单一规则，并在“检测策略”和“冲突裁决”两处保持完全一致。
- 为共享指令文件补上 create-if-absent / preserve-if-exists / explicit-conflict 的零侵入合同。

### Story 5.4: InitService 一键初始化（cord init）

#### 5.4 结论

硬阻塞

#### 5.4 优点

- `--format json` 和 `AMBIGUOUS_IDE` 分支已经被正式写进 AC，不再只有模糊口头说明。
- Dev Notes 里的配置文件输出已不再是 yaml-only，主流程至少承接了 format 分支。

#### 5.4 关键问题

1. **检测返回值仍是假定唯一命中** — Dev Notes 还在使用 `detectIde(projectRoot) -> IIdeAdapter` 的单值模型，无法承接多 IDE 命中候选列表与结构化错误分支。
2. **AC #13 仍无任务/测试 owner** — 新增的关键错误分支没有被挂到 Task 2 / Task 3，开发时很容易再次被遗漏。

#### 5.4 建议动作

- 把 `detectIde` 收敛为显式的 `DetectionResult` 合同，至少包含 `matches`、`selected`、`ambiguity` / `error` 分支。
- 为 AC #13 单独补 CLI 子任务和测试项，显式校验 `error`、`candidates`、`suggestion` 三个字段。

### Story 5.5: Hooks 文档变更自动触发与 Skills 生成

#### 5.5 结论

有条件通过

#### 5.5 优点

- Skills 已不再使用自然语言描述输出格式，而是显式引用命名 schema。
- “同步建议”场景也已与 5.1 的单文档 `sync_docs` 契约对齐，不再依赖未声明的 batch facade。

#### 5.5 关键问题

1. **`SyncDocsResult` 的字段映射缺口会直接传染到 Skills** — 5.5 虽然已经引用 schema 名称，但上游 schema 仍未解释 `action` 如何从影响分析结果稳定导出。

#### 5.5 建议动作

- 待 5.1 把 `AnalyzeImpactResult -> SyncDocsResult` 的字段映射补齐后，再把 Skills 的“同步建议”场景与该映射一并固化。

## 通过项

- Round-2 的 `relationId` 句柄补齐已经真实落地，原始“关系管理完全拿不到稳定句柄”的问题已被关闭。
- `sync_docs` 的批处理 facade 缺口已通过“缩回单文档”策略被显式收敛，不再要求额外的批量 service owner。
- 5.1 / 5.5 已把 MCP Tool 输出 schema 与 Skills 输出格式连接起来，方向上已明显优于 round-2 之前的自由文本状态。
- 5.3 已承认 `AGENTS.md` 是 Copilot / Codex CLI 的共享产物，不再把 `.vscode + AGENTS.md` 直接视为双命中。
- 5.4 已把非 TTY 自动化与 `AMBIGUOUS_IDE` 错误分支写入 AC，init 的自动化边界比 round-2 之前清晰。

## 结论

- **结论**：不通过
- **阻塞项**：Story 5.1 的 `query_relations` 统一 I/O 合同仍未闭合；`sync_docs` 输出映射仍未写实；Story 5.4 的多命中检测返回值与 AC #13 仍未形成可执行实现/测试合同。
- **建议**：优先修订 Story 5.1 的 `QueryRelationsInput` 与 `SyncDocsResult` 映射，再修订 Story 5.4 的 `DetectionResult` 合同和 AC #13 任务/测试 owner；随后补齐 Story 5.2 的 output schema 任务化、Story 5.3 的共享文件零侵入规则，并把上述边界同步回 Epic 5 父文档。完成后启动第 4 轮 SR 复审。
