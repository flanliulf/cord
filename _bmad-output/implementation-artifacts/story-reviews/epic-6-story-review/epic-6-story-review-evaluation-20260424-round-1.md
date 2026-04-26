---
Epic: 6
Scope: epic
Round: 1
Date: 2026-04-24
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: epic-6-story-review-summary-20260424-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

# Epic 6 Story 设计审查评估（Round 1）

## 评估总结

本轮审查共提出 6 条发现（4 高 + 2 中），全部对照 Story 6.1 / 6.2 的 AC、Tasks、Dev Notes 与父 Epic、PRD、Architecture 03/05、Epic 5 已冻结的 MCP canonical contract 进行了核验，**全部成立、无误报**。其中：Story 6.2 AC4/AC5 直接从父 Epic AC 文本里"丢字"（"输入/输出 schema"被压缩为 "schema"，"框架适配配置"整体缺失），属于硬阻塞；Story 6.1 AC3 把"集成测试指南"放进 adapter-guide 而非 architecture 05 已划定的 contributing.md，属于职责越界；两条时长类 AC（6.1 的 4h + 6.2 的 < 5 分钟）在 Story 层都没有可执行的测量协议。

整体结论：**需修订后再审**，建议优先级如发现编号顺序：3 → 6 → 1 → 5 → 2 → 4。

## 发现 #1 评估

### 审查原文

> **[高] 6.1 的最小适配教程未覆盖适配器注册与激活共享契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - Story 2.1 已固定 adapter registry、`resolveAdapter(config, projectRoot)`、`config.framework` 显式优先、`detectFramework()` 自动检测和 Generic fallback 顺序；但 Story 6.1 只要求接口 API、教程和参考实现说明，没有把这些激活条件写进验收边界。
> - 影响 - 社区贡献者即使按文档完成最小适配器，也可能产出一个无法被 InitService/ScanService 选中的实现，直接破坏 Epic 6 的"4 小时可交付"目标。
> - 建议 - 在 Story 6.1 的 AC 和 Dev Notes 中显式要求文档覆盖：`src/adapters/framework/index.ts` 注册、`resolveAdapter` 选择顺序、`config.framework` 覆盖优先级、`detectFramework()` 自动检测，以及 GenericFrameworkAdapter 最后兜底。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 6.1 AC1 仅要求"IFrameworkAdapter 接口 API 完整说明"，AC2 仅"最小适配模块开发教程"，Dev Notes 大纲也只列 接口/基类/教程/注册示例/规则示例/测试模板/PR 流程，"注册示例"模糊、未对齐 Story 2.1 的 `resolveAdapter` + `config.framework` + `detectFramework` + Generic fallback 这条激活链。
**严重性判断**：合理 — 缺少激活契约直接命中 FR37(d) "4 小时最小可用闭环"，贡献者即使写出 IFrameworkAdapter 实现也可能无法被 InitService/ScanService 选中。
**修订建议**：可行 — 都是已经在 Story 2.1 固化、可直接引用的接口与函数名，写回 AC2 和 Dev Notes 即可。
**误报评估**：非误报 — 双来源（consistency+contract）命中，可信度高。

## 发现 #2 评估

### 审查原文

> **[高] 6.1 的 4 小时交付与 NFR8 验收边界不可执行**
> - 来源：structure+contract
> - 分类：decision_needed
> - 涉及 Story：6-1
> - 证据 - Story 6.1 仅写"4 小时内完成最小可用适配模块""核心模块测试 100% 通过"；而 PRD 的 FR37(d) 已明确最小闭环至少包括文档类型注册、1 条预设规则和通过集成测试。
> - 影响 - 当前 Story 无法稳定验收，也无法判断 NFR8 的"零核心源码修改"与"测试 100% 通过"是否真被满足。
> - 建议 - 先裁定一个统一验收协议：计时从何时开始、由谁执行、最小适配模块的完成定义是什么、核心模块测试范围是什么；然后把协议写回 AC6/AC7 与对应 Tasks。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 父 Epic 6.1 AC 原文带有"含文档类型注册 + 1 条预设规则 + 通过集成测试"，Story 6.1 的 AC6 把这一括号说明丢失；AC7 的"核心模块测试"也未限定测试范围（单元/集成/全套）。
**严重性判断**：合理 — 时长类 + 通过率类 AC 缺测量协议是过往 Epic（5）反复出现的失败模式，进入 dev 后无法回归。
**修订建议**：可行 — 直接把父 Epic 括号说明回填 AC6，并在 Task 5 中写明：执行人画像、起止计时点、核心模块测试范围（建议 = `npm run test` 全套 + diff 验证 `src/core/**` 零修改）。
**误报评估**：非误报 — Story-level AC 不可执行问题客观存在。

## 发现 #3 评估

### 审查原文

> **[高] 6.2 将 MCP Tool 文档契约降级为笼统 schema，且未锁定完整 Tool 范围**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Story 6.2 AC4 只要求"每个 Tool 的 schema、场景、调用示例"；而 PRD 要求"输入/输出 schema"，Story 5.1 与 5.2 又已冻结 7 个 Tool 的命名 input/output schema、`query_relations.relationId` 和 `sync_docs` 单文档边界。
> - 影响 - 如果不把这些 canonical contract 写进 Story，最终用户文档很容易遗漏输出 DTO、关系管理 Tool 或关键字段语义，造成文档与 MCP 实际对外契约漂移。
> - 建议 - 将 AC4 收紧为"覆盖全部 7 个 MCP Tool 的命名 inputSchema、命名 outputSchema、使用场景和调用示例"，并显式点名 `relationId` 与 `sync_docs` 的单文档输入边界。

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确 — 父 Epic 6.2 AC 原文为"每个 MCP Tool 的**输入/输出 schema**"，Story 6.2 AC4 把 "输入/输出" 二字直接丢失，文字回归对比一目了然；同时未点名 7 个 Tool（5.1 的 4 个 + 5.2 的 3 个），下游文档随机覆盖 4/5 个 Tool 也能"通过 AC"。
**严重性判断**：合理偏低 — 三来源命中（结构+一致性+契约），考虑到这是对外 API 文档与 Epic 5 已冻结 canonical contract 的直接对接，建议从【高】升格为 **P0**（与跨 Epic 共享契约同级），与既往 Epic 5 教训一致：Tool DTO 漂移会击穿 NFR10/NFR11/FR31 的 CLI/MCP parity 主张。
**修订建议**：可行 — AC4 收紧 + Dev Notes 列 7 个 Tool 名称清单 + References 锚定 5-1/5-2 Story 文件即可。
**误报评估**：非误报 — 三来源交叉命中，且文本"丢字"可直接在 Story 与 Epic AC 之间 diff 验证。

## 发现 #4 评估

### 审查原文

> **[高] 6.2 的"< 5 分钟阅读"缺少唯一 happy path 与测量口径**
> - 来源：structure+contract
> - 分类：decision_needed
> - 涉及 Story：6-2
> - 证据 - Story 6.2 AC2 只写 getting-started 文档应支持"< 5 分钟阅读"，但没有定义前置环境、唯一流程、计时起止点，也没有验证任务。
> - 影响 - 这个 AC 目前不可验证，也无法在后续文档膨胀时做回归检查。
> - 建议 - 先裁定唯一的首次上手路径与计时规则，再把它落实为 AC2 和一个明确的试读 / dry-run 任务。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — Story 与 Epic 同级地都缺少测量协议，是一个真实的"不可执行 AC"问题。
**严重性判断**：偏高 — 与发现 #2 同类问题，但由于 getting-started 是用户读文档的"软指标"，可以通过字数 / 字段数等代理指标做粗测；不像 4h 适配那样需要协议级锁定才能进 dev。建议从【高】降为 **P2** 纳入后续改善（在 Task 2 加一条"字数/小节数预算"即可基本闭合）。
**修订建议**：可行但非必要 — 严格的"试读 dry-run 任务"对独立贡献者文档体验是合理要求，但可作为 Epic 6 收尾时的体验回归而非进开发的硬门禁。
**误报评估**：非误报 — 只是优先级偏高。

## 发现 #5 评估

### 审查原文

> **[中] 6.1 的文档职责分工与架构基线冲突**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - Story 6.1 AC3/AC4 与 Dev Notes 把集成测试指南、测试模板、PR 流程混在 adapter-guide 语义内；而 architecture 05 已把 `adapter-guide.md` 定义为接口 API + 最小适配教程，把 `contributing.md` 定义为 PR 规范 + 审阅流程 + 集成测试指南。
> - 影响 - 两份文档的边界不清会导致实现时内容重复、遗漏，且最终产物可能与既定 docs 目录职责不一致。
> - 建议 - 明确 adapter-guide 与 contributing 的职责分界；若沿用当前架构约定，应把集成测试指南与 PR 流程入口写回 contributing.md 的 AC / Dev Notes。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — architecture 05 第 199-200 行明文：`adapter-guide.md` = 接口 API + 最小适配教程；`contributing.md` = PR 规范 + 审阅流程 + **集成测试指南**。Story 6.1 AC3 + Task 1 把"集成测试编写指南（含测试模板）"放在 Task 1 (AC: #1, #2, #3) 的 adapter-guide.md 范围内，同时 Task 4 又有"创建集成测试模板 (AC: #3)"，存在双重归属与归属错位。
**严重性判断**：合理 — 中级问题但属于架构基线一致性偏离，进 dev 前必须裁定，否则文档结构出现重复/遗漏。
**修订建议**：可行 — 将 AC3 / Task 4 归属重写到 contributing.md（AC4 域），adapter-guide 仅保留 AC1/AC2；Dev Notes 大纲第 6 项"集成测试模板和编写指南"和第 7 项"提交 PR 流程"移到 contributing.md 章节。
**误报评估**：非误报 — 与架构 05 文本可逐行 diff。

## 发现 #6 评估

### 审查原文

> **[中] 6.2 的 configuration 文档范围漏掉框架适配配置与双格式边界**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Story 6.2 AC5 只保留"cord.config 配置项 + IDE 配置模板"；但 PRD 明确要求再加"框架适配配置"，architecture 03 还要求说明 YAML/JSON 双格式、加载优先级和 JSON Schema。
> - 影响 - configuration 文档可能只覆盖用户常规配置，忽略适配器启用、扫描边界与配置格式规则，削弱 Epic 2 与 Epic 6 的衔接。
> - 建议 - 把 AC5 和 Task 5 扩展为：配置项说明 + IDE 配置模板 + 框架适配配置 + 双格式与 Schema 规则，并在 Dev Notes 补充来源锚点。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 父 Epic 6.2 AC 原文为"`docs/configuration.md` 包含 cord.config 配置项说明、IDE 配置文件模板、**框架适配配置**"，Story 6.2 AC5 把"框架适配配置"整段丢失；架构 03 关于 YAML/JSON 双格式 + JSON Schema 的部分则是补强项，未在父 Epic AC 中点名，但属于 Story 5 教训中"`cord init` 默认 YAML + `--format json`"的下游文档落点。
**严重性判断**：合理 — 与发现 #3 同类（Story 从父 Epic AC 丢字），保持 P1。
**修订建议**：可行 — AC5 + Task 5 + Dev Notes 锚点同步扩展即可。
**误报评估**：非误报 — 双来源命中，文本可 diff。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 3 | 6.2 MCP Tool 文档契约降级、未锁定 7 Tool 范围 | [高] | P0 | 父 Epic AC 丢字 + 跨 Epic canonical contract |
| 1 | 6.1 教程未覆盖适配器注册与激活契约 | [高] | P1 | FR37(d) 4h 闭环依赖此项 |
| 2 | 6.1 4h / NFR8 验收协议不完整 | [高] | P1 | Story-level AC 不可执行 |
| 5 | 6.1 adapter-guide vs contributing 职责越界 | [中] | P1 | 与 architecture 05 直接冲突 |
| 6 | 6.2 configuration 漏框架适配配置与双格式 | [中] | P1 | 父 Epic AC 丢字 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 4 | 6.2 < 5 分钟阅读缺测量口径 | [高] | P2 | 字数/小节预算可代理；体验回归 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | — | — | 无误报 |

### 评估决定

**整体结论**：需修订后再审

建议下一步：先修订 Story 6.2（P0 发现 #3 + P1 发现 #6），再修订 Story 6.1（P1 发现 #1/#2/#5），同步把发现 #4 登记为 Epic 6 收尾期的体验回归项；修订完成后跑 SR Round 2 回归即可。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-24
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 5

#### 修订项 #1: 6.2 MCP Tool 文档契约降级、未锁定 7 Tool 范围（发现 #3，P0）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-user-docs-and-readme.md`
- **章节**: Acceptance Criteria AC4
- **修改摘要**: 将 AC4 从"每个 Tool 的 schema、场景、调用示例"收紧为"覆盖全部 7 个 MCP Tool 的命名 inputSchema、命名 outputSchema、使用场景和调用示例（`query_relations` 含 `relationId` 参数语义，`sync_docs` 含单文档输入边界）"；同步更新 Task 4 描述，Dev Notes 新增"MCP Tool 清单"小节列出 Story 5.1 的 4 个和 Story 5.2 的 3 个 Tool；References 补充 Story 5-1、Story 5-2 锚点
- **状态**: 已完成

#### 修订项 #2: 6.2 configuration 漏框架适配配置与双格式（发现 #6，P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-user-docs-and-readme.md`
- **章节**: Acceptance Criteria AC5、Tasks Task 5、Dev Notes
- **修改摘要**: AC5 从"cord.config 配置项 + IDE 配置模板"扩展为"包含 cord.config 配置项说明 + IDE 配置文件模板 + 框架适配配置 + YAML/JSON 双格式与 JSON Schema 规则"；Task 5 描述同步扩展；Dev Notes 新增"配置文档说明（configuration.md 覆盖范围）"小节；References 补充 architecture 03 锚点
- **状态**: 已完成

#### 修订项 #3: 6.1 教程未覆盖适配器注册与激活契约（发现 #1，P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-1-framework-adapter-contributor-docs.md`
- **章节**: Acceptance Criteria AC2、Dev Notes adapter-guide.md 内容大纲
- **修改摘要**: AC2 从"包含最小适配模块开发教程（含代码示例）"扩展为显式覆盖激活链（注册位置、`resolveAdapter` 选择顺序、`config.framework` 覆盖优先级、`detectFramework()` 自动检测、GenericFrameworkAdapter 兜底）；Dev Notes 大纲第 3 项同步扩展，列出激活链 5 个要点
- **状态**: 已完成

#### 修订项 #4: 6.1 4h / NFR8 验收协议不完整（发现 #2，P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-1-framework-adapter-contributor-docs.md`
- **章节**: Acceptance Criteria AC6、AC7、Tasks Task 5
- **修改摘要**: AC6 回填父 Epic 括号说明"含文档类型注册 + 1 条预设规则 + 通过集成测试（FR37 验收标准 d）"；AC7 从"核心模块测试 100% 通过"限定为"`npm run test` 全套测试且 diff 验证 `src/core/**` 零修改"；Task 5 补全执行人画像（非核心贡献者）、计时起止点（从阅读 adapter-guide.md 至集成测试全通过）和测试命令
- **状态**: 已完成

#### 修订项 #5: 6.1 adapter-guide vs contributing 职责越界（发现 #5，P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-1-framework-adapter-contributor-docs.md`
- **章节**: Acceptance Criteria AC3、Tasks Task 1/2/4、Dev Notes
- **修改摘要**: AC3 目标文件从隐含的 adapter-guide.md 明确改写为"`docs/contributing.md` 包含集成测试编写指南（含测试模板）"，对齐 architecture 05 第 199-200 行约定；Task 1 AC 范围从 #1/#2/#3 缩减为 #1/#2（adapter-guide 仅含接口 API + 最小适配教程）；Task 2 AC 范围从 #4 扩展为 #3/#4（contributing 承接集成测试指南 + PR 规范）；Task 4 描述改为"在 contributing.md 中创建集成测试模板章节"；Dev Notes 将原 7 项单一大纲拆分为"adapter-guide.md 内容大纲"和"contributing.md 内容大纲"两个独立节
- **状态**: 已完成
