---
Epic: 2
Scope: epic
Round: 8
Date: 2026-04-17
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

复审。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：2 个
- 有条件通过：3 个
- 硬阻塞：1 个

总体判断：Round 7 的两条 P1 已经实际关闭。Story 2.6 的无条件“结果等价 / preset 刷新”承诺已收缩到正确的 v0.1 范围，Epic 2 的父级 rename AC 也已经同步；因此 round 7 的遗留阻塞已经出清。本轮没有发现这些旧问题的回归，但在重新通读 Batch 1 和 Batch 2 时又暴露出 2 条此前未显式捕获的契约级缺口：一是 Story 2.2 与 Story 2.5 仍未定义“异常文档跳过”时的共享结果形状，二是 Story 2.6 的 `LifecycleResult.currentMtimeMs` 与步骤 11 的 `current.mtimeMs` 写回示例仍未对齐。Epic 2 因此仍不建议进入开发，但当前剩余问题已转为两个范围更小、修复成本更低的契约补丁。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260416-round-7.md`
  - `epic-2-story-review-evaluation-20260417-round-7.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 7 修订闭合度
  - 异常文档跳过与扫描结果契约
  - 冷启动与增量共享结果形状
  - renamed/moved 的 SyncState 写回字段映射
  - Epic / Story / project-context 跨文档一致性

## 上轮问题回顾

### 已修复
1. Round 7 / Finding #1 — Story 2.6 仍同时保留 v0.1 path-only 范围与未限定的结果等价承诺
   - 修复位置：Story 2.6 的数据一致性说明已经收缩为“modified/added 路径与 rebuild 等价；rename/move 在 v0.1 仅更新 `documents.path`，路径敏感的 docType 与 preset 关系同步延至 v0.2”。
   - 验证结果：round 7 的这条 P1 已关闭；本轮未发现同类全局等价承诺回归。

2. Round 7 / Finding #2 — Epic 2 的 Story 2.6 验收基线仍未同步到 v0.1 path-only 范围
   - 修复位置：Epic 2 中 Story 2.6 的 rename AC 已同步为 v0.1 仅更新路径，路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2。
   - 验证结果：Epic 与 Story 的这条父子 AC 漂移已关闭。

### 仍为非阻塞待办
1. Round 5 / Finding #2 — IDE preset provider 当前 Epic 缺失
   - 维持 P2：`config.ide` 为空时当前路径仍可执行；后续若要支持非空分支，仍需补最小 provider owner 或明确 v0.1 范围说明。

2. Round 5 / Finding #5 — inbound `framework_preset` 边在 modified-only 场景下的增量刷新
   - 维持 P2：本轮未发现需要升级的新直接冲突。

3. Story 2.6 无变更快返前仍全量计算 `contentHash`
   - 继续维持 P2，不作为本轮新的阻塞。

4. project-context 中 `BmadFrameworkAdapter` 仍写为“18 种文档类型、5 层检测”
   - 本轮视为新增 P2：建议后续与 Epic 2 / Story 2.3 的“v0.1 仅 16 种 Markdown 类型”口径同步，但暂不升级为本轮阻塞。

## 新发现

### 1. [中][新] 异常文档“跳过”语义尚未进入 ScanPipelineResult 共享契约
- **来源**：contract
- **分类**：patch
- **涉及 Story**：2-2、2-5
- **证据** - Story 2.2 的 AC 8 要求异常文档跳过并记录 WARNING（编码错误/非 Markdown/超大 > 1MB）；但 Story 2.2 中 `ScanPipelineResult` 仍被定义为必含 `document` 的结构 `{ document, relations, warnings }`。与此同时，Story 2.5 的主流程将每次 `pipeline.process` 结果直接送入 `docType classify`、`warnings` 聚合和写入计划，没有说明 skipped 分支如何表示。
- **影响** - 当前文档没有定义异常文档跳过时的结果形状。实现者无法判断 `pipeline.process` 应返回 warning-only 结果、null/union、还是抛异常再由 ScanService 捕获，容易把本应跳过的文件继续送入 classify 和写入计划，或自行发明未文档化的分支。
- **建议** - 将 2.2 与 2.5 的边界显式写成可跳过的结果契约：要么将 `pipeline.process` 定义为成功/跳过二元结果，跳过分支只返回 warnings；要么把跳过判定前移为独立预检步骤，并在 2.5 明确只有成功解析的结果才进入 `docType classify` 和写入计划。

### 2. [中][新] `LifecycleResult` 的 renamed/moved 输出字段与 SyncState 写回示例不一致
- **来源**：contract
- **分类**：patch
- **涉及 Story**：2-6
- **证据** - Story 2.6 中 `LifecycleResult.renamed/moved` 已被定义为包含 `currentMtimeMs` 的结果项；但同一文档步骤 11 的 renamed/moved `SyncState` 写回示例仍使用 `lastObservedMtimeMs: current.mtimeMs`。Story 1.4 又明确 `SyncState.lastObservedMtimeMs` 是增量扫描依赖字段，而 Story 2.6 自己也要求步骤 11 满足 Story 1.4 的全字段契约。
- **影响** - 实现者无法从现有文档判断 renamed/moved 分支究竟应直接消费 `LifecycleResult.currentMtimeMs`，还是额外维护一个 current snapshot lookup 再读取 `current.mtimeMs`。按现文案实现，需要自行猜测字段映射，容易导致 `lastObservedMtimeMs` 写错或遗漏。
- **建议** - 将 Story 2.6 步骤 11 与 `LifecycleResult` 契约对齐：要么直接写明 renamed/moved 使用 `currentMtimeMs` 写回 `lastObservedMtimeMs`；要么补充一个显式的 current snapshot lookup 契约，并统一字段名。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- `discoverDocuments` 的接口签名和 owner 说明保持稳定。
- 本轮未发现 Story 2.1 的新回归。

**关注点**
- 无。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：有条件通过**

**优点**
- `ScanPipelineResult`、`warnings` 与规则输出形状在正常路径上仍保持稳定。
- 本轮未发现此前已关闭主线问题的回归。

**关键问题**
1. **异常文档“跳过”结果形状仍未写实** — AC 要求跳过并记录 WARNING，但共享结果类型与 2.5 主流程仍把 `pipeline.process` 结果视为必含 `document` 的可写入项。

**建议动作**
- 先把 skipped 分支的结果契约补明，再进入开发。

### Story 2.3: BMAD 框架适配模块

**结论：通过**

**优点**
- docType 与 preset rule 的路径敏感语义保持稳定。
- 本轮未发现 Story 2.3 自身新的结构或契约问题。

**关注点**
- 后续建议把 project-context 的“18 种文档类型”摘要与 2.3 的 v0.1 范围同步，但这不构成本轮阻塞。

### Story 2.4: 配置加载与文档管辖范围

**结论：有条件通过**

**优点**
- `effectiveScanPaths` owner 与时序继续保持闭合。
- `relationTypes` 产品语义未出现回退。

**关键问题**
1. **IDE preset 路径 provider / owner 仍未完全落地** — 但在 v0.1 `config.ide` 为空的默认路径下，当前仍仅构成 P2 跟踪项。

**建议动作**
- 后续补一句 v0.1 范围说明或最小 provider owner 即可，不影响本轮主阻塞判断。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：有条件通过**

**优点**
- discovery 主链、两阶段事务契约、`relationTypes` 过滤和 rebuild 边界继续保持对齐。
- 仍可作为 Story 2.6 的冷启动复用基线。

**关键问题**
1. **对异常文档 skipped 分支的消费边界仍未显式定义** — 当前主流程仍把 `pipeline.process` 结果直接送入 classify、warnings 聚合和写入计划。

**建议动作**
- 和 Story 2.2 一起补明 skipped 分支的结果契约或预检步骤边界。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- round 7 的两条 P1 已关闭：数据一致性说明与 Epic 父级 AC 已同步收口。
- discovery 链路、`relationTypes` 过滤和完整 `SyncState` 写回主方向继续保持闭合。

**关键问题**
1. **renamed/moved 的字段映射示例仍未与 `LifecycleResult` 对齐** — `currentMtimeMs` 与 `current.mtimeMs` 并存，写回路径仍需实现者自行猜测。

**建议动作**
- 先统一 renamed/moved 分支的字段名与写回映射，再提交下一轮 reviewer。

## 通过项

- round 7 的两条 P1 已确认关闭，本轮未发现这些问题的回归。
- Story 2.5 继续保持为可复用的冷启动基线。
- Story 2.6 的 rename/move 范围收缩已与 Epic 父级 AC 对齐。
- 已知非阻塞待办：
  - IDE preset 路径 provider / owner 继续维持 P2。
  - modified-only 场景下的 inbound `framework_preset` 边刷新继续维持 P2。
  - Story 2.6 无变更快返前全量计算 `contentHash` 继续维持 P2。
  - project-context 中 BMAD 文档类型数量的 18 vs 16 口径差异建议后续同步，但本轮不升级为阻塞。

## 结论
- **结论**：不通过
- **阻塞项**：Story 2.2 / Story 2.5 的异常文档 skipped 分支结果契约未定义；Story 2.6 的 `LifecycleResult.currentMtimeMs` 与步骤 11 的 `current.mtimeMs` 写回示例仍未对齐
- **建议**：先补齐 2.2 -> 2.5 的 skipped 结果形状，再统一 2.6 renamed/moved 的字段映射；完成后再提交第 9 轮 reviewer。