---
Story: 4-2
Round: 2
Date: 2026-05-15
Model Used: GPT-5 Codex (codex)
Review Source: 4-2-code-review-summary-20260515-round-2.md
Review Model: GPT-5 Codex (codex)
Type: Code Review Evaluation
---

## 评估总结

对 Story 4-2 的第 2 轮 CR 代码审查结果（复审）进行评估。本轮 reviewer 结论为第 1 轮两个 P1 阻塞项均已修复，未发现新的阻塞项或中高优先级问题，建议通过。经独立代码验证和定向回归测试复核，评估同意该通过结论。

---

## 上轮问题回顾确认

### Round 1 / Finding #1：deprecated 保护只覆盖 source='manual'，无法保护用户手动 deprecated 的 auto_scan/framework_preset 关系：已修复

代码验证确认修复有效。`RelationService.deprecateRelation()` 在真实手动 deprecated 路径中已将关系更新为 `source: 'manual'` 与 `status: 'deprecated'`，并保留 metadata history，见 `src/services/relation-service.ts:69-84`。history 中同时记录 `previousSource`、`nextSource`、`previousStatus` 与 `nextStatus`，见 `src/services/relation-service.ts:151-166`。

该设计可以接入现有增量扫描保护路径：source 文档变更时，扫描删除 outgoing 边会通过 `excludeSources: ['manual']` 保留 manual 关系，见 `src/services/scan-service.ts:175-177`；写入阶段也会在 manual 关系快照命中且现有关系为 manual 时跳过覆盖，见 `src/services/scan-service.ts:557-579`。因此，用户通过 `RelationService.deprecateRelation()` 手动 deprecated 的自动来源关系会转入 manual 保护集合，不会在后续增量扫描中恢复为 active。

测试覆盖已补齐真实路径。单元测试确认 auto_scan 关系经 `deprecateRelation()` 后切换为 manual deprecated 并追加 history，见 `tests/unit/services/relation-service.test.ts:285-315`；增量扫描回归测试确认经 `RelationService.deprecateRelation()` deprecated 后，再次扫描仍只保留一条 manual deprecated 关系，见 `tests/unit/services/scan-service.test.ts:748-800`。

### Round 1 / Finding #2：同批次去重仍按 confidence 选择关系，framework_preset 可能输给 auto_scan：已修复

代码验证确认修复有效。`dedupeRelations()` 仍在扫描持久化前合并 `batch.scanRelations` 与 `presetRelations`，见 `src/services/scan-service.ts:124-128`；但候选替换逻辑已改为调用 `shouldReplaceDedupeCandidate()`，见 `src/services/scan-service.ts:524-554`。该函数先比较 `getRelationSourcePriority()`，仅同来源时再比较 confidence；来源优先级明确定义为 `manual=3`、`framework_preset=2`、`auto_scan=1`，见 `src/services/scan-service.ts:810-818`。

这意味着同一批次内即使 auto_scan confidence 更高，framework_preset 也不会在进入持久化优先级逻辑前被去重阶段丢弃，符合 Story AC3 的“手动修正 > 框架预设 > 自动扫描发现”要求，见 `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md:13-15`。

测试覆盖已补齐同批次冲突场景。`tests/unit/services/scan-service.test.ts:850-875` 构造更高 confidence 的 auto_scan 与 framework_preset 同批冲突，断言最终保留 `framework_preset`；`tests/unit/services/scan-service.test.ts:802-848` 继续覆盖已有 auto_scan 被 framework_preset 替换的路径。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| 无 | 无 | 无 | 第 2 轮 reviewer 未列出非阻塞待办，评估未发现需要新增 CR TODO 的事项。 |

---

## 本轮发现评估

本轮 reviewer 未提出新的 Findings。评估复核第 2 轮审查结论、上轮两个 P1 修复点、相关测试覆盖和定向回归结果后，未发现新的阻塞项、中高优先级问题或误报需要处理。

---

## 整体评估结论

### 需要修复（阻塞交付）

无。

### 建议纳入 CR TODO 跟踪（非阻塞）

无。

### 可忽略（误报）

无。

### 验证记录

- `npm test -- --run tests/unit/services/relation-service.test.ts tests/integration/relation-service.test.ts tests/unit/services/scan-service.test.ts tests/unit/cli/commands/scan.test.ts` 通过：4 个测试文件、30 条测试全部通过。

### 评估决定

- **Round 1 / Finding #1（deprecated 保护只覆盖 source='manual'）**：确认已修复。真实 `RelationService.deprecateRelation()` 路径已将人工 deprecated 关系纳入 manual 保护集合，相关单元和增量扫描回归测试已覆盖。
- **Round 1 / Finding #2（同批次去重仍按 confidence 选择关系）**：确认已修复。`dedupeRelations()` 已按来源优先级优先、同来源再按 confidence 的规则选择候选，相关同批次冲突测试已覆盖。
- **本轮新发现**：无。
- **整体决定**：第 2 轮 CR evaluation 通过。同意 reviewer 的通过结论；当前无应修复项，建议进入 CR finalizer / Story 收尾流程。
