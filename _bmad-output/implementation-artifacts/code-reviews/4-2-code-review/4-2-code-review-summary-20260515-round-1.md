---
Story: 4-2
Round: 1
Date: 2026-05-15
Model Used: GPT-5 Codex (codex)
Type: Code Review Summary
---

## 审查结论

首轮审查。Agent 工具不可用，已按 `bmenhance-cr-01-reviewer` 降级规则执行串行三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor），审查层未失败。定向单测、全量测试、type-check、lint、build 均通过，但发现 2 个 AC 级阻塞问题：AC2 的 deprecated 保护与实际 RelationService 契约不一致，AC3 的 framework_preset > auto_scan 优先级在同批次去重阶段会被 confidence 覆盖。建议本轮不通过。

## 新发现

### 1. [高] deprecated 保护只覆盖 source='manual'，无法保护用户手动 deprecated 的 auto_scan/framework_preset 关系

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/services/relation-service.ts:77-81` 的 `deprecateRelation()` 只更新 `status: 'deprecated'` 和 metadata，不把关系来源改为 `manual`。Story 4.1 Dev Notes 也要求 deprecated 保留原字段语义。
  - `src/services/scan-service.ts:543-548` 的 `snapshotManualRelationKeys()` 只快照 `relation.source === 'manual'` 的关系。
  - `src/services/scan-service.ts:175-177` 的增量删边只排除 `excludeSources: ['manual']`，因此被用户手动 deprecated、但原来源仍为 `auto_scan` 或 `framework_preset` 的关系会先被删除；随后扫描重新发现同一关系时会以 `status: 'active'` 写回。
  - 现有新增测试 `tests/unit/services/scan-service.test.ts:686-725` 通过直接构造 `source: 'manual', status: 'deprecated'` 覆盖场景，但这不是 `RelationService.deprecateRelation()` 对自动扫描关系产生的真实状态。

- **影响**
  - 违反 Story 4.2 AC2：用户手动标记为 deprecated 的自动发现关系会在增量扫描后被恢复为 active，收敛保护失效。
  - 该问题会让用户已经纠正的误判关系重新出现在图谱中，属于核心数据完整性问题。

- **建议**
  - 保护逻辑不能只以 `source === 'manual'` 判断。需要让“用户手动 deprecated”具备可识别信号，例如 RelationService 在 metadata/history 中写入人工操作标记，或 ScanService 在删边与写入优先级中识别 `status='deprecated'` 且带 deprecated history 的关系。
  - 补充一条真实回归测试：先由扫描生成 `auto_scan` 关系，再通过 `RelationService.deprecateRelation()` 标记 deprecated，修改 source 文档并增量扫描，断言该关系仍为 deprecated 且未被 active 写回。

### 2. [高] 同批次去重仍按 confidence 选择关系，framework_preset 可能输给 auto_scan

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `src/services/scan-service.ts:524-532` 的 `dedupeRelations()` 对同一 `sourceDocPath::targetDocPath::relationType` 只比较 `relation.confidence > existing.confidence`。
  - Story 4.2 AC3 要求冲突优先级为 `manual > framework_preset > auto_scan`，但同一批扫描输入在进入 `persistRelationWithPriority()` 前已经被 `dedupeRelations()` 丢弃了较低 confidence 的候选关系。
  - `tests/unit/services/scan-service.test.ts:728-774` 只验证“已有 auto_scan 被后续 framework_preset 替换”的场景，且测试 fixture 中 framework_preset confidence 为 0.95、auto_scan 为 0.4，未覆盖 auto_scan confidence 更高时的同批次冲突。

- **影响**
  - 当自动扫描规则给出高于框架预设的 confidence 时，framework_preset 会在去重阶段被丢弃，最终持久化 auto_scan，违反 AC3。
  - 这会让框架约定无法稳定压过自动发现结果，来源优先级规则不具备全局一致性。

- **建议**
  - 将 `dedupeRelations()` 的冲突选择从单纯 confidence 改为先比较 source priority，再在同 source 内比较 confidence。
  - 补充冷启动或增量批次测试：构造同一 endpoints/type 下 `auto_scan` confidence 高于 `framework_preset`，断言最终持久化 `framework_preset`。

## 验证摘要

- `npm test -- --run tests/unit/services/scan-service.test.ts tests/unit/cli/commands/scan.test.ts` ✅ 通过（21 / 21）
- `npm test` ✅ 通过（376 / 376）
- `npm run type-check` ✅ 通过
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核：
  - 复核 Story 4.1 `deprecateRelation()` 契约与 Story 4.2 新保护逻辑，确认新增测试未覆盖真实 deprecate 路径。
  - 复核 `dedupeRelations()` 与 `persistRelationWithPriority()` 的调用顺序，确认同批次冲突会先被 confidence 去重截断。

## 通过项

- `cord scan --rebuild` 的 manual 关系计数、警告、确认、取消和 `--force` 跳过确认路径有单测覆盖。
- 增量扫描时 source 文档变更不会删除 `source='manual'` 的 outgoing 边，该特定场景有单测覆盖。
- `deleteRelationsByDocId(..., { excludeSources })` 的接口与 SQLite 实现已存在，Story 4.2 调用点使用了该能力。
- 当前变更未修改 `PLAN.md`、`EXPERIMENTS.md`、`EXPERIMENT_NOTES.md`。

## 结论

- **结论：不通过**
- **阻塞项**：2 个高严重级别 patch 项，分别阻塞 AC2 与 AC3。
- **建议**：进入 CR evaluation 后交由 fixer 修复上述两个问题，并补充对应真实路径回归测试。
