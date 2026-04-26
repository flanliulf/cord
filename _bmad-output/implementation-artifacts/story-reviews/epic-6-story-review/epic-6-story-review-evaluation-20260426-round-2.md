---
Epic: 6
Scope: epic
Round: 2
Date: 2026-04-26
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-6-story-review-summary-20260426-round-2.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 6 Story 设计审查评估（Round 2）

## 评估总结

本轮审查共提出 3 条新发现（2 高 + 1 中），全部对照 Story 5.1 / 5.2 canonical contract、architecture 05 结构边界和 Story 6.1 / 6.2 当前文本进行了核验，**全部成立、无误报**。Round 1 的 6 条发现中，3 条已经在 Story 文本中确认完全闭合，2 条仍有契约残留被本轮复审重新捕获并细化为 Round 2 的发现 #1 与 #3，1 条按上轮评估结论维持非阻塞。

整体结论：**需修订后再审**，建议优先级如发现编号顺序：1 → 2 → 3。

## 上轮问题回顾确认

### Round 1 / Finding #1（6.1 适配器激活契约）：✅ 已确认修复

Story 6.1 AC2 已显式列出 `src/adapters/framework/index.ts` 注册位置、`resolveAdapter(config, projectRoot)` 选择顺序、`config.framework` 覆盖优先级、`detectFramework()` 自动检测，以及 GenericFrameworkAdapter 兜底；Dev Notes 教程大纲第 3 项同步覆盖。修复完整，与 Story 2.1 共享契约对齐。

### Round 1 / Finding #2（6.1 4h / NFR8 验收边界）：⚠️ 未完全修复

AC6 已补回"含文档类型注册 + 1 条预设规则 + 通过集成测试"父 Epic 完整闭环；Task 5 已加入计时起止点与执行人画像。但 AC7 引入"`src/core/**` 零修改"作为 NFR8 校验锚点，与项目真实结构不符 → 被 Round 2 升级为发现 #3。

### Round 1 / Finding #3（6.2 MCP Tool 文档契约降级）：⚠️ 未完全修复

AC4 已收紧到"覆盖全部 7 个 MCP Tool 的命名 inputSchema、命名 outputSchema、使用场景和调用示例"；Task 4 同步细化。但 Dev Notes 的 Tool 清单仍把 `scan_docs` / `get_status` 错误归入 Story 5.1，把 `sync_docs` 错误归入 Story 5.2，且 `relationId` 被错误标记为 `query_relations` 输入参数 → 被 Round 2 拆为发现 #1（roster 漂移）和 #2（`relationId` 输入/输出语义反转）。

### Round 1 / Finding #5（6.1 文档职责越界）：✅ 已确认修复

AC3 已改为"`docs/contributing.md` 包含集成测试编写指南"，AC4 保留 PR 规范与审阅流程；Task 1 限定 (AC: #1, #2)、Task 2 / Task 4 全部归属 contributing.md；Dev Notes 拆分为 adapter-guide 与 contributing 两个独立大纲。与 architecture 05 第 199-200 行职责边界完全对齐。

### Round 1 / Finding #6（6.2 configuration 范围缺口）：✅ 已确认修复

AC5 已扩展为"cord.config 配置项说明 + IDE 配置文件模板 + 框架适配配置 + YAML/JSON 双格式与 JSON Schema 规则"；Task 5 同步细化；Dev Notes 新增"配置文档说明"章节；References 新增 architecture 03 锚点。

### 历史非阻塞待办

Round 1 / Finding #4（`< 5 分钟阅读` 缺测量口径）：保持 P2 非阻塞，按上轮评估结论作为 Epic 6 收尾期体验回归项处理。Round 2 未发现进一步恶化，结论维持。

## 发现 #1 评估

### 审查原文

> **[高]【遗留】6.2 的 7 个 MCP Tool 清单与来源归属仍与 Epic 5 canonical contract 不一致**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Story 6.2 的 Dev Notes 仍将 Story 5.1 写成 `scan_docs`、`query_relations`、`analyze_impact`、`get_status`，将 Story 5.2 写成 `add_relation`、`remove_relation`、`sync_docs`；References 又把 `sync_docs` 单文档边界挂到 Story 5.2。基准文件 5-1 固定的是 `analyze_impact`、`query_relations`、`init_graph`、`sync_docs`，5-2 固定的是 `add_relation`、`remove_relation`、`deprecate_relation`。
> - 影响 - Task 4 虽然表面承接了 AC4，但实施者仍会按错误清单撰写 `mcp-tools-reference.md`，导致用户文档继续偏离真实 canonical contract。
> - 建议 - 将 Dev Notes 与 References 统一回写为唯一正确的 7 Tool 清单：Story 5.1 = `analyze_impact`、`query_relations`、`init_graph`、`sync_docs`；Story 5.2 = `add_relation`、`remove_relation`、`deprecate_relation`；`sync_docs` 单文档边界只引用 Story 5.1。

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确 — 已逐字交叉核验。Story 5.1 第 14、48 行明文 "4 个 Tools：analyze_impact、query_relations、init_graph、sync_docs"，且第 86 行有专门 "sync_docs Tool 契约" 章节、第 171 行有 sync_docs 输出 DTO；Story 5.2 第 13 行明文 "add_relation、remove_relation、deprecate_relation"。Story 6.2 Dev Notes 把 `scan_docs` / `get_status` 凭空写入 5.1，把 `sync_docs` 错挂到 5.2，把 `init_graph` / `deprecate_relation` 完全遗漏。这是 Round 1 Finding #3 修复时只动了 AC4 文本但未同步刷新 Dev Notes 清单导致的契约残留。
**严重性判断**：合理 — 三来源命中（结构+一致性+契约），且属于跨 Epic canonical contract 漂移。即使 AC4 文字正确，Dev Notes 是开发者直接照抄的 Tool 清单源，错误清单会直接传导到 `mcp-tools-reference.md` 实际产出。
**修订建议**：可行 — 直接用 Story 5.1 / 5.2 既有冻结清单回写 Dev Notes "MCP Tool 清单" 段；References 中 `sync_docs` 单文档边界锚点从 5.2 改回 5.1。
**误报评估**：非误报 — 与既有 Story 5.1 / 5.2 文本可逐行 diff，证据强。

## 发现 #2 评估

### 审查原文

> **[高]【新】6.2 把 `relationId` 误写为 `query_relations` 的输入参数语义**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Story 6.2 的 AC4 与 MCP Tool 清单都写成"`query_relations` 含 `relationId` 参数语义"或"inputSchema（含 `relationId` 参数语义）"。但 5-1 明确 `relationId` 位于 `query_relations` 的输出 DTO，5-2 才将 `relationId` 作为 `remove_relation` 与 `deprecate_relation` 的输入句柄。
> - 影响 - 文档实现阶段可能会把一个不存在的输入字段写进 `query_relations` 的 schema 说明，直接破坏输入/输出契约边界。
> - 建议 - 将 `relationId` 的说明从 `query_relations` 输入语义移到其 outputSchema 或返回结果说明，并注明它是后续 `remove_relation` / `deprecate_relation` 的消费字段。

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 5.1 第 150 行注释明文 "query_relations — 输出 DTO（含 relationId，供 remove/deprecate 操作使用）"，第 153 行 schema 中 `relationId: z.string()` 位于 outputSchema；Story 5.2 第 18 行 AC6 明文 "`remove_relation` 和 `deprecate_relation` 接收 `{ relationId }`"，第 58、63 行 schema 中 `relationId` 位于这两个 Tool 的 inputSchema。Story 6.2 AC4 与 Dev Notes 把 `relationId` 写为 `query_relations` 的"参数"（输入），输入/输出方向完全反转。
**严重性判断**：合理 — 这是两个 Tool 之间的契约衔接核心字段（writes-strong + reads-weak handle），方向写反会直接导致 `mcp-tools-reference.md` 教用户传递一个不存在的输入字段，触发 MCP runtime 校验失败。属于 P0 级 canonical contract 错误。
**修订建议**：可行 — AC4 括号说明改写为"`query_relations` 的 outputSchema 含 `relationId`，作为 `remove_relation` / `deprecate_relation` 的输入句柄"；Dev Notes 同步更正 `query_relations` 行的标注位置。
**误报评估**：非误报 — 与 5.1 / 5.2 schema 定义可直接 diff。

## 发现 #3 评估

### 审查原文

> **[中]【遗留】6.1 的 NFR8 零变更校验仍锚定到不存在的 `src/core/**`**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - Story 6.1 的 AC7 和 Task 5 新增"diff 验证 `src/core/**` 零修改"。但 architecture 05 与 project-context.md 的正式结构边界为 `src/scanner/`、`src/services/query-service.ts`、`src/services/impact-service.ts` 等，不存在统一的 `src/core` 目录。
> - 影响 - 当前验证动作无法准确覆盖 PRD NFR8 所指的真实核心模块，可能在"检查通过"的情况下仍遗漏对核心代码的改动。
> - 建议 - 将 NFR8 的零变更校验锚点改为真实结构边界，例如 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts`，或直接使用"scanner/query/impact 核心模块源码零修改"的统一表述，并让 AC7 与 Task 5 完全一致。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — architecture 05 第 8-11 行将核心源码边界明确划分为 `src/scanner/` + `src/adapters/framework/`、`src/services/query-service.ts`、`src/services/impact-service.ts`、`src/services/relation-service.ts`、`src/repositories/` + `src/services/export-service.ts`，第 60-61 行项目结构树中也是 `src/services/` 直接挂载具体 service 文件，不存在 `src/core/` 目录。Story 6.1 AC7 与 Task 5 的 `src/core/**` glob 在真实仓库中匹配空集，diff 验证恒为 0 修改，校验完全失效。
**严重性判断**：合理 — 这是一个会"假阳性通过"的验证动作，比直接缺验证更危险（开发者会以为已校验）。但属于 Story 内部锚点错误、不涉及跨 Epic 契约漂移，定为 P1 而非 P0 是合适的。
**修订建议**：可行 — 直接采用审查给出的"`src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts`"路径列表，或简化为 "scanner/query/impact 核心模块源码零修改"统一表述；AC7 与 Task 5 同步刷新。
**误报评估**：非误报 — 与 architecture 05 / project-context.md 结构定义可直接 diff。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 6.2 Tool roster + 来源归属仍漂移 | [高] | P0 | 跨 Epic canonical contract，AC 修了 Dev Notes 没刷新 |
| 2 | 6.2 `relationId` 输入/输出语义反转 | [高] | P0 | 两 Tool 衔接核心字段方向写反 |
| 3 | 6.1 NFR8 校验锚点 `src/core/**` 不存在 | [中] | P1 | 假阳性通过的失效校验 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| — | — | — | — | 本轮无新增非阻塞项；Round 1 / Finding #4 维持已有 P2 待办 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | — | — | 无误报 |

### 评估决定

**整体结论**：需修订后再审

建议下一步：先一次性修订 Story 6.2 的发现 #1 + #2（同改 Dev Notes / References / AC4 括号），再修订 Story 6.1 的发现 #3（AC7 + Task 5），随后跑 SR Round 3 复审；预计 Round 3 可收敛至通过。
