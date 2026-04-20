---
Epic: 2
Scope: epic
Round: 10
Date: 2026-04-17
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

复审。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：5 个
- 有条件通过：1 个
- 硬阻塞：0 个

总体判断：Round 9 evaluation 中登记的 5 条 P2 收紧修订，本轮已确认其中 4 条真正闭合：Story 2.6 的 inbound `framework_preset` 约束、`contentHash` 性能说明、project-context 的 18 vs 16 口径同步，以及 Story 2.5 的 `allWarnings[]` 聚合通路都已落文且未引入新的跨文档冲突。唯一未真正闭合的是 Story 2.4 的 IDE 范围问题：v0.1 说明只写进了 Dev Notes，AC、Tasks 和 Epic 父级验收口径仍把 IDE 预设支持视为当前 Epic 的交付范围。Epic 2 因此还不建议进入开发，但剩余问题已收敛为一条范围同步补丁。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260417-round-9.md`
  - `epic-2-story-review-evaluation-20260417-round-9.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 9 修订闭合度
  - IDE preset / `config.ide` 的 v0.1 范围边界
  - skipped warnings 的聚合与输出边界
  - 增量扫描对冷启动链路的复用一致性
  - Epic / Story / project-context 跨文档口径同步

## 上轮问题回顾

### 已修复
1. Round 9 修订项 — `project-context` 的 BMAD 18 vs 16 口径差异
   - 修复位置：`project-context.md` 已改为“18 种总类型，v0.1 仅实现 Markdown 16 种，YAML 2 种延至 v0.2；详见 Story 2.3”。
   - 验证结果：现已与 Story 2.3 和 Epic 2 的 v0.1 范围一致，该问题关闭。

2. Round 9 修订项 — Story 2.5 skipped warnings 的聚合通路
   - 修复位置：Story 2.5 步骤 4 的预检跳过与编码错误跳过均已改为追加到 `allWarnings[]`，步骤 7b 明确将 `allResults.flatMap(r => r.warnings)` 合并到同一数组，步骤 9 返回 `ScanResult.warnings: allWarnings`。
   - 验证结果：冷启动主流程的 warnings 单一路径已闭合，本轮未发现新的契约级回退。

3. Round 9 修订项 — Story 2.6 inbound `framework_preset` 边约束
   - 修复位置：Story 2.6 架构约束已明确 v0.1 增量扫描仅刷新 modified/added 文档的 outgoing 关系边；docType 变化导致的 preset 偏差通过 `cord scan --rebuild` 修复。
   - 验证结果：该说明已与 v0.1 path-only 边界保持一致，本轮不再构成问题。

4. Round 9 修订项 — Story 2.6 无变更快返前全量计算 `contentHash` 的性能说明
   - 修复位置：Story 2.6 已补充 v0.1 性能说明，明确当前先完整计算 `contentHash`，懒计算优化延至 v0.2。
   - 验证结果：该说明与 PRD 的 NFR6 条件口径可共存，本轮不升级为新的性能契约冲突。

5. Round 8 / Round 9 已关闭项 — `currentMtimeMs` 写回映射
   - 修复位置：Story 2.6 步骤 11 持续保持 `lastObservedMtimeMs: item.currentMtimeMs`，并明确 `item` 来源于 `LifecycleResult.renamed/moved`。
   - 验证结果：字段映射继续保持闭合，无回归。

### 仍未真正关闭
1. Round 5 / Finding #2 — IDE preset provider 当前 Epic 缺失
   - 当前状态：Story 2.4 已在 Dev Notes 中补充“IDE adapter 属 Epic 5、v0.1 默认跳过”的说明，但 AC、Tasks 和 Epic 父级 Story 2.4 验收口径尚未同步，因此该问题不再适合作为纯 P2 观察，升级为本轮 patch。

## 新发现

### 1. [中][新] Story 2.4 的 IDE 预设 v0.1 范围只写进 Dev Notes，AC 与任务仍把 IDE 预设视为当前交付
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：2-4
- **证据** - Story 2.4 的 effectiveScanPaths 规则 #3 已新增说明：`config.ide` 已配置时理论上通过 IDE adapter 追加路径，但 v0.1 中 IDE adapter 属 Epic 5，`config.ide` 默认为空，因此默认路径始终跳过。与此同时，同一文件的 AC 5/7 仍无条件要求系统管辖 AI IDE 指令规范文档，并支持已支持框架和 IDE 的预设文档路径；Task 3 也仍是“框架/IDE 预设路径集成”。Epic 2 父级 Story 2.4 的验收标准保持相同口径，未同步这条 v0.1 范围说明。
- **影响** - 默认分支的说明性歧义虽已缩小，但 `config.ide` 非空时在 v0.1 到底应忽略、报错还是实际接入 IDE provider 仍无统一验收口径。开发者可能因此过度实现 Epic 5 能力，或测试者按当前 AC 把未实现的 IDE provider 误判为缺失交付。
- **建议** - 将 Story 2.4 的 AC 5/7、Task 3，以及 Epic 2 父级 Story 2.4 的验收标准统一收口到同一 v0.1 语义：要么明确“`ide` 只是 schema 预留字段，非空分支延至 Epic 5，不属于本 Story 验收范围”；要么明确“非空 `config.ide` 在 v0.1 的处理策略（忽略/报错/空 provider）”，三处文档必须保持一致。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- `discoverDocuments` 的接口签名和 owner 说明保持稳定。
- 本轮未发现新的结构或契约回退。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- skipped/null 分支仍通过 Story 2.5 的主流程消费边界保持可实现。
- 本轮未发现新的共享类型或规则引擎契约冲突。

**关注点**
- 编码错误 warning 的 owner 表述仍偏简写，但当前已不足以单独构成 patch。

### Story 2.3: BMAD 框架适配模块

**结论：通过**

**优点**
- 16 种 v0.1 Markdown 类型与 project-context 摘要现已对齐。
- 本轮未发现新的路径敏感语义冲突。

### Story 2.4: 配置加载与文档管辖范围

**结论：有条件通过**

**优点**
- `effectiveScanPaths` 的 owner 与时序继续保持闭合。
- 默认分支下的 v0.1 IDE 范围说明已经写明，较上一轮更清晰。

**关键问题**
1. **IDE preset 的 v0.1 验收口径仍未同步到 AC、Tasks 和父级 Epic** — 说明只落在 Dev Notes，当前 Story 的验收边界仍不稳定。

**建议动作**
- 先统一 Story 2.4 与 Epic 2 对 `config.ide` / IDE preset 的 v0.1 范围表述，再进入开发。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：通过**

**优点**
- `allWarnings[]` 汇总通路已在主流程层闭合。
- discovery 主链、两阶段事务契约、`relationTypes` 过滤和 rebuild 边界保持稳定。

**关注点**
- warnings 在实现骨架层仍以简写表达，但当前不影响主契约闭合。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：通过**

**优点**
- inbound `framework_preset` 约束、`contentHash` 性能说明和 `currentMtimeMs` 写回映射都已落文。
- 本轮未发现新的增量/冷启动链路冲突。

**关注点**
- 当前仍应继续按“复用 Story 2.5 完整构建子链路”的口径实现，避免在开发中自行扩展 rename/move 的 v0.2 语义。

## 通过项

- Round 9 evaluation 登记的 5 条修订中，除 Story 2.4 的 IDE 范围同步外，其余均已验证关闭。
- `project-context.md` 与 Story 2.3 的 BMAD 类型范围已经同步。
- Story 2.5 的 skipped warnings 已形成单一 `allWarnings[]` 汇总路径，并返回到 `ScanResult.warnings`。
- Story 2.6 的 modified/added、rename/move 和 SyncState 写回边界继续保持闭合。
- 本轮未保留新的 defer 项。

## 结论
- **结论**：不通过
- **阻塞项**：Story 2.4 与 Epic 2 父级 Story 2.4 对 IDE preset / `config.ide` 的 v0.1 验收范围尚未同步
- **建议**：先统一 Story 2.4 的 AC / Tasks 与 Epic 2 父级验收口径，再提交第 11 轮 reviewer。