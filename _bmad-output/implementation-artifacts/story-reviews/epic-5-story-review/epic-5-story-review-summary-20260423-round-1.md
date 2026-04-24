---
Epic: 5
Scope: epic
Round: 1
Date: 2026-04-23
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

# Epic 5 Story 设计审查总结

## 审查结论

首轮审查。共审查 Epic 5 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：3 个

总体判断：Epic 5 的产品方向和 Story 切分基本合理，MCP、IDE 适配、init 和 Hooks/Skills 这四条主线也已基本成形；但当前仍有几处共享契约没有闭合，导致实现者会在 MCP 输入边界、`sync_docs` 语义、Copilot 产物清单和 `cord init` CLI 契约上自行补脑。最核心的阻塞集中在三条主线上：一是 Story 5.2 没有为关系管理 Tool 定义对外稳定输入契约；二是 Story 5.1 对 FR32 只承接了“长驻进程”而没有承接“并发查询请求”，且 `sync_docs` 仍缺少与 Epic 4 已闭合边界一致的读侧契约；三是 Story 5.3 对 VS Code Copilot 的交付物和多 IDE 检测裁决仍与 PRD 矩阵不完全一致。Epic 5 当前不建议直接进入开发。

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
  - `_bmad-output/implementation-artifacts/stories/2-1-framework-adapter-interface-and-generic-fallback.md`
  - `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
  - `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
  - `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-summary-20260423-round-4.md`
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

### 1. [高] 关系管理 MCP Tool 缺少对外稳定输入契约

- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：5-2
- **证据** - Story 5.2 只要求注册 `add_relation`、`remove_relation`、`deprecate_relation` 三个 Tool 并“暴露原子化 CRUD”，但没有定义 MCP 层究竟接收 `relationId` 还是 `sourcePath + targetPath + relationType` 这组业务键；与此同时，Story 4.1 已把 `removeRelation` / `deprecateRelation` 收敛为对象入参并围绕 `relationId` 草拟 Service 契约。当前 Story 5.2 没有任何 Zod schema、共享输入类型或“AI IDE 解析后应提交什么结构”的说明。
- **影响** - MCP Tool 无法形成稳定可测的 schema，开发者会在“暴露内部 relationId”与“入口层自行查找业务键”之间自行裁决，直接影响 Tool schema、测试样例和后续 Agent 调用方式。
- **建议** - 在 Story 5.2 中先统一关系管理 Tool 的外部输入模型：明确使用 `relationId` 还是业务三元组；补充 `AddRelationInput`、`RemoveRelationInput`、`DeprecateRelationInput` 的共享 Zod schema / type 任务，并把它们与 Story 4.1 的 Service 签名一起写实。

### 2. [高] Story 5.1 没有真正承接 FR32 的“并发查询请求”合同

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：5-1
- **证据** - PRD 的 FR32 明确要求“MCP Server 可以作为长驻进程运行，响应 AI Agent 的并发查询请求”；但 Story 5.1 的 AC #4 只保留了“作为长驻进程运行（FR32）”，Task 和测试也只覆盖 4 个 Tool 端到端、SIGTERM 和输入验证失败，没有任何并发调用、并发只读查询或请求隔离的口径。
- **影响** - 当前 Story 5.1 即使完成，也只能证明“能跑起来”，不能证明它满足 PRD 对 MCP Host 的核心并发能力要求。后续开发者可能把并发支持静默降级为单请求串行行为，却仍误以为 FR32 已关闭。
- **建议** - 在 Story 5.1 中补一条显式 AC 和测试要求，至少覆盖并发只读 Tool 调用的基本合同；若 v0.1 实际只承诺单并发，则应先同步收窄 PRD / Epic 对 FR32 的表述，而不是在 Story 层默认降级。

### 3. [高] `sync_docs` Tool 仍缺少与 Epic 4 已闭合边界一致的读侧契约

- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：5-1、5-5
- **证据** - Story 5.1 只写 `src/mcp/tools/sync-docs.ts` “触发关联文档同步建议”，Story 5.5 又把“同步建议”作为第 4 个 Skills 意图直接映射到 `sync_docs`；但 Story 4.3 已明确 v0.1 的 `updateStrategy` 只是 ImpactService 结果中的只读决策元数据，“不自动触发同步、不实现 orchestration 逻辑”。当前全仓没有任何上游 Story 为 `sync_docs` 定义服务归属、输入参数和返回结构，架构文档也只列出了工具文件名，没有给出共享输出契约。
- **影响** - 实现者无法判断 `sync_docs` 是“返回同步建议的只读 Tool”还是“真正执行文档同步的编排 Tool”。若前者，当前缺少与 ImpactService / `updateStrategy` 的复用边界；若后者，则会直接越过 Epic 4 已经裁定的 v0.1 范围。
- **建议** - 先在 Story 5.1 中做边界裁决并写成显式契约：建议将 `sync_docs` 收敛为只读建议 Tool，复用 ImpactService 的建议动作和 `updateStrategy` 元数据，不执行文档写入；同时补充输入 / 输出 schema、Service owner 和与 Story 5.5 Skills 场景的对应关系。

### 4. [中] VS Code Copilot 产物清单与 PRD IDE 矩阵不一致

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：5-3
- **证据** - PRD 的 IDE 集成矩阵明确把 VS Code Copilot 的指令文件格式定义为 `copilot-instructions.md + AGENTS.md`，文档管辖范围 FR38 也把 `AGENTS.md` 纳入 AI IDE/Agent 指令文档；但 Story 5.3 AC #5 只要求 `copilot-instructions.md + MCP Host`，把 `AGENTS.md` 只放到了 Codex CLI 的基础集成中。
- **影响** - 这会让 Copilot 适配器的交付物与 PRD 不一致，也让后续 `cord init` 无法按统一规则生成 Copilot 所需的完整指令面。实现者如果只照 Story 5.3 做，会留下一个表面“已支持 Copilot”、实际少交一份指令文件的假闭环。
- **建议** - 在 Story 5.3 中把 VS Code Copilot 的交付物补齐为 `copilot-instructions.md + AGENTS.md + MCP Host`，或者明确裁决 `AGENTS.md` 在 Copilot v0.1 中不生成，并同步回写 PRD / Epic。

### 5. [中] 多 IDE 自动检测缺少确定性的冲突裁决与显式覆盖路径

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：5-3、5-4
- **证据** - Story 5.3 的检测策略只列出“.claude/ 或 CLAUDE.md → Claude Code、.cursor/ → Cursor、.vscode/ → Copilot、AGENTS.md → Codex CLI”，但没有定义一个项目同时存在多种 IDE 痕迹时如何选择；Story 5.4 又直接依赖“自动检测 IDE 并选择适配器”，也没有补充显式 override 流程。
- **影响** - 在真实项目里，多 IDE 文件并存是高概率场景。当前没有优先级、冲突提示或显式 override，`cord init` 的行为会变得不可预测，导致生成错误的配置文件或把“用户只是保留旧目录”误判为当前 IDE。
- **建议** - 在 Story 5.3 中补充检测优先级和冲突处理规则，并在 Story 5.4 的 init 流程里写清“自动检测命中多个 IDE 时的提示/选择/覆盖”行为；如果允许显式配置覆盖自动检测，也应写入 AC。

### 6. [中] `cord init` 的配置文件格式分支与 CLI 输出边界没有闭合

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：5-4
- **证据** - 架构决策 D6 已明确 `cord init` 默认生成 `cord.config.yaml`，并可通过 `--format json` 生成 `cord.config.json`；Story 2.4 也已把两种配置格式都定义为共享配置契约。但 Story 5.4 只承接了“生成 `cord.config.yaml` 默认配置文件”和“支持 `--json` 输出”，既没有 `--format json` 的生成分支，也没有定义 `--json` 与 `@clack/prompts` 交互向导在非 TTY / 自动化场景下如何共存。
- **影响** - 当前 Story 5.4 即便实现，也无法完整满足已存在的配置格式决策；同时 `--json` 的行为边界不明，容易出现“命令想要机器可读输出，却先进入交互向导”的接口歧义。
- **建议** - 在 Story 5.4 中补充两类 CLI 契约：一是显式承接 `--format json` 生成 `cord.config.json` 的路径；二是明确 `--json` 下的 TTY / 非 TTY 行为、交互是否允许、以及机器可读输出的最终结构。

## 逐篇审查结论

### Story 5.1: MCP Server 核心与 4 个 Tools

#### 5.1 结论

硬阻塞

#### 5.1 优点

- MCP SDK、snake_case/camelCase、stderr/stdout、薄壳约束和 SIGTERM 优雅退出等全局规则都已被正确带入 Story。
- 4 个核心 Tool 的拆分方式与 PRD FR28 基本一致，整体入口层结构是合理的。

#### 5.1 关键问题

1. **FR32 只承接了“长驻进程”，没有承接“并发查询请求”** — 当前 AC 和测试无法证明 Story 满足 PRD 对 MCP Host 的并发能力要求。
2. **`sync_docs` 缺少共享输入输出契约** — 既没有服务 owner，也没有和 Epic 4 metadata-only 边界闭合。

#### 5.1 建议动作

- 为 FR32 增加显式并发 AC / 测试，或先同步收窄上游需求。
- 在本 Story 中把 `sync_docs` 的读侧语义、复用来源和 schema 写实。

### Story 5.2: MCP Tools 关系管理能力

#### 5.2 结论

硬阻塞

#### 5.2 优点

- 能力边界总体正确：CORD 负责原子关系操作，AI IDE 负责自然语言意图解析，与 PRD FR20 一致。
- 新增 Tool 不影响已有 4 个 Tool schema 的约束也被正确继承了下来。

#### 5.2 关键问题

1. **对外输入模型没有定义** — 当前没有写清 MCP Tool 暴露 `relationId` 还是业务三元组，也没有共享 schema。

#### 5.2 建议动作

- 先把关系管理 Tool 的外部输入 contract 做成可复用的 schema / type，再安排 MCP Tool 具体实现。

### Story 5.3: IDE 适配器与自动检测

#### 5.3 结论

硬阻塞

#### 5.3 优点

- `IIdeAdapter` + detector + 具体适配器的总体方向与 Epic 2 的适配器模式保持一致。
- “独立文件注入，不修改用户已有配置”的零侵入方向是正确的。

#### 5.3 关键问题

1. **Copilot 产物清单缺少 `AGENTS.md`** — 与 PRD IDE 矩阵不一致。
2. **多 IDE 检测没有确定性裁决** — 当前没有优先级或冲突提示，`cord init` 可能在真实项目里误判。

#### 5.3 建议动作

- 对齐 Copilot 的完整交付物清单。
- 补齐检测优先级、冲突提示和显式覆盖路径。

### Story 5.4: InitService 一键初始化（cord init）

#### 5.4 结论

有条件通过

#### 5.4 优点

- `detectIde → detectFramework → generate configs → create data dir` 的编排方向清楚。
- 把 `cord init` 保持为 CLI 薄壳、由 InitService 承担业务编排，整体分层符合架构。

#### 5.4 关键问题

1. **配置文件格式分支未承接 D6** — 缺少 `--format json` 对 `cord.config.json` 的支持说明。
2. **`--json` 与交互向导的边界不明确** — 机器可读输出与 `@clack/prompts` 的共存策略没有写实。

#### 5.4 建议动作

- 补齐 `--format json` 和 `--json` 的 CLI 合同，再细化 InitResult / 输出结构。

### Story 5.5: Hooks 文档变更自动触发与 Skills 生成

#### 5.5 结论

有条件通过

#### 5.5 优点

- Claude Code Hooks 与“无原生 Hooks IDE 走指令引导”的分层方向，符合 PRD 的三层集成架构。
- 4 个 Skills 意图场景与 PRD FR31 保持一致。

#### 5.5 关键问题

1. **`sync_docs` 语义依赖上游未闭合** — 当前第 4 个 Skills 场景引用了一个尚未有稳定读侧契约的 Tool。

#### 5.5 建议动作

- 在 Story 5.1 明确 `sync_docs` 语义后，再把本 Story 的同步建议场景对齐到同一返回结构。

## 通过项

- Epic 4 的 `updateStrategy` 边界已经在 round-4 复审中明确闭合为 metadata-only，Epic 5 不需要再重复解决“自动编排 vs 只读策略”的父级歧义；本轮阻塞只发生在 `sync_docs` 如何消费该边界。
- Story 5.1 正确继承了 MCP 入口层的全局规则：工具命名、参数命名、stdout/stderr 隔离、薄壳分层和 SIGTERM 退出约束均未跑偏。
- Story 5.2 明确保留了 FR20 的职责边界，没有把自然语言意图理解错误地下沉到 CORD 内部。
- Story 5.3 到 5.5 的主线切分总体合理：适配器、初始化、Hooks/Skills 没有被粗暴揉成一个大 Story。
- Story 5.5 对不支持 Hooks 的 IDE 使用指令文件引导，而不是强行假设所有 IDE 都有 Claude Code 式 Hook 能力，这一点与 PRD 的分级集成架构一致。
