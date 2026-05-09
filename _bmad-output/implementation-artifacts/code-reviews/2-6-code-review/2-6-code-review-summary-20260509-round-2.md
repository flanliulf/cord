---
Story: 2-6
Round: 2
Date: 2026-05-09
Model Used: GitHub Copilot (current session model not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 P1 问题（相同 `contentHash` 多候选 rename/move 依赖 FIFO）已通过互相唯一最优匹配修复，并补充稳定消歧与歧义降级测试。当前验证通过：`npm test -- tests/unit/scanner/lifecycle-detector.test.ts`（5/5）、`npm test -- tests/unit/services/scan-service.test.ts`（9/9）、`npm run type-check`、`npm run lint`、`npm run build`。本轮未发现新的阻塞项或中高优先级问题，建议通过本轮 CR。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 相同 `contentHash` 的重命名/移动匹配依赖 FIFO，可能更新错误 `docId` 路径
   - 修复位置：`src/scanner/lifecycle-detector.ts:67-105` 将旧的单候选 `shift()` 匹配改为按 hash 分组后调用 `resolveHashGroupMatches()`；`src/scanner/lifecycle-detector.ts:153-219` 使用 stored/current 双向唯一最优匹配，只有互相选择时才生成 rename/move。
   - 测试位置：`tests/unit/scanner/lifecycle-detector.test.ts:151-257` 新增同 hash 多候选稳定消歧测试，以及真正歧义时降级为 delete + add 的回归测试。
   - 验证结果：`npm test -- tests/unit/scanner/lifecycle-detector.test.ts` 通过（5/5）；Blind Hunter 与 Acceptance Auditor 复审均确认 Round 1 Finding #1 已关闭。

### 仍为非阻塞待办

1. Round 1 / Finding #2 — 无变更快速返回在判定前仍全量读取并计算 `contentHash`，NFR6 覆盖不足
   - 维持既有评估结论：CR TODO / 非阻塞。
   - 理由：Story v0.1 Dev Notes 已明确接受早返前全量计算 `contentHash`，并将懒 hash 优化延至 v0.2；本轮代码未扩大该风险。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

Edge Case Hunter 提出的“为完全并列打分添加字典序 tiebreaker”未采纳：该建议会把本轮修复要求中的“无法唯一判断时降级 delete + add”重新变成任意强配对，反而可能恢复 Round 1 的错误 `docId` 绑定风险。因此该候选归入 dismiss，不作为新问题输出。

## 验证摘要

- `npm test -- tests/unit/scanner/lifecycle-detector.test.ts` ✅ 通过（5 / 5）
- `npm test -- tests/unit/services/scan-service.test.ts` ✅ 通过（9 / 9）
- `npm run type-check` ✅ 通过
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过（tsup ESM + DTS build success）
- 额外复核：
  - 同 hash 多候选不再依赖 FIFO；匹配必须同时满足 stored 侧与 current 侧唯一最优。
  - 歧义同 hash 场景会降级为 delete + add，避免静默更新错误 `docId` 路径。
  - ScanService 对 renamed/moved/deleted/added 的既有消费路径未因本次修复破坏。

## 通过项

- Round 1 P1 修复已生效，相关测试覆盖稳定消歧和歧义降级两条关键路径。
- AC #1-#6 与 AC #8 仍由单元/集成测试覆盖；AC #7 的大仓库性能口径保持 P2 TODO，不阻塞 v0.1 交付。
- 三层复审均完成，无失败层；Blind Hunter 与 Acceptance Auditor 未发现阻塞缺口。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：将 Round 1 Finding #2 保持在 CR TODO / v0.2 性能优化跟踪中；Story 2.6 可进入后续评估/收尾流程。