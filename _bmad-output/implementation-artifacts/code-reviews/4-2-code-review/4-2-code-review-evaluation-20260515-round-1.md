---
Story: 4-2
Round: 1
Date: 2026-05-15
Model Used: GPT-5 Codex (codex)
Review Source: 4-2-code-review-summary-20260515-round-1.md
Review Model: GPT-5 Codex (codex)
Type: Code Review Evaluation
---

## 评估总结

对 Story 4-2 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 2 个高严重级别 patch 发现，分别对应 AC2 deprecated 保护范围不足、AC3 来源优先级在同批次去重阶段失效。经独立代码验证，两个发现均确认有效，均阻塞交付。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] deprecated 保护只覆盖 source='manual'，无法保护用户手动 deprecated 的 auto_scan/framework_preset 关系**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证支持该发现。Story AC2 明确要求“手动标记为 deprecated（status='deprecated'）的关系不被自动恢复”，见 `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md:13-15`。当前 `RelationService.deprecateRelation()` 只更新 `status: 'deprecated'` 和 metadata history，没有把原关系 `source` 改为 `manual`，见 `src/services/relation-service.ts:67-81`；history 只记录 status 变更，见 `src/services/relation-service.ts:148-161`。

与此不匹配的是，`ScanService` 的保护快照只收集 `source === 'manual'` 的关系，见 `src/services/scan-service.ts:543-548`；增量扫描删除 source 文档 outgoing 边时也只排除 `manual` 来源，见 `src/services/scan-service.ts:175-177`。因此，如果用户通过 `deprecateRelation()` 将既有 `auto_scan` 或 `framework_preset` 关系标记为 deprecated，该关系仍会在 source 文档变更时被删除，之后扫描写入路径又以 `status: 'active'` 写入新关系，见 `src/services/scan-service.ts:221-229`。

现有测试只直接构造 `source: 'manual', status: 'deprecated'` 的关系，见 `tests/unit/services/scan-service.test.ts:700-707` 和 `tests/unit/services/scan-service.test.ts:720-725`，未覆盖真实的 `RelationService.deprecateRelation()` 对自动来源关系产生的状态。

**严重性判断：合理**

该问题直接违反 AC2，且会把用户明确废弃的关系恢复为 active，属于核心数据收敛与数据完整性风险。原始严重性标为“高”合理，评估后定为 P1 阻塞交付。

**修复建议：可行**

审查建议可行。修复需要让“用户手动 deprecated”在扫描删除与写入优先级中可识别，不能只依赖 `source === 'manual'`。可选方向包括在 `RelationService.deprecateRelation()` 的 metadata/history 中保留可判定的人工操作语义，并在 `ScanService` 删除/写入路径识别 `status === 'deprecated'` 且具备 deprecated history 的关系；或调整业务契约使手动 deprecated 关系进入统一保护集合。还需要补充真实路径回归测试：扫描生成自动关系，再通过 `RelationService.deprecateRelation()` deprecated，随后增量扫描断言不恢复为 active。

**误报评估：非误报**

不是误报。多来源审查命中，且源码路径、Story AC 与测试覆盖缺口一致。

---

## 发现 #2 评估

### 审查原文

> **[高] 同批次去重仍按 confidence 选择关系，framework_preset 可能输给 auto_scan**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证支持该发现。Story AC3 要求冲突优先级为“手动修正 > 框架预设 > 自动扫描发现”，见 `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md:13-15`；Dev Notes 也要求写入阶段按 `manual > framework_preset > auto_scan` 处理，见 `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md:75-84`。

当前扫描流程在持久化前先执行 `dedupeRelations([...batch.scanRelations, ...presetRelations])`，见 `src/services/scan-service.ts:125-128`。但 `dedupeRelations()` 对同一 `sourceDocPath::targetDocPath::relationType` 只比较 `relation.confidence > existing.confidence`，见 `src/services/scan-service.ts:524-532`。这意味着同一批次内如果 `auto_scan` confidence 高于 `framework_preset`，`framework_preset` 会在进入 `persistRelationWithPriority()` 前被丢弃，后续 `getRelationSourcePriority()` 和 `persistRelationWithPriority()` 的来源优先级逻辑无法再生效，相关逻辑见 `src/services/scan-service.ts:551-595` 和 `src/services/scan-service.ts:796-805`。

现有测试只覆盖已有 auto_scan 被后续 framework_preset 替换的场景，且测试中 legacy auto confidence 为 0.4，见 `tests/unit/services/scan-service.test.ts:728-774`，未覆盖同一批输入中 auto_scan confidence 高于 framework_preset 的冷启动或增量冲突。

**严重性判断：合理**

该问题直接违反 AC3，且会导致框架预设规则不能稳定压过自动发现结果，破坏来源优先级的全局一致性。原始严重性标为“高”合理，评估后定为 P1 阻塞交付。

**修复建议：可行**

审查建议可行。`dedupeRelations()` 应先比较 source priority，再在同 source 内比较 confidence；这样同批次候选关系不会在持久化前绕过 `manual > framework_preset > auto_scan` 的业务规则。还需要补充冷启动或同批次增量测试：同 endpoints/type 下构造更高 confidence 的 `auto_scan` 与较低 confidence 的 `framework_preset`，断言最终持久化 `framework_preset`。

**误报评估：非误报**

不是误报。当前去重顺序和比较条件能明确复现优先级被 confidence 截断的问题，且现有测试没有覆盖该边界。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | deprecated 保护只覆盖 source='manual' | [高] | **P1** | 真实 deprecated 路径会保留 auto_scan/framework_preset 来源，当前保护逻辑无法阻止恢复为 active。 |
| 2 | 同批次去重仍按 confidence 选择关系 | [高] | **P1** | framework_preset 可能在进入持久化优先级逻辑前被高 confidence auto_scan 丢弃。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（deprecated 保护只覆盖 source='manual'）**：确认有效，阻塞 Story 4-2 交付。需要修复真实 `RelationService.deprecateRelation()` 路径下 auto_scan/framework_preset 被手动 deprecated 后的增量扫描保护，并补充对应回归测试。
- **发现 #2（同批次去重仍按 confidence 选择关系）**：确认有效，阻塞 Story 4-2 交付。需要修复 `dedupeRelations()` 的冲突选择规则，使其先按来源优先级再按 confidence 选择，并补充同批次冲突测试。
- **整体决定**：本轮 CR 评估不通过。建议进入 CR fixer 工作流修复上述两个 P1 阻塞项后，再执行下一轮 reviewer 复审。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-15
- **Model Used**: GPT-5 Codex (codex)
- **Fix Items**: 2

1. **发现 #1：真实 `deprecateRelation()` 路径下 deprecated 关系被恢复**
   - 修复内容：`src/services/relation-service.ts` 中将手动 deprecated 关系统一切换为 `source='manual'`，并在 `metadata.history` 中补充 `previousSource` / `nextSource`，让增量扫描现有的 manual 保护逻辑可以覆盖真实人工 deprecated 路径。
   - 测试补充：`tests/unit/services/relation-service.test.ts`、`tests/integration/relation-service.test.ts` 断言 deprecated 后 source 变为 manual；`tests/unit/services/scan-service.test.ts` 新增从 auto_scan 关系经 `RelationService.deprecateRelation()` 进入 deprecated，再执行增量扫描仍保持 deprecated 的回归测试。
   - 结果：已修复。

2. **发现 #2：同批次去重先看 confidence 导致 framework_preset 被截断**
   - 修复内容：`src/services/scan-service.ts` 中为 `dedupeRelations()` 增加来源优先级比较，先按 `manual > framework_preset > auto_scan` 选择，同 source 再比较 confidence。
   - 测试补充：`tests/unit/services/scan-service.test.ts` 新增同一批次中 `auto_scan` 的 `SYNC_REQUIRED` confidence 高于 `framework_preset` 时，最终仍保留 `framework_preset` 的回归测试。
   - 结果：已修复。

3. **验证**
   - `npm test -- --run tests/unit/services/relation-service.test.ts tests/integration/relation-service.test.ts tests/unit/services/scan-service.test.ts` ✅ 3 个测试文件、22 条测试全部通过
   - `npm run type-check` ✅ 通过
