---
Story: 4-2
Round: 2
Date: 2026-05-15
Model Used: GPT-5 Codex (codex)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Agent 工具不可用，已按 `bmenhance-cr-01-reviewer` 降级规则执行串行三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor），审查层未失败。第 1 轮两个 P1 阻塞项均已修复：`RelationService.deprecateRelation()` 真实路径会把人工 deprecated 的自动来源关系切换为 `source='manual'`，`dedupeRelations()` 也已按 `manual > framework_preset > auto_scan` 先比较来源优先级、同来源再比较 confidence。定向回归、全量测试、type-check、lint、build 均通过；本轮未发现新的阻塞问题。建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — deprecated 保护只覆盖 `source='manual'`，无法保护用户手动 deprecated 的 `auto_scan` / `framework_preset` 关系
   - 修复位置和方式：`src/services/relation-service.ts:79-84` 在 `deprecateRelation()` 更新关系时同步写入 `source: 'manual'` 与 `status: 'deprecated'`；`src/services/relation-service.ts:151-166` 的 history 记录 `previousSource` / `nextSource`，保留来源切换证据。
   - 验证结果：`tests/unit/services/relation-service.test.ts:285-315` 覆盖 `auto_scan` 关系经 `deprecateRelation()` 后切换为 manual deprecated；`tests/integration/relation-service.test.ts:47-63` 覆盖 SQLite 集成路径；`tests/unit/services/scan-service.test.ts:748-800` 覆盖自动扫描关系经 `RelationService.deprecateRelation()` 后，增量扫描不会恢复为 active。

2. Round 1 / Finding #2 — 同批次去重仍按 confidence 选择关系，`framework_preset` 可能输给 `auto_scan`
   - 修复位置和方式：`src/services/scan-service.ts:524-554` 的 `dedupeRelations()` 已改为通过 `shouldReplaceDedupeCandidate()` 先比较来源优先级；`src/services/scan-service.ts:810-818` 明确定义 `manual=3`、`framework_preset=2`、`auto_scan=1`。
   - 验证结果：`tests/unit/services/scan-service.test.ts:850-875` 覆盖同一扫描批次内 `auto_scan` confidence 更高时仍保留 `framework_preset`；`tests/unit/services/scan-service.test.ts:802-848` 覆盖已有 `auto_scan` 被后续 `framework_preset` 替换。

### 仍为非阻塞待办

无。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test -- --run tests/unit/services/relation-service.test.ts tests/integration/relation-service.test.ts tests/unit/services/scan-service.test.ts tests/unit/cli/commands/scan.test.ts` ✅ 通过（30 / 30）
- `npm test` ✅ 通过（378 / 378）
- `npm run type-check` ✅ 通过
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 额外复核：
  - 复核 `src/services/relation-service.ts:79-84`，确认真实 `deprecateRelation()` 路径会把自动来源关系提升为 manual 保护对象。
  - 复核 `src/services/scan-service.ts:557-609`，确认增量扫描写入时 manual 快照键与现有 manual 关系会阻止 active 关系重新写入。
  - 复核 `src/services/scan-service.ts:524-554` 与 `src/services/scan-service.ts:810-818`，确认同批次 dedupe 不再被 confidence 优先级截断。

## 通过项

- AC2：用户通过 `RelationService.deprecateRelation()` 手动 deprecated 的自动来源关系会转换为 `manual + deprecated`，增量扫描保留该关系且不会恢复为 active。
- AC3：来源冲突规则在同批次 dedupe 和已有关系写入路径中均按 `manual > framework_preset > auto_scan` 生效。
- AC6：source 文档被修改时，manual outgoing 边仍通过 `deleteRelationsByDocId(..., { excludeSources: ['manual'] })` 保留。
- AC7 / AC8：`cord scan --rebuild` manual 关系警告、确认取消、`--force` 跳过确认和删除数量提示仍有单测覆盖。
- 本轮未修改 `PLAN.md`、`EXPERIMENTS.md`、`EXPERIMENT_NOTES.md`，也未执行代码修复、提交或推送。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：进入 CR evaluation / finalizer 流程；若 evaluation 同意本轮结论，可继续完成 Story 4-2 收尾。
