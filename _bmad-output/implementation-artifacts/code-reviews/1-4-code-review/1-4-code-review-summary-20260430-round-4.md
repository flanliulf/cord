---
Story: 1-4
Round: 4
Date: 2026-04-30
Model Used: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 3 中补齐的 `relation_type` 数据库级 `CHECK` 约束与写入期测试对新建数据库已生效，当前 `npm test`、`npm run lint`、`npm run build` 均通过；但本轮确认该修复仍只覆盖“新建库”，未覆盖任何已经初始化为旧版 `v1` schema 的现有数据库，因此结论为**不通过**。

## 上轮问题回顾

### 已修复

1. Round 3 / Finding #1 — `relations.relation_type` 缺少数据库级 `CHECK` 约束
   - `src/repositories/migrations/001-initial-schema.sql` 与 `src/repositories/migrations/001-initial-schema.ts` 已为 `relation_type` 增加 `CHECK` 约束。
   - `tests/unit/repositories/sqlite-graph-repository.test.ts:433-467` 已补充写入期测试，验证非法 `relation_type` 在 DB 层被拒绝、合法值可写入。

2. Round 3 / Finding #2 — mapper 统一错误模型
   - 上轮评估已降级为 P3 / CR TODO，本轮未发现新的证据表明其应升级为阻塞。

### 仍为非阻塞待办

1. Round 2 / TODO-007
   - pre-release 阶段的旧库升级路径约定仍在 backlog 中，但由于 Round 3 实际修改了 `v1` schema 内容，这个待办与本轮阻塞项直接相关。

2. Round 2 / TODO-008, TODO-009, TODO-010
   - `metadata` 对象形态校验、partial update 过滤 `undefined`、迁移 AC 测试增强仍保持为非阻塞 CR TODO。

3. Round 3 / TODO-011
   - mapper 统一错误类型仍为 P3 / CR TODO。

## 新发现

### 1. [高][新] Round 3 的 `relation_type` 修复未覆盖任何已初始化的 `v1` 数据库

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/repositories/migrations/runner.ts:17-20` 当前仍只注册 `version: 1` 这一条迁移。
  - `src/repositories/migrations/runner.ts:70-77` 会跳过所有已记录为 `v1` 的数据库，不会重新执行被修改过的 `001`。
  - Round 3 的修复记录 `1-4-code-review-evaluation-20260430-round-3.md:109-141` 仅修改了 `001-initial-schema.sql`、`001-initial-schema.ts` 和新建库测试，没有新增 `002` 增量迁移。

- **影响**
  - 任何在 Round 3 修复前初始化的本地或共享数据库，仍会保留缺少 `relation_type` 约束的旧 schema。
  - 这意味着 Round 3 标记为“已修复”的数据完整性缺口，在现有数据库升级路径上依然存在，阻塞当前分支的最终放行。

- **建议**
  - 新增 `002` 增量迁移，显式把旧 `relations` 表升级到含 `relation_type CHECK` 的 schema。
  - 补充基于同一文件数据库的升级测试，验证“旧库初始化 -> 升级后 reopen”路径。

## 验证摘要

- `npm test` ✅（200 / 200）
- `npm run lint` ✅
- `npm run build` ✅
- 额外复核：
  - Round 3 修复效果（新建库）✅：`relation_type` 的 DB 级约束与写入期测试已生效。
  - 现有库升级路径 ❌：未发现 `002` 增量迁移，旧版 `v1` 数据库不会自动获得该修复。
  - AC 复核 ✅：未发现新的 AC 阻塞问题。

## 通过项

- `relation_type` 的数据库级约束已在新建库路径上闭合，Round 3 修复本身未回退。
- 写入期回归测试已覆盖非法/合法 `relation_type` 的 DB 行为。
- 当前测试、lint、build 三项门禁全部通过。
- 三层审查状态：Blind Hunter 可用，Edge Case Hunter 可用，Acceptance Auditor 可用；无审查层失败。

## 结论

- **结论：不通过**
- **阻塞项**：Round 3 的 `relation_type` schema 修复未覆盖已初始化的 `v1` 数据库
- **建议**：先补 `002` 增量迁移与升级路径测试，再进行下一轮 CR；其余 P2/P3 CR TODO 可继续留在 backlog 跟踪
