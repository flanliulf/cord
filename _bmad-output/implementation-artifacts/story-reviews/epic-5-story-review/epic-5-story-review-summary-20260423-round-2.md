---
Epic: 5
Scope: epic
Round: 2
Date: 2026-04-23
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

# Epic 5 Story 设计审查总结

## 审查结论

第 2 轮复审。共审查 Epic 5 下 5 个 Story。审查层状态：2/3 层完成，Structure 层超时后由主模型补审。

- 通过：0 个
- 有条件通过：3 个
- 硬阻塞：2 个

总体判断：round-1 的 6 个原始阻塞大体已经修复，Epic 5 已不再停留在“输入契约缺失、FR32 只承接长驻、Copilot 产物不完整、`cord init` 未承接 D6”的首轮状态；但本轮复审发现，修订后的设计仍留下几处二阶契约缺口，主要集中在“关系管理的稳定句柄闭环”“`sync_docs` 与现有 Service 的可执行映射”“MCP Tool 输出 schema 冻结”以及“`cord init` 在自动化场景下的单一可执行合同”。Epic 5 目前仍不建议进入开发，但阻塞范围已收敛到少数跨 Story 共享契约。

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
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-summary-20260423-round-1.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-evaluation-20260423-round-1.md`
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

1. Round 1 / Finding #1 — 关系管理 MCP Tool 缺少对外稳定输入契约
   - Story 5.2 已明确 `add_relation` 使用业务三元组，`remove_relation` / `deprecate_relation` 使用 `relationId`，并补入共享 Zod input schema。
   - 验证结果：MCP 入口输入合同已闭合，这条问题已关闭。

2. Round 1 / Finding #2 — Story 5.1 未真正承接 FR32 的并发查询请求合同
   - Story 5.1 已新增 AC #11 和并发只读 Tool 调用测试要求。
   - 验证结果：FR32 的“并发查询请求”已进入 Story 明文合同，这条问题已关闭。

3. Round 1 / Finding #3 — `sync_docs` 缺少与 Epic 4 一致的读侧契约
   - Story 5.1 / 5.5 已将 `sync_docs` 收敛为只读建议 Tool，并补入 metadata-only 边界说明。
   - 验证结果：原始的“会不会越过 Epic 4 执行写入”边界歧义已关闭；但本轮发现其可执行 Service 映射仍未闭合，另行跟踪。

4. Round 1 / Finding #4 — VS Code Copilot 产物清单与 PRD IDE 矩阵不一致
   - Story 5.3 已把 Copilot 交付物补齐为 `copilot-instructions.md + AGENTS.md + MCP Host`。
   - 验证结果：Copilot 交付物与 PRD IDE 矩阵已对齐，这条问题已关闭。

5. Round 1 / Finding #5 — 多 IDE 自动检测缺少冲突裁决与显式覆盖路径
   - Story 5.3 已补入检测优先级与冲突裁决，Story 5.4 已新增 `--ide <name>` override 和多命中提示要求。
   - 验证结果：原始的“完全没有冲突处理路径”问题已关闭；但本轮发现 `AGENTS.md` 共享化后又引入新的检测信号冲突，另行跟踪。

6. Round 1 / Finding #6 — `cord init` 的配置格式与 `--json` 边界未闭合
   - Story 5.4 已新增 `--format json` 生成 `cord.config.json`，并把 `--json` 收敛到非 TTY / 自动化场景。
   - 验证结果：D6 的主路径已被承接；但本轮发现 `--json` 与多 IDE 命中的组合语义仍未形成单一可执行合同，另行跟踪。

### 仍为非阻塞待办

本轮无沿用上轮结论但继续保留的非阻塞待办。

## 新发现

### 1. 【高】【新】`query_relations` 仍未暴露 `relationId`，关系管理闭环依然断裂

- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：3-1、5-1、5-2
- **证据** - Story 5.2 已把 `remove_relation` / `deprecate_relation` 的外部入参收敛为 `relationId`，并明确“AI IDE 端使用 `relationId` 操作已有关系”；但 Story 3.1 当前查询结果仍只包含目标路径、关系类型、置信度、来源和 `status`，没有 `relationId` 字段；Story 5.1 又要求 CLI 与 MCP 对相同输入返回语义一致的输出。
- **影响** - FR20 的典型“先查再删/废弃”路径仍走不通：AI IDE 无法从 `query_relations` 稳定拿到后续写操作所需的句柄，只能重新按业务三元组猜测已有边，等于把刚收敛好的 `relationId` 合同再次绕开。
- **建议** - 先做二选一裁决并显式回写：要么把 `relationId` 正式加入 QueryResult / `query_relations` 输出；要么回到 Story 5.2 重新定义 remove / deprecate 的外部输入模型，避免“读侧不给句柄、写侧却强依赖句柄”的双轨合同并存。

### 2. 【高】【新】`sync_docs` 虽已收窄为只读 Tool，但仍没有可执行的 Service 映射与批处理契约

- **来源**：structure+contract
- **分类**：decision_needed
- **涉及 Story**：5-1、5-5
- **证据** - Story 5.1 现在把 `sync_docs` 定义为只读建议 Tool，输入为 `filePaths[]`，输出为 `suggestions[] + affectedCount`，Service owner 指向 ImpactService；但 Story 3.3 当前公开的服务入口仍是单文档的 `analyzeImpact(input: ImpactInput)`，只接受 `docPath`，并没有多文档聚合、去重或 suggestion DTO 的现成合同；Story 5.5 的 Skills 又直接依赖 `sync_docs` 的预期输出格式。
- **影响** - 本轮修订关闭了“`sync_docs` 会不会执行写入”的边界问题，却没有回答“谁来把多文档输入折叠成建议列表”的实现前提。实现者仍需私自发明一个批处理 facade，MCP Tool 对外契约因此还没有真正落到现有 Service 层。
- **建议** - 先把 owner 具体化：要么新增明确的 `SyncDocsService` / 应用层 facade，写清 `filePaths` 批处理、去重和输出 DTO；要么把 `sync_docs` 缩回单文档只读查询，直接复用 Story 3.3 的现有签名，不再声明一个尚未有承接者的批量契约。

### 3. 【高】【新】MCP Tool 输出 schema 仍未冻结，NFR10 / NFR11 / FR31 目前无法可测闭合

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：5-1、5-2、5-5
- **证据** - PRD 明确要求每个 MCP Tool 具备输入/输出 schema，并要求已有 4 个 Tool 的输入输出 JSON Schema 在新增 Tool 后保持不变；但当前 Story 5.1 / 5.2 的修订主要冻结了 input schema，`sync_docs` 只给出了 TypeScript interface 草图，关系管理 Tool 也未定义标准输出 DTO；Story 5.5 又要求 Skills 文件写出“预期输出格式”，却没有引用任何共享 schema 名称。
- **影响** - NFR10 的 schema 快照、NFR11 的三 IDE 验证以及 FR31 的 Skills 输出格式，都会因为“只有输入稳定、输出仍靠自由文本描述”而失去可执行基线。开发时很容易出现 CLI/MCP 结构漂移，且测试无法稳定断言。
- **建议** - 在 Story 5.1 / 5.2 中为全部 7 个 MCP Tool 补齐命名输出 DTO 与 Zod schema，并明确哪些字段直接复用 CLI JSON 输出、哪些字段属于 MCP 包裹层；Story 5.5 的 Skills 预期输出格式应改为引用同一套共享 schema，而不是继续用自然语言描述。

### 4. 【高】【新】`cord init` 在 `--json` + 非 TTY + 多 IDE 命中场景仍没有单一可执行合同

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：5-4
- **证据** - Story 5.4 AC #9 规定 `--json` 在非 TTY / 自动化场景下必须跳过交互并直接返回机器可读 `InitResult`；但 AC #11 又要求多 IDE 命中时通过交互向导要求用户选择，除非显式传入 `--ide`；同时 AC #12 已新增 `--format json` 生成 `cord.config.json`，但 Dev Notes 流程仍写死“生成 `cord.config.yaml`”。
- **影响** - 实现者现在没有一条唯一可执行的 CLI 语义：在非 TTY 且多命中时，到底应该返回结构化错误、按优先级兜底，还是意外阻塞；配置文件格式也在 AC 与 Dev Notes 间保留了 yaml/json 双口径。自动化 init、CI 使用和测试断言因此都会不稳定。
- **建议** - 把 Story 5.4 补成完整 CLI 合同：明确 `--json + 非 TTY + 多命中` 时必须返回机器可读错误并附 `candidates`，或明确要求该场景强制传入 `--ide`；同时把 Dev Notes 的 InitService 流程同步改成 yaml/json 双分支，避免实现时继续默认写死 yaml。

### 5. 【中】【新】`AGENTS.md` 已变成共享产物，但 5.3 仍把它当作 Codex CLI 的独占检测信号

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：5-3、5-4
- **证据** - PRD IDE 矩阵和 Story 5.3 现在都要求 VS Code Copilot 也生成 `AGENTS.md`；但 Story 5.3 的 detector 规则仍把“.vscode/ → Copilot”“`AGENTS.md` → Codex CLI”作为并列检测标志，并规定多命中时不得静默选择；Story 5.4 的 init 流程也没有补共享 `AGENTS.md` 文件的 owner / merge 规则。
- **影响** - 一旦按 Story 5.3 初始化过 Copilot 项目，同时存在 `.vscode/` 与 `AGENTS.md` 将成为常态，自动检测会稳定落入“Copilot + Codex 双命中”。这会削弱 FR2 的自动检测价值，并把共享文档错误地继续当作某一 IDE 的排他探针。
- **建议** - 不要再把 `AGENTS.md` 当成 Codex CLI 的独占 marker。要么为 Codex 引入更专用的检测信号，要么在 Story 5.3 / 5.4 中明确：当 `AGENTS.md` 与 Copilot 专属产物同时存在时，应视为共享文档而不是新的 IDE 命中；同时补充 `AGENTS.md` 的生成、跳过和冲突提示规则。

## 逐篇审查结论

### Story 5.1: MCP Server 核心与 4 个 Tools

#### 5.1 结论

硬阻塞

#### 5.1 优点

- FR32 的并发查询合同已经显式进入 AC，MCP Server 不再只承接“长驻进程”这一半语义。
- `sync_docs` 已从潜在的写入编排收敛为只读建议 Tool，没有再越过 Epic 4 metadata-only 边界。

#### 5.1 关键问题

1. **`query_relations` 仍未暴露稳定句柄** — 5.2 已要求 `relationId` 驱动 remove / deprecate，但 5.1 对应的查询 Tool 还没有提供这条闭环路径。
2. **`sync_docs` 只有 Tool 外壳，没有可执行 Service 映射** — 当前批量输入和 suggestion 输出还没有落到现有 Service 层。
3. **MCP Tool 输出 schema 未冻结** — 5.1 目前仍只能保证 input schema 稳定，无法满足 NFR10 / NFR11 的输出侧验证。

#### 5.1 建议动作

- 先确定关系查询对外是否暴露 `relationId`，并把 QueryResult / `query_relations` 的输出一并改写。
- 为 `sync_docs` 增补可执行的 facade / DTO，或收窄为单文档只读查询。
- 为 4 个核心 Tool 正式补齐输出 schema，而不是停留在 interface 草图。

### Story 5.2: MCP Tools 关系管理能力

#### 5.2 结论

有条件通过

#### 5.2 优点

- 关系管理 Tool 的外部输入模型已经闭合，`add_relation` 与 `remove_relation` / `deprecate_relation` 不再混用模糊输入。
- 共享 Zod input schema 已被显式写入，Story 自身不再把关键入参留给实现者临场裁决。

#### 5.2 关键问题

1. **已存在关系的操作路径仍拿不到 `relationId`** — Story 自己选定了 `relationId` 合同，但上游查询路径尚未对外暴露该句柄。
2. **关系管理 Tool 的输出结构仍未冻结** — 只定义输入，不足以支撑 NFR10 / NFR11 / Skills 输出格式验证。

#### 5.2 建议动作

- 与 Story 3.1 / 5.1 一起把“读到关系后如何获得稳定句柄”的链路写实。
- 补齐 add / remove / deprecate 的标准输出 DTO 与 schema，并与 CLI JSON 输出对齐。

### Story 5.3: IDE 适配器与自动检测

#### 5.3 结论

有条件通过

#### 5.3 优点

- Copilot 交付物已经补齐到 `copilot-instructions.md + AGENTS.md + MCP Host`，不再与 PRD IDE 矩阵脱节。
- 检测优先级、冲突裁决和 `--ide` override 已被明确写入，不再是首轮那种完全缺失的状态。

#### 5.3 关键问题

1. **`AGENTS.md` 的共享化与 detector 规则仍冲突** — 当前仍把共享文档当作 Codex CLI 的独占检测信号，容易把 Copilot 项目稳定识别成双命中。

#### 5.3 建议动作

- 取消 `AGENTS.md` 作为 Codex 的排他探针，改成更专用的检测信号或要求显式 `--ide codex-cli`。
- 顺带补一条共享 `AGENTS.md` 的 owner / merge / skip 规则，避免后续适配器互相覆盖。

### Story 5.4: InitService 一键初始化（cord init）

#### 5.4 结论

硬阻塞

#### 5.4 优点

- Story 已明确承接 `--format json`，并把多 IDE 命中 / `--ide` override 写进了 AC，不再遗漏这些关键入口分支。
- CLI 薄壳 + InitService 编排的主分层保持稳定，没有偏离架构方向。

#### 5.4 关键问题

1. **`--json` 与多 IDE 命中的组合语义仍未闭合** — 非 TTY 自动化场景下缺少单一可执行结果。
2. **Dev Notes 仍保留旧的 yaml-only 流程** — AC 已支持 `--format json`，但实现流程描述尚未同步。

#### 5.4 建议动作

- 把 `--json + 非 TTY + 多命中` 的行为写成机器可读错误或强制 `--ide` 的显式合同。
- 同步更新 Dev Notes 中的 InitService 流程，写清 `cord.config.yaml` / `cord.config.json` 的分支条件和返回结构。

### Story 5.5: Hooks 文档变更自动触发与 Skills 生成

#### 5.5 结论

有条件通过

#### 5.5 优点

- “有 Hooks 的 IDE 自动触发、无 Hooks 的 IDE 走指令引导”的主线依然成立，和 PRD 的分层集成结构保持一致。
- `sync_docs` 在 Skills 场景中已对齐为只读建议 Tool，不再暗示自动写入。

#### 5.5 关键问题

1. **Skills 预期输出格式没有共享 schema 锚点** — 当前仍依赖自然语言描述，无法与 NFR10 / NFR11 的 Tool schema 验证形成同一基线。
2. **“同步建议”场景仍依赖未闭合的 `sync_docs` 批处理契约** — Tool 外壳已定义，但下游输出尚未真正落到可执行 Service。

#### 5.5 建议动作

- 把 4 个 Skills 的“预期输出格式”改为引用 MCP Tool 的共享输出 schema。
- 待 Story 5.1 的 `sync_docs` facade / DTO 决策闭合后，再把第 4 个 Skills 场景与其一一对齐。

## 通过项

- Round 1 的 6 个原始修订项均已实际写入对应 Story，Epic 5 已明显从首轮状态收敛。
- Story 5.2 的输入 schema 决策已经闭合，关系管理 Tool 不再缺少外部入参模型。
- Story 5.1 / 5.5 已把 `sync_docs` 限定为只读建议能力，没有越过 Epic 4 metadata-only 边界去承诺自动编排执行。
- Story 5.3 / 5.4 已显式引入多 IDE 优先级、冲突提示、`--ide` override 和 `--format json` 分支，不再遗漏关键入口路径。
- Story 5.5 继续保持“无原生 Hooks IDE 通过指令文件引导”的保守策略，没有错误假设所有 IDE 都具备 Claude Code 式 Hook 能力。

## 结论

- **结论**：不通过
- **阻塞项**：关系查询与关系管理之间缺少稳定句柄闭环；`sync_docs` 缺少可执行的 Service / DTO 映射；MCP Tool 输出 schema 尚未冻结；`cord init` 在自动化场景下的组合合同仍未闭合。
- **建议**：优先修订 Story 3.1 / 5.1 / 5.2 的 `relationId` 闭环，其次在 Story 5.1 / 5.5 中为 `sync_docs` 增加可执行 facade 或收窄为单文档合同，再统一冻结 7 个 MCP Tool 的输出 schema，最后补齐 Story 5.4 的非 TTY / 多命中 CLI 语义。完成后再启动第 3 轮 SR 复审。
