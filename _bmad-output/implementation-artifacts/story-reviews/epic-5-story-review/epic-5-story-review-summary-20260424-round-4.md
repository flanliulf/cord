---
Epic: 5
Scope: epic
Round: 4
Date: 2026-04-24
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

# Epic 5 Story 设计审查总结

## 审查结论

第 4 轮复审。共审查 Epic 5 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：1 个
- 有条件通过：3 个
- 硬阻塞：1 个

总体判断：round-3 的主要修订已经继续推进 Epic 5 收敛，尤其是父 Epic 旧口径、Story 5.2 的 output schema owner、Story 5.4 的 `DetectionResult` / `AMBIGUOUS_IDE` owner 都已进入可执行文本；但本轮复审确认，Epic 5 仍有一条主阻塞没有真正关闭：Story 5.1 目前仍在 MCP 消费侧单边冻结多个 Tool 的输出 DTO，而没有把 canonical JSON 合同同步回 Story 2.5 / 3.1 / 3.3 这些源 Story，导致 NFR13 与 NFR11 仍无法形成单一可测试基线。除此之外，Story 5.3 新引入的 `AGENTS.md` 共享文件追加策略又与零侵入基线形成冲突，连带使 Story 5.4 的 init 编排在 mixed-IDE 仓库里缺少唯一执行规则。Epic 5 已明显接近 ready-for-dev，但本轮后仍不建议直接进入开发。

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
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-summary-20260423-round-3.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-5-story-review/epic-5-story-review-evaluation-20260423-round-3.md`
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

1. Round 3 / Finding #2 — 父 Epic 5 仍保留 round-2 之前的旧验收口径
   - Epic 5 已同步 5.1 的 input/output 双 schema、5.3 的 Copilot + `AGENTS.md`、5.4 的 `--format json` / `AMBIGUOUS_IDE`，以及 5.5 对命名 schema 的直接引用。
   - 验证结果：父子文档漂移已关闭，本轮未再发现父 Epic 回流旧合同。

2. Round 3 / 修订执行记录 #3 — Story 5.2 的 output schema 只停留在 Dev Notes
   - Story 5.2 已新增 AC #7，并把 `AddRelationResult` / `RemoveRelationResult` / `DeprecateRelationResult` 挂到 Task 1.5 与 Task 3。
   - 验证结果：output schema owner 已进入 AC / Tasks / 测试层，这条问题已关闭。

3. Round 3 / 修订执行记录 #4 — Story 5.4 的 `DetectionResult` 与 AC #13 owner 缺失
   - Story 5.4 已把 `detectIde(projectRoot)` 收敛为 `DetectionResult`，并将 AC #13 挂入 Task 2 / Task 3。
   - 验证结果：多 IDE / 非 TTY / `AMBIGUOUS_IDE` 的主流程 owner 已进入可执行文本，这条问题已关闭。

### 部分修复但仍未闭合

1. Round 3 / Finding #1 — `query_relations` 的统一输入/输出合同仍未真正闭合
   - Story 5.1 已补入 `QueryRelationsInput` 命名 schema，`sync_docs` 的单文档字段映射也已写实。
   - 验证结果：输入侧和 `sync_docs` 映射已推进，但 Story 3.1 仍未同步 CLI JSON 的包裹层、`totalCount` 与排序规则，`query_relations` 的 canonical 源合同仍未真正关闭。

2. Round 3 / 修订执行记录 #5 — Story 5.3 的共享文件合同
   - Codex 命中谓词已统一为“存在 `AGENTS.md` 且不存在其他 IDE 专属标志”，最直接的 detector 双口径已经关闭。
   - 验证结果：但新增的 `preserve-if-exists` 追加策略与零侵入基线形成新冲突，本轮作为新问题继续跟踪。

### 仍为非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 新发现

### 1. 【高】【新】Story 5.1 仍以 MCP 侧 DTO 代替共享源合同，NFR13 / NFR11 无法真正闭合

- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：2-5、3-1、3-3、5-1、5-5
- **证据** - Story 5.1 现在已经冻结 `QueryRelationsResult`、`AnalyzeImpactResult`、`InitGraphResult`；但 Story 3.1 仍把查询侧定义为 `QueryResultItem[]`，没有把 CLI JSON 同步到 `relations + totalCount` 包裹层；Story 3.3 与 PRD FR17 仍要求影响分析结果显式包含传播行为类型和建议动作，而 5.1 的 `AnalyzeImpactResult` 只返回 `updateStrategy + reason`；Story 2.5 的 `ScanResult` 仍是 `documentsFound + relationsDiscovered + warnings + duration`，5.1 的 `InitGraphResult` 则改成 `docCount + relationCount + duration`。这些 DTO 目前都还只存在于 5.1 的 MCP 消费侧，没有回写到 2.5 / 3.1 / 3.3 的源 Story 或统一 shared schema owner。
- **影响** - CLI / MCP 对同一 Service 的深度比较失去唯一基线，NFR13 与 NFR11 无法稳定断言；Story 5.5 当前虽然已经引用命名 schema，但也可能把 MCP 本地包装层错误地固化成长期合同。
- **建议** - 先在 Story 2.5 / 3.1 / 3.3（或单独的共享 DTO 合同）裁决 canonical JSON 结构，再让 Story 5.1 只引用同一套命名 schema；若某个 MCP Tool 本来就是包装层而不是 CLI 同构入口，必须在 PRD 与 Story 中显式声明它不参加直接 parity 比较。

### 2. 【中】【新】`AGENTS.md` 的共享追加策略与零侵入基线仍然冲突

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：5-3、5-4
- **证据** - Story 5.3 一方面在 AC #7 和“零侵入策略”中要求“独立文件注入，不修改已有配置”；另一方面又在“共享文件处理契约”里规定：若 `AGENTS.md` 已存在，则 `preserve-if-exists` 并追加 CORD 专属配置段。`project-context.md` 仍把 IDE 适配器模式定义为“不修改 IDE 现有配置，只新增 CORD 相关文件”，而 Story 5.4 的 init 流程目前也没有针对“已有 `AGENTS.md`”给出显式的 skip / conflict / 非 TTY 分支。
- **影响** - mixed-IDE 仓库里无法稳定判断现有 `AGENTS.md` 是 read-only、appendable 还是 explicit-conflict；零侵入验证（如 SHA-256 不变）也因此缺少唯一预期，`cord init` 在现有仓库上的行为仍可能不可预测。
- **建议** - 在 Story 5.3 / 5.4 / project-context 三处统一为一条可执行规则：要么把 `AGENTS.md` 明确声明为 NFR12 的例外共享文件，并补 conflict UX / 非 TTY 行为 / 测试断言；要么维持严格零侵入，将已有 `AGENTS.md` 统一改为 create-only 或 explicit-conflict，禁止自动追加。

## 逐篇审查结论

### Story 5.1: MCP Server 核心与 4 个 Tools

#### 5.1 结论

硬阻塞

#### 5.1 优点

- `QueryRelationsInput` 与 `sync_docs` 的单文档映射已经进入 Story，round-3 的输入侧和字段映射缺口已明显收敛。
- 4 个核心 Tool 的命名 output schema 现在都已显式出现，不再停留在“自然语言约定”。

#### 5.1 关键问题

1. **canonical DTO owner 仍未回写到源 Story** — `query_relations`、`analyze_impact`、`init_graph` 现在都只在 5.1 的 MCP 侧冻结输出结构，和 2.5 / 3.1 / 3.3 的 CLI / Service 合同仍未单一化。
2. **NFR13 / NFR11 还不可执行** — 由于源 Story 与消费 Story 仍教授不同字段形状，双入口 parity 和三 IDE 标准验证无法形成唯一断言基线。

#### 5.1 建议动作

- 先把 2.5 / 3.1 / 3.3 的 JSON 合同与 5.1 对齐，再将 5.1 改为只引用共享 DTO。
- 若某些 MCP Tool 有意使用包装层而不直接同构 CLI，必须显式写入例外说明、测试范围和 parity 豁免边界。

### Story 5.2: MCP Tools 关系管理能力

#### 5.2 结论

通过

#### 5.2 优点

- 输入模型与输出模型现在都已进入 AC / Tasks / 测试 owner，`relationId` 和业务三元组的职责边界稳定。
- 与 Story 4.1 的 `RelationService` 契约保持一致，没有再出现入口层临场裁决参数的问题。

#### 5.2 关注点

- `relationId` 的“先查后改”闭环仍依赖 Story 3.1 / 5.1 的查询结果同构，但这已不再是 5.2 自身的局部合同缺口。

### Story 5.3: IDE 适配器与自动检测

#### 5.3 结论

有条件通过

#### 5.3 优点

- Copilot / Codex 的 `AGENTS.md` 共享探针已经被明确写入 detector 规则，不再保留 round-3 之前的双口径。
- 冲突裁决与 `--ide` override 的主干合同保持清晰，mixed-IDE 检测主线比前一轮稳定。

#### 5.3 关键问题

1. **共享文件追加策略与零侵入冲突** — 当前允许对已有 `AGENTS.md` 追加配置段，但零侵入基线仍要求不修改已有 IDE 配置。

#### 5.3 建议动作

- 为已有 `AGENTS.md` 选择一条唯一规则：明确例外并补测试，或回退为 create-only / explicit-conflict。

### Story 5.4: InitService 一键初始化（cord init）

#### 5.4 结论

有条件通过

#### 5.4 优点

- `DetectionResult`、`AMBIGUOUS_IDE`、`--format json` 与 `--json` 的主流程现在都已经进入 AC / Tasks / Dev Notes。
- `cord init` 的非 TTY 路径比 round-3 前更加明确，不再存在原始的多命中三角冲突。

#### 5.4 关键问题

1. **init 编排仍消费未裁决的共享文件规则** — 对已有 `AGENTS.md` 的 skip / conflict / 非 TTY 行为还没有单一执行合同，只能继承 5.3 当前仍冲突的策略。

#### 5.4 建议动作

- 在 5.3 统一共享文件规则后，把相同规则显式下沉到 init 流程与测试用例，避免 `cord init` 在 mixed-IDE 仓库上出现不一致行为。

### Story 5.5: Hooks 文档变更自动触发与 Skills 生成

#### 5.5 结论

有条件通过

#### 5.5 优点

- 4 个 Skills 场景现在已经全部引用命名 schema，不再使用自然语言描述“预期输出格式”。
- `sync_docs` 场景也已与 5.1 的单文档契约对齐，没有再回退到未声明的 batch facade。

#### 5.5 关键问题

1. **当前引用的是 5.1 的 MCP 本地 DTO** — 在 5.1 还没有把 canonical JSON 合同同步回源 Story 之前，Skills 固定下来的 schema 名称仍可能固化错误的包装层。

#### 5.5 建议动作

- 待 5.1 完成 canonical DTO 回写后，再以同一套共享 DTO 作为 Skills 的最终输出基线。

## 通过项

- 父 Epic 5 与子 Story 的摘要 / AC 已重新对齐，本轮未再发现父级旧合同回流。
- Story 5.2 的 3 个关系管理 Tool output schema 已完成从 Dev Notes 到 AC / Tasks / 测试 owner 的提升。
- Story 5.4 的 `DetectionResult`、`AMBIGUOUS_IDE`、`--format json` 与 `--json` 主流程都已经进入明确文本，不再是 round-3 之前的模糊口头约定。
- `sync_docs` 的单文档映射与 metadata-only 边界保持稳定，本轮未再发现越过 Epic 4 写入边界的问题。

## 结论

- **结论**：不通过
- **阻塞项**：Story 5.1 尚未为 `query_relations` / `analyze_impact` / `init_graph` 建立跨 CLI / MCP 的唯一 canonical DTO 合同，NFR13 / NFR11 因而仍不可执行。
- **建议**：先同步修订 Story 2.5 / 3.1 / 3.3 与 Story 5.1 的共享 DTO owner，再裁决 `AGENTS.md` 在已有文件场景下到底是 NFR12 例外还是 explicit-conflict，并把同一规则同步进 Story 5.3 / 5.4。完成后启动第 5 轮 SR 复审。
