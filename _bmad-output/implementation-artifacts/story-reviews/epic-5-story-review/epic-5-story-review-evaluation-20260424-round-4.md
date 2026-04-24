---
Epic: 5
Scope: epic
Round: 4
Date: 2026-04-24
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-5-story-review-summary-20260424-round-4.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 5 Story 设计审查评估（Round 4）

## 评估总结

第 4 轮 SR 复审仅产出 2 条新发现（round-3 为 2 条 + 4 项继续跟踪 → round-4 为 2 条新发现），收敛趋势继续保持。本轮 2 条新发现经证据交叉验证后 **全部成立、无误报**：#1（5.1 仍以 MCP 侧 DTO 代替共享源合同，NFR13/NFR11 无法闭合）属于「下游 Story 单边冻结契约、上游 Story 未同步」的典型契约回流风险，跨 2.5/3.1/3.3/5.1/5.5 五个 Story，是当前唯一的硬阻塞；#2（`AGENTS.md` 共享追加策略与零侵入基线冲突）属于 round-3 修订引出的二阶冲突，「preserve-if-exists 追加」与 project-context.md「不修改 IDE 现有配置」直接矛盾，需做唯一裁决。Round 3 的 5 项工作面中，3 项已完全闭合（父 Epic 同步、5.2 output schema owner、5.4 `DetectionResult`/`AMBIGUOUS_IDE` owner），2 项部分闭合（5.1 query/sync_docs 输入侧已补但 canonical owner 未回写、5.3 detector 双口径已修复但引出 `preserve-if-exists` 新冲突）。Epic 5 已非常接近 ready-for-dev，但本轮后仍不建议进入开发，需先关闭这 2 条 P1 工作面。

## 上轮问题回顾确认

### Round 3 / Finding #2：父 Epic 5 旧验收口径 — 已确认修复

Epic 5 文件已同步 4 处旧口径（5.1 input/output 双 schema、5.3 Copilot + `AGENTS.md`、5.4 `--format json` / `AMBIGUOUS_IDE`、5.5 命名 schema 引用）。本轮未再发现父级回流，问题关闭。

### Round 3 / 跟踪项 #3：Story 5.2 output schema 任务化 — 已确认修复

Story 5.2 已新增 AC #7，`AddRelationResult` / `RemoveRelationResult` / `DeprecateRelationResult` 已挂到 Task 1.5 + Task 3。output schema owner 已进入 AC/Tasks/测试层，问题关闭。

### Round 3 / 跟踪项 #4：Story 5.4 `DetectionResult` + AC #13 owner — 已确认修复

Story 5.4 已把 `detectIde(projectRoot)` 收敛为 `DetectionResult`，AC #13 已挂入 Task 2/Task 3。多 IDE / 非 TTY / `AMBIGUOUS_IDE` 主流程 owner 进入可执行文本，问题关闭。

### Round 3 / Finding #1：`query_relations` 统一 I/O 合同 — 部分修复

Story 5.1 已补入 `QueryRelationsInput` 命名 schema，`sync_docs` 单文档字段映射也已写实。但 Story 3.1 的 CLI 侧仍只有 `QueryResultItem[]`，未承接 `relations + totalCount` 包裹层与排序规则；Story 3.3 的 `ImpactResult` 与 5.1 的 `AnalyzeImpactResult` 仍未统一；Story 2.5 的 `ScanResult` (`documentsFound + relationsDiscovered + warnings + duration`) 与 5.1 的 `InitGraphResult` (`docCount + relationCount + duration`) 字段命名仍存在 drift。本轮 #1 即为该问题的「源 Story 回写」延伸，作为新发现继续跟踪。

### Round 3 / 跟踪项 #5：Story 5.3 共享文件零侵入合同 — 部分修复

Codex 命中谓词已统一为「`AGENTS.md` 且不存在其他 IDE 专属标志」，detector 双口径关闭。但新增的 `preserve-if-exists` 追加策略与 NFR12 / project-context「不修改 IDE 现有配置」基线形成新冲突，本轮 #2 一并跟踪。

### 历史非阻塞待办

本轮无沿用上轮的非阻塞待办。

## 发现 #1 评估

### 审查原文

> **【高】【新】Story 5.1 仍以 MCP 侧 DTO 代替共享源合同，NFR13 / NFR11 无法真正闭合**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：2-5、3-1、3-3、5-1、5-5
> - 证据 - Story 5.1 现在已经冻结 `QueryRelationsResult`、`AnalyzeImpactResult`、`InitGraphResult`；但 Story 3.1 仍把查询侧定义为 `QueryResultItem[]`，没有把 CLI JSON 同步到 `relations + totalCount` 包裹层；Story 3.3 与 PRD FR17 仍要求影响分析结果显式包含传播行为类型和建议动作，而 5.1 的 `AnalyzeImpactResult` 只返回 `updateStrategy + reason`；Story 2.5 的 `ScanResult` 仍是 `documentsFound + relationsDiscovered + warnings + duration`，5.1 的 `InitGraphResult` 则改成 `docCount + relationCount + duration`。这些 DTO 目前都还只存在于 5.1 的 MCP 消费侧，没有回写到 2.5 / 3.1 / 3.3 的源 Story 或统一 shared schema owner。
> - 影响 - CLI / MCP 对同一 Service 的深度比较失去唯一基线，NFR13 与 NFR11 无法稳定断言；Story 5.5 当前虽然已经引用命名 schema，但也可能把 MCP 本地包装层错误地固化成长期合同。
> - 建议 - 先在 Story 2.5 / 3.1 / 3.3（或单独的共享 DTO 合同）裁决 canonical JSON 结构，再让 Story 5.1 只引用同一套命名 schema；若某个 MCP Tool 本来就是包装层而不是 CLI 同构入口，必须在 PRD 与 Story 中显式声明它不参加直接 parity 比较。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 三处 drift 全部经证据复现：(1) Story 3.1 line 41/52 仍写 `QueryResultItem[]`，无 `relations + totalCount` 包裹；(2) Story 3.3 line 64 仍写 `analyzeImpact(input: ImpactInput): ImpactResult`，与 5.1 `AnalyzeImpactResult` 字段集不一致；(3) Story 2.5 line 67 `ScanResult { documentsFound, relationsDiscovered, warnings, duration }` 与 5.1 `InitGraphResult { docCount, relationCount, duration }` 命名 drift（且 5.1 缺 warnings）。
**严重性判断**：合理 — 跨 5 个 Story 的共享 DTO 缺主，会让 NFR13（CLI/MCP parity）与 NFR11（三 IDE 验证）的断言基线持续漂移，且 5.5 Skills 已固定的 schema 名称可能错锁在包装层。属典型「下游单边冻结、上游未回写」的契约回流风险。
**修订建议**：可行 — 二选一路径明确：要么把 canonical DTO 在源 Story（2.5/3.1/3.3）回写并让 5.1 只引用，要么显式声明 MCP Tool 为非同构包装层并写明 parity 豁免边界。前者一致性更好，后者实现成本更低；本轮选择前者。
**误报评估**：非误报 — 双来源（consistency+contract）命中，跨 5 个 Story 多处证据闭环，与历史模式「下游 Story 单边补 schema 易导致源合同漂移」一致。

## 发现 #2 评估

### 审查原文

> **【中】【新】`AGENTS.md` 的共享追加策略与零侵入基线仍然冲突**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：5-3、5-4
> - 证据 - Story 5.3 一方面在 AC #7 和"零侵入策略"中要求"独立文件注入，不修改已有配置"；另一方面又在"共享文件处理契约"里规定：若 `AGENTS.md` 已存在，则 `preserve-if-exists` 并追加 CORD 专属配置段。`project-context.md` 仍把 IDE 适配器模式定义为"不修改 IDE 现有配置，只新增 CORD 相关文件"，而 Story 5.4 的 init 流程目前也没有针对"已有 `AGENTS.md`"给出显式的 skip / conflict / 非 TTY 分支。
> - 影响 - mixed-IDE 仓库里无法稳定判断现有 `AGENTS.md` 是 read-only、appendable 还是 explicit-conflict；零侵入验证（如 SHA-256 不变）也因此缺少唯一预期，`cord init` 在现有仓库上的行为仍可能不可预测。
> - 建议 - 在 Story 5.3 / 5.4 / project-context 三处统一为一条可执行规则：要么把 `AGENTS.md` 明确声明为 NFR12 的例外共享文件，并补 conflict UX / 非 TTY 行为 / 测试断言；要么维持严格零侵入，将已有 `AGENTS.md` 统一改为 create-only 或 explicit-conflict，禁止自动追加。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.3 line 72 「零侵入策略（NFR12）」与 line 81 「preserve-if-exists：文件已存在时保留原内容，追加 CORD 专属配置段」直接同文件并列出现；project-context.md line 158「零侵入策略：不修改 IDE 现有配置，只新增 CORD 相关文件」与 5.3 的追加策略形成跨文档矛盾；5.4 init 流程未针对 `AGENTS.md` 已存在场景写 skip/conflict/非 TTY 分支。
**严重性判断**：偏低 — 原始 [中]，但与本仓库「Rule Document Registry 同步约束」一致，跨文档矛盾会让零侵入 SHA-256 验证、`cord init` 在现有仓库的行为、以及非 TTY 自动化都缺少唯一预期；建议升级为 P1 阻塞，与 #1 同批落地。
**修订建议**：可行 — 二选一路径清晰（NFR12 例外 + 配套 UX/测试 vs 严格 create-only/explicit-conflict）；建议前者（appendable + 注释边界），更符合 PRD「与 Codex CLI 共享」的实际生态。但需同步更新 5.3 / 5.4 / project-context.md 三处。
**误报评估**：非误报 — 双来源（structure+consistency）命中，跨 Story + 跨规则文档证据闭环。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 5.1 以 MCP 侧 DTO 代替共享源合同 | [高] | P1 | 在 2.5/3.1/3.3 回写 canonical DTO 并让 5.1 引用 |
| 2 | `AGENTS.md` 追加策略与零侵入基线冲突 | [中] | P1 | 5.3/5.4/project-context 三处同步唯一规则 |

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

建议下一步：将本轮 2 项 P1 修订交由 SR-03 修订器统一落地，建议顺序为：(1) 在 Story 2.5 / 3.1 / 3.3 回写 canonical DTO（`ScanResult`、`QueryRelationsResult`、`AnalyzeImpactResult`），统一字段命名与包裹层，并让 Story 5.1 改为只引用同一套命名 schema；(2) 在 Story 5.3 / 5.4 与 project-context.md 三处同步统一 `AGENTS.md` 规则（建议方向：声明为 NFR12 的 appendable 例外，附 CORD 专属注释边界 + 非 TTY 行为 + 测试断言；按 Rule Document Registry 同步约束同步更新 04-implementation-patterns-consistency-rules.md 与 03-core-architectural-decisions.md）。完成后启动第 5 轮 SR 复审，预计可关闭 Epic 5 进入开发。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-24
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 7 项（涉及 Story 3.1、3.3、5.1、5.3、5.4、project-context.md、04-implementation-patterns-consistency-rules.md）

#### 修订项 #1：Story 3.1 QueryService 返回包裹层
- **文件**: `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
- **章节**: Dev Notes / QueryService 设计
- **修改摘要**: `query()` 返回类型由 `QueryResultItem[]` 改为 `QueryRelationsOutput { relations: QueryResultItem[], totalCount: number }`；新增 `QueryRelationsOutput` 接口定义，标注与 Story 5.1 `QueryRelationsResult` 结构对齐（NFR13）
- **状态**: ✅ 已完成

#### 修订项 #2：Story 3.3 ImpactResult 显式接口定义
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: Dev Notes / ImpactService 设计
- **修改摘要**: 新增显式 `ImpactedDoc` 接口（含 `propagationType`、`suggestedAction`、`confidence`、`reason`）和 `ImpactResult { impactedDocs[], totalCount }` 接口；标注为 canonical source，Story 5.1 `AnalyzeImpactResult` 与此对齐（NFR13）
- **状态**: ✅ 已完成

#### 修订项 #3：Story 5.1 InitGraphResult 字段对齐 + AnalyzeImpactResult 补 propagationType
- **文件**: `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`
- **章节**: Dev Notes / MCP Tool Output Schema
- **修改摘要**: `InitGraphResult` 字段重命名以对齐 `ScanResult`（`docCount→documentsFound`，`relationCount→relationsDiscovered`，补 `warnings` 字段）；`AnalyzeImpactResult` 每条 item 补 `propagationType` 字段（FR17）；两处均加注说明 canonical 对齐关系
- **状态**: ✅ 已完成

#### 修订项 #4：Story 5.3 NFR12 例外声明 + 共享文件契约补非 TTY 行为和测试断言
- **文件**: `_bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md`
- **章节**: AC #7、零侵入策略（NFR12）、共享文件处理契约
- **修改摘要**: AC #7 补 AGENTS.md appendable 例外说明；"零侵入策略"节新增 NFR12 appendable 例外声明段落；"共享文件处理契约"节补非 TTY 行为（preserve-if-exists 静默执行，explicit-conflict 返回 `AGENTS_MD_CONFLICT`）和三分支测试断言要求
- **状态**: ✅ 已完成

#### 修订项 #5：Story 5.4 InitService 流程补 AGENTS.md 已存在处理分支
- **文件**: `_bmad-output/implementation-artifacts/stories/5-4-initservice-one-click-init-cord-init.md`
- **章节**: Dev Notes / InitService 流程
- **修改摘要**: 流程步骤 6（ideAdapter.generateInstructionFile）新增 AGENTS.md 三分支处理注释（create-if-absent / preserve-if-exists / explicit-conflict），明确非 TTY 下 `AGENTS_MD_CONFLICT` 结构化错误路径
- **状态**: ✅ 已完成

#### 修订项 #6：project-context.md 零侵入规则补 AGENTS.md 例外（Rule Document Registry 同步）
- **文件**: `_bmad-output/project-context.md`
- **章节**: IDE 适配器模式（Epic 5）
- **修改摘要**: "零侵入策略"条目补充 AGENTS.md appendable 例外说明，含注释边界标记和 `AGENTS_MD_CONFLICT` 错误返回规则
- **状态**: ✅ 已完成

#### 修订项 #7：04-implementation-patterns-consistency-rules.md 追加 P18 共享文件规则（Rule Document Registry 同步）
- **文件**: `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
- **章节**: Enforcement Guidelines（新增 P18）
- **修改摘要**: 新增 P18 规则：AGENTS.md 共享文件处理规则（NFR12 appendable 例外），含三场景行为表、代码示例（追加注释边界 vs 禁止直接覆盖）、测试断言要求
- **状态**: ✅ 已完成
