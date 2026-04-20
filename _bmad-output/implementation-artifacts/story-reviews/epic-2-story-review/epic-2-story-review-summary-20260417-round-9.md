---
Epic: 2
Scope: epic
Round: 9
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

总体判断：Round 8 的两个契约补丁点已经落文，且本轮未发现新的阻塞项或中高优先级问题。Story 2.2 / Story 2.5 现在已经显式定义了 skipped/null 分支，Story 2.6 的 `currentMtimeMs` 写回映射也已经与 `LifecycleResult` 对齐。Epic 2 的核心阻塞线到本轮已全部关闭，可以进入开发。剩余问题均为非阻塞待办，主要是少量说明文字与实现细节的进一步收紧，不影响当前开发启动。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260417-round-8.md`
  - `epic-2-story-review-evaluation-20260417-round-8.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 8 修订闭合度
  - skipped/null 分支结果契约
  - warning 聚合与 ScanResult 输出边界
  - renamed/moved 的 SyncState 写回字段映射
  - Epic / Story / project-context 跨文档一致性

## 上轮问题回顾

### 已修复
1. Round 8 / Finding #1 — 异常文档“跳过”语义尚未进入 ScanPipelineResult 共享契约
   - 修复位置：Story 2.2 已明确 `pipeline.process` 返回 `ScanPipelineResult | null`，并补充了预检前移与编码错误返回 null 的 skipped 契约；Story 2.5 的步骤 4 也已显式展开预检跳过、null 跳过、非 null 才进入 classify 的三条分支。
   - 验证结果：skipped/null 分支的主契约已经闭合；本轮未再发现会阻塞开发的结果形状缺口。

2. Round 8 / Finding #2 — `LifecycleResult` 的 renamed/moved 输出字段与 SyncState 写回示例不一致
   - 修复位置：Story 2.6 步骤 11 已改为 `lastObservedMtimeMs: item.currentMtimeMs`，并明确 `item` 来自 `LifecycleResult.renamed/moved`。
   - 验证结果：字段名与写回映射现已对齐，该问题关闭。

### 仍为非阻塞待办
1. Round 5 / Finding #2 — IDE preset provider 当前 Epic 缺失
   - 维持 P2：`config.ide` 为空时当前路径仍可执行；后续若要支持非空分支，仍需补最小 provider owner 或明确 v0.1 范围说明。

2. Round 5 / Finding #5 — inbound `framework_preset` 边在 modified-only 场景下的增量刷新
   - 维持 P2：本轮未发现需要升级的新直接冲突。

3. Story 2.6 无变更快返前仍全量计算 `contentHash`
   - 继续维持 P2，不作为阻塞。

4. project-context 中 `BmadFrameworkAdapter` 仍写为“18 种文档类型、5 层检测”
   - 维持 P2：建议后续与 Epic 2 / Story 2.3 的“v0.1 仅 16 种 Markdown 类型”口径同步。

5. Story 2.2 / Story 2.5 的 skipped warning owner 与聚合路径仍可进一步收紧表述
   - 维持 P2：当前 AC、任务和主流程已经足以支撑实现，但 warning owner 如果后续补成单一通路，会让 CLI / JSON 输出语义更易审计。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- `discoverDocuments` 的接口签名与 owner 说明继续保持稳定。
- 本轮未发现 Story 2.1 的回归或新冲突。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- skipped/null 分支主契约已经补明，正常路径与异常路径的边界比上一轮清晰。
- 本轮未发现阻塞开发的类型或流程缺口。

**关注点**
- skipped warning 的 owner 与最终聚合路径仍可后续进一步收紧，但当前不影响实现启动。

### Story 2.3: BMAD 框架适配模块

**结论：通过**

**优点**
- docType 与 preset rule 的路径敏感语义保持稳定。
- 本轮未发现 Story 2.3 自身的新问题。

**关注点**
- 建议后续把 project-context 的 BMAD 类型数量摘要与 2.3 的 v0.1 范围同步。

### Story 2.4: 配置加载与文档管辖范围

**结论：有条件通过**

**优点**
- `effectiveScanPaths` owner 与时序继续保持闭合。
- `relationTypes` 产品语义未出现回退。

**关键问题**
1. **IDE preset 路径 provider / owner 仍未完全落地** — 但在 v0.1 `config.ide` 为空的默认路径下，当前仍仅构成 P2 跟踪项。

**建议动作**
- 后续补一句 v0.1 范围说明或最小 provider owner 即可，不影响当前开发。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：通过**

**优点**
- discovery 主链、两阶段事务契约、`relationTypes` 过滤和 rebuild 边界继续保持对齐。
- skipped/null 分支已被显式展开，不再需要实现者自行补全主分支形状。

**关注点**
- skipped warning 的聚合通路可以后续进一步写实，但不构成阻塞。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：通过**

**优点**
- round 7 的范围收口问题保持关闭，没有回归。
- `currentMtimeMs` 写回映射现已与 `LifecycleResult` 和 Story 1.4 契约对齐。

**关注点**
- 当前仍建议在开发阶段继续保持 v0.1 path-only 语义，不主动扩展到路径敏感关系刷新。

## 通过项

- Round 8 的两个 patch 点已全部关闭，本轮未发现新的 patch/decision_needed。
- Story 2.5 继续保持为可复用的冷启动基线。
- Story 2.6 的 rename/move 范围收缩、数据一致性说明、Epic 父级 AC 和字段映射均已收口。
- Epic 2 的核心阻塞线已全部关闭，可进入开发。
- 已知非阻塞待办：
  - IDE preset 路径 provider / owner 继续维持 P2。
  - modified-only 场景下的 inbound `framework_preset` 边刷新继续维持 P2。
  - Story 2.6 无变更快返前全量计算 `contentHash` 继续维持 P2。
  - project-context 中 BMAD 文档类型数量的 18 vs 16 口径差异建议后续同步。
  - skipped warning owner 与聚合通路建议后续写成单一路径，提升可审计性。

## 结论
- **结论**：通过
- **阻塞项**：无
- **建议**：Epic 2 可进入开发；后续仅按 P2 待办继续收紧文档说明即可。