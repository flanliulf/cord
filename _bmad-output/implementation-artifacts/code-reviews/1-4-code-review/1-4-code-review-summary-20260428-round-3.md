---
Story: 1-4
Round: 3
Date: 2026-04-28
Model Used: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。当前 `npm test`、`npm run lint`、`npm run build` 均通过，且 Round 2 评估中确认修复的 SQL 内联、lint 门禁、update 不可变字段保护等改动仍然有效；但本轮发现一条新的 schema 级阻塞问题，直接推翻了 Round 2 对“Mapper 运行时校验已在 DB 层补齐所有约束”的放行依据，因此结论为**不通过**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #2, #3, #5
   - `dist` 运行态缺少迁移 SQL、update 不可变字段漂移、lint 失败问题在当前代码中仍保持修复状态。
   - 验证结果：`npm run build` ✅，`npm run lint` ✅，相关实现未回退。

2. Round 1 / Finding #1, #4（Round 2 已确认修复）
   - `relations.source` / `status`、`sync_states.status` 的 `CHECK` 约束与 mapper 侧运行时校验仍存在。
   - 验证结果：当前实现未回退，相关测试仍通过。

### 仍为非阻塞待办

1. Round 2 / TODO-007
   - 旧库升级路径的 `002` 增量迁移策略仍作为 pre-release 阶段的非阻塞待办保留。

2. Round 2 / TODO-008, TODO-009, TODO-010
   - `metadata` 对象形态校验、partial update 过滤 `undefined`、迁移 AC 测试增强仍保持为 P2 / CR TODO。

## 新发现

### 1. [高][新] `relations.relation_type` 仍未在数据库层受约束，Round 2 的放行依据不成立

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/repositories/migrations/001-initial-schema.sql:29-52` 与 `src/repositories/migrations/001-initial-schema.ts:37-59` 只为 `source`、`status`、`sync_states.status` 添加了 `CHECK` 约束；`relation_type` 仍是裸 `TEXT NOT NULL`。
  - `src/repositories/mappers.ts:144-146` 仅在读取时通过 `assertEnum` 校验 `relation_type`。
  - `tests/unit/repositories/mappers.test.ts:366-395` 只验证读取时会拒绝非法 `relation_type`，`tests/unit/repositories/sqlite-graph-repository.test.ts` 没有任何用例验证数据库 schema 会在写入时拒绝非法 `relation_type`。
  - Round 2 评估文件 `1-4-code-review-evaluation-20260428-round-2.md:40-43` 声称“DB 层补充了所有 CHECK 约束”，与当前 schema 不符。

- **影响**
  - 绕过 TypeScript/应用层校验的写入仍可把非法 `relation_type` 持久化到数据库。
  - 系统会在读取阶段才 fail-fast 崩溃，说明数据完整性并未在存储边界闭合。
  - 这直接推翻了 Round 2 的关键放行前提，不属于已有 TODO，而是新的阻塞性事实缺口。

- **建议**
  - 为 `relations.relation_type` 增加数据库级 `CHECK` 约束，约束值域与 `RELATION_TYPES` 保持一致。
  - 补充仓储层测试，验证非法 `relation_type` 在写入阶段即被数据库拒绝，而不是留到读取阶段才抛错。

### 2. [中][新] mapper 运行时错误仍直接抛裸 `Error`，缺少统一错误模型与诊断结构

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/repositories/mappers.ts:57-88` 在 JSON/枚举校验失败时直接 `throw new Error(...)`。
  - 当前仓储层没有统一的 `RepositoryError` / `StorageError` 类型承载结构化上下文与稳定错误码。

- **影响**
  - 虽然错误文本包含上下文，但上层如果需要稳定识别“数据损坏 / 枚举越界 / metadata 解析失败”等类别，只能依赖字符串匹配。
  - 这会弱化后续 CLI、日志与诊断体验的一致性。

- **建议**
  - 引入统一的仓储层错误类型，保留 `table/id/column/cause` 等结构化字段。
  - 为上层消费路径补充一条错误类型断言测试。

## 验证摘要

- `npm test` ✅（198 / 198）
- `npm run lint` ✅
- `npm run build` ✅
- 额外复核：
  - Round 2 放行依据复核 ❌：`relations.relation_type` 的数据库级约束并未补齐，Round 2 对“所有 CHECK 约束已补齐”的判断不成立。
  - Round 2 TODO 复核 ✅：TODO-007~TODO-010 仍然只是待办，没有发现新的证据足以把它们整体升级为阻塞。

## 通过项

- SQL 内联方案仍有效：构建产物不再依赖外部 `.sql` 文件。
- `updateDocument` / `updateRelation` 的不可变字段保护仍有效。
- 当前测试、lint、build 三项门禁全部通过。
- 三层审查状态：Blind Hunter 可用，Edge Case Hunter 可用，Acceptance Auditor 可用；无审查层失败。

## 结论

- **结论：不通过**
- **阻塞项**：`relations.relation_type` 缺少数据库级 `CHECK` 约束，推翻 Round 2 放行前提
- **建议**：先补齐 `relation_type` 的 schema 约束与写入期回归测试，再进行下一轮 CR；其余 Round 2 的 P2 TODO 可继续按 backlog 跟踪
