---
Story: 1-4
Round: 2
Date: 2026-04-28
Model Used: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 中的 `lint` 门禁失败、`dist` 运行态缺少迁移 SQL、update 不可变字段漂移等问题已修复，当前 `npm test`、`npm run lint`、`npm run build` 均通过；但仍存在 2 个上轮问题在升级路径上未真正落地，且新增 3 个中优先级缺口，结论为**不通过**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #2 — 构建产物未包含迁移 SQL
   - `src/repositories/migrations/runner.ts` 已改为使用 `INITIAL_SCHEMA_SQL` 内联 TS 模块，移除运行时 `readFileSync` 依赖。
   - 验证结果：`npm run build` ✅；构建产物不再依赖外部 `.sql` 文件。

2. Round 1 / Finding #3 — `updateDocument` / `updateRelation` 返回值与数据库状态可能漂移
   - `src/repositories/interfaces.ts` 已收窄 update 入参类型；`src/repositories/sqlite-graph-repository.ts` 已显式忽略不可变字段并透传既有 `createdAt`。
   - 验证结果：当前实现不再把 `createdAt` 从调用参数错误合并进返回值。

3. Round 1 / Finding #5 — lint 失败
   - `tests/unit/repositories/sqlite-graph-repository.test.ts` 未使用导入已移除。
   - 验证结果：`npm run lint` ✅。

### 仍为非阻塞待办

无。

## 新发现

### 1. [高]（上轮遗留）Schema 修复只覆盖新库，已有数据库升级后仍保留旧索引与旧约束

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/repositories/migrations/runner.ts:70-77` 只会执行“未记录版本”的迁移。
  - 本轮把唯一索引与 `CHECK` 约束修复直接写回 `src/repositories/migrations/001-initial-schema.sql:29-64` 和 `src/repositories/migrations/001-initial-schema.ts:37-70`，但没有新增 `002` 增量迁移。
  - 现有测试 `tests/unit/repositories/sqlite-graph-repository.test.ts:22-45,395-429` 全部基于新建 `:memory:` 数据库，未覆盖旧库升级路径。

- **影响**
  - 已经执行过旧版 `v1` 迁移的真实数据库，在升级后仍会保留旧的三列唯一索引与缺失的约束。
  - 上轮修复的核心目标只对新库生效，对实际升级用户无效，属于发布后数据模型不一致的阻塞问题。

- **建议**
  - 新增 `002` 迁移，显式重建受影响索引与约束。
  - 补充同一文件数据库的升级测试，验证旧库 reopen 后能得到新 schema。

### 2. [中]（上轮遗留）Mapper 防御仍是 fail-fast，单条坏记录依然会让全量读取整体失败

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/repositories/mappers.ts:57-88` 在 JSON 或枚举校验失败时直接抛错。
  - `src/repositories/sqlite-graph-repository.ts:67-69,155,261-263` 对批量读取仍采用 `rows.map(...)`，任意一行抛错都会中断 `getAllDocuments()`、`getAllRelations()`、`getAllSyncStates()`。
  - 当前测试 `tests/unit/repositories/mappers.test.ts:347-409` 只验证 mapper 会抛错，没有仓储层“坏一行不影响其他行”的回归测试。

- **影响**
  - 上轮评估中的“单行数据损坏不再导致整个查询崩溃”结论并未真正落地。
  - 生产库只要混入一条坏记录，相关全量查询 API 仍然整体不可用。

- **建议**
  - 二选一并统一语义：
  - 若目标是容错读取，则在仓储层逐行隔离坏记录并汇总错误。
  - 若目标是 fail-fast，则修正文档/评估结论，并补仓储层失败测试，避免误导后续依赖方。

### 3. [中][新] `metadata` 只校验 JSON 可解析，未校验必须是对象

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/repositories/mappers.ts:57-64` 仅执行 `JSON.parse(raw)`，随后直接断言为 `Record<string, unknown>`。
  - 这会让 `[]`、`123`、`"text"`、`null` 这类“合法 JSON 但非对象”的值穿透类型边界。
  - 当前测试 `tests/unit/repositories/mappers.test.ts:347-409` 只覆盖非法 JSON，未覆盖这些类型错误输入。

- **影响**
  - 仓储层可能向上层返回数组或原始值伪装成对象 metadata，下游按对象访问时会出现隐蔽运行时错误。

- **建议**
  - 在 `parseJsonMetadata()` 中增加对象形态校验：要求 `parsed !== null`、`!Array.isArray(parsed)` 且 `typeof parsed === 'object'`。
  - 补充 `[]`、`null`、数字、字符串等失败用例。

### 4. [中][新] partial update 传入 `undefined` 会把字段误清空或触发约束错误

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/repositories/sqlite-graph-repository.ts:80-98,173-193` 直接把 `safeUpdates` merge 进既有对象，没有过滤 `undefined` 值。
  - 当调用方构造 `Partial<T>` 时显式传入 `undefined`，可选字段会被写成 `NULL`，必填字段则可能触发数据库约束错误。

- **影响**
  - 这会让“未打算更新的字段”在边界调用中被误清空，属于不易发现的更新语义偏差。

- **建议**
  - 在 merge 前过滤掉值为 `undefined` 的键，只对显式给定非 `undefined` 的字段执行更新。
  - 增加 `updateDocument` / `updateRelation` 对 `undefined` 输入的回归测试。

### 5. [中][新] 迁移行为的 AC 证据仍不足，测试未直接验证历史表语义、迁移失败回滚与 WAL 结果

- **来源**：auditor
- **分类**：patch

- **证据**
  - AC#5：`tests/unit/repositories/sqlite-graph-repository.test.ts:32-44` 只验证 `:memory:` 新库上的“不抛错”，未直接验证同一数据库中 `schema_migrations` 的幂等跳过行为。
  - AC#6：`tests/unit/repositories/sqlite-graph-repository.test.ts:358-367` 仅验证业务事务回滚，没有模拟迁移脚本执行失败并断言 `schema_migrations` 与 schema 变更一并回滚。
  - AC#7：`tests/unit/repositories/sqlite-graph-repository.test.ts:381-390` 只验证可读写，未直接校验 `PRAGMA journal_mode` 返回值。

- **影响**
  - 虽然当前实现和基础测试能通过，但 AC#5/#6/#7 的关键行为仍缺少直接证据，后续回归时容易漏检。

- **建议**
  - 补充基于临时文件数据库的迁移专项测试：
  - 验证同库二次执行只记录一次版本。
  - 验证失败迁移不会留下半完成 schema 和版本记录。
  - 直接断言 `PRAGMA journal_mode` 为 `wal`。

## 验证摘要

- `npm test` ✅（198 / 198）
- `npm run lint` ✅
- `npm run build` ✅
- 额外复核：
  - 上轮修复记录核对 ✅：`dist` SQL 打包问题、lint 问题、不可变字段漂移问题均已修复。
  - 升级路径复核 ❌：当前未发现 `002` 增量迁移，说明 schema 修复尚未覆盖已有数据库。

## 通过项

- Round 1 的 `dist` 运行态缺 SQL 问题已关闭：迁移 SQL 已内联到 `001-initial-schema.ts`。
- Round 1 的 lint 阻塞项已关闭：当前 `npm run lint` 通过。
- Round 1 的 update 返回值漂移问题已关闭：接口签名与实现层均已收窄不可变字段。
- 三层审查状态：Blind Hunter 可用，Edge Case Hunter 可用，Acceptance Auditor 可用；无审查层失败。

## 结论

- **结论：不通过**
- **阻塞项**：已有数据库升级路径未覆盖本轮 schema 修复；Mapper 防御语义与上轮修复目标不一致
- **建议**：先补 `002` 增量迁移与迁移专项测试，再明确 mapper/仓储层对坏记录的语义是“容错读取”还是“失败快”，然后再进入下一轮 CR
