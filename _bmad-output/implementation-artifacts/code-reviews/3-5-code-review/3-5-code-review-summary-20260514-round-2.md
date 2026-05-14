---
Story: 3-5
Round: 2
Date: 2026-05-14
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 4 个问题均已在代码和回归测试中闭环；本轮 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三层审查均完成。`npm test`、`npm run lint`、`npm run build` 均通过。本轮未发现新的阻塞项或中高优先级问题，建议通过本轮 CR。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `cord status` 在查看状态时会创建 `.cord/cord.db` 并触发迁移
   - 修复位置：`src/cli/commands/status.ts:61-70`。
   - 修复方式：默认 service factory 先检查 `.cord/cord.db` 是否存在；不存在时返回 `createEmptyStatusResult()`，不创建 `.cord` 目录或数据库文件，也不构造会触发迁移的 `SqliteGraphRepository`。
   - 验证结果：`tests/unit/cli/commands/status.test.ts:204-236` 覆盖未初始化项目执行 `status --json` 后 `.cord` 不存在。

2. Round 1 / Finding #2 — `StatusService` 状态快照由多次非事务读取拼装
   - 修复位置：`src/services/status-service.ts:50-88`。
   - 修复方式：数据库读取与健康指标计算收口到一次 `repository.transaction(() => ...)` 中，并从同一批 `documents` / `relations` 数组派生 `documentCount` 与 `relationCount`。
   - 验证结果：`tests/unit/services/status-service.test.ts:338-360` 覆盖事务调用 1 次，且不再调用二次 count 查询。

3. Round 1 / Finding #3 — 悬空关系会把仍存在的一端计为 connected，导致 `orphanedNodes` 低估
   - 修复位置：`src/services/status-service.ts:62-73`。
   - 修复方式：任一端缺失时只递增 `danglingEdges` 并 `continue`；只有两端文档都存在时才加入 `connectedDocumentIds`。
   - 验证结果：`tests/unit/services/status-service.test.ts:362-379` 覆盖文档唯一关系为 dangling 时仍计入 `orphanedNodes`。

4. Round 1 / Finding #4 — `finally` 中 `close()` 抛错会覆盖成功输出或原始错误
   - 修复位置：`src/cli/commands/status.ts:55-56`、`src/cli/commands/status.ts:73-85`。
   - 修复方式：`finally` 改为调用 `closeServiceSafely()`，捕获并忽略 close 异常，避免覆盖主流程输出与退出码。
   - 验证结果：`tests/unit/cli/commands/status.test.ts:238-319` 覆盖成功路径和失败路径下 close 抛错。

### 仍为非阻塞待办

无 Round 1 遗留待办。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test` ✅ 通过（360 / 360，38 个 test files；输出包含 scan pipeline setup 阶段的非阻塞 warning）
- `npm run lint` ✅ 通过（无输出，无错误或警告）
- `npm run build` ✅ 通过（ESM 与 DTS 均构建成功）
- 额外复核：
  - Round 1 四项修复均有代码证据和回归测试覆盖。
  - Edge Case Hunter 输出 `[]`，未发现新的未处理边界。
  - Acceptance Auditor 未发现 AC 1-8 或 Round 1 修复要求的覆盖缺口。

## 通过项

- StatusService 输出字段覆盖 AC2/AC5，且 AC3 的 `Date.parse(relation.createdAt)` 过时关系口径保持不变。
- `cord status` dashboard 与 `--json` 输出仍覆盖 AC6/AC7。
- 未初始化项目的 status 路径现在保持只读，不再创建 `.cord/cord.db`。
- 数据库健康指标从同一事务快照计算，避免 count 与派生指标口径漂移。
- 已知非阻塞观察项：`StatusService` 当前按全部关系统计 `relationCount` / `relationsByType`，未按 `relation.status` 过滤。Story 3.5 未冻结“健康统计只计 active 关系”的口径，因此本轮不作为 patch；后续若 Epic 4 关系管理要求健康指标默认排除 deprecated，应单独更新 Story/AC/测试。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：可进入 CR evaluation / finalizer；若后续要调整 deprecated 关系在 status 健康指标中的展示口径，应作为独立需求处理。
