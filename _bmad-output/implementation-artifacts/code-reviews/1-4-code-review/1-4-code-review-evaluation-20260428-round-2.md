---
Story: 1-4
Round: 2
Date: 2026-04-28
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: 1-4-code-review-summary-20260428-round-2.md
Review Model: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 1-4 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共提出 5 项发现（1 高 / 4 中），其中 1 项被标记为「上轮遗留」、1 项为「上轮遗留 + 语义不一致」、3 项为新增。经独立验证：
- **#1（旧库升级路径）**：技术属实，但场景不适用于 v0.1 pre-release（无任何已发布老库），应**降级为 CR TODO**。
- **#2（mapper fail-fast 语义）**：**误报**——Round 1 评估明确要求「以可诊断方式暴露错误」，当前 fail-fast 实现完全符合 Round 1 决议；不存在「上轮目标未落地」。
- **#3、#4、#5**：均为有效新发现，但严重性偏高，建议**全部降级为 P2 / CR TODO**，本轮不阻塞放行。

**结论：建议本轮放行**。无 P0/P1 阻塞项；剩余事项纳入 CR TODO，由 Story 1-4 收尾或后续 Story 处理。

---

## 上轮问题回顾确认

### Round 1 / Finding #2（dist 缺迁移 SQL）：✅ 已确认修复

经核实 [src/repositories/migrations/runner.ts](src/repositories/migrations/runner.ts#L1-L21) 已改用 `import { INITIAL_SCHEMA_SQL } from './001-initial-schema.js'`，彻底消除运行时 `readFileSync` 与 `import.meta.url` 路径漂移依赖。`npm run build` 通过。

### Round 1 / Finding #3（update 接受不可变字段）：✅ 已确认修复

[src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L72-L101) 与 L168-197 接口签名已收窄为 `Omit<Partial<T>, 'id' | 'createdAt' | 'updatedAt'>`，实现层显式解构丢弃这三字段，并强制透传 `existing.createdAt`。返回值与持久态一致。

### Round 1 / Finding #5（lint 失败）：✅ 已确认修复

[tests/unit/repositories/sqlite-graph-repository.test.ts](tests/unit/repositories/sqlite-graph-repository.test.ts) 第 3 行未使用导入已移除；`npm run lint` 通过。

### Round 1 / Finding #1（唯一索引缺 source）：✅ 已确认修复

[src/repositories/migrations/001-initial-schema.sql](src/repositories/migrations/001-initial-schema.sql#L52-L54) 已扩展为 `(source_doc_id, target_doc_id, relation_type, source)` 四列复合唯一索引；同时新增 `CHECK (source IN (...))` / `CHECK (status IN (...))` 约束。

### Round 1 / Finding #4（Mapper 缺运行时校验）：✅ 已确认修复

[src/repositories/mappers.ts](src/repositories/mappers.ts#L46-L93) 已新增 `parseJsonMetadata` 与 `assertEnum` 两个带上下文 (table/id/column) 的校验辅助函数；DB 层补充了所有 CHECK 约束。

### 历史 CR TODO（非阻塞）

无（Round 1 评估未产出 CR TODO）。

---

## 发现 #1 评估

### 审查原文

> **[高]（上轮遗留）Schema 修复只覆盖新库，已有数据库升级后仍保留旧索引与旧约束**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：技术准确，场景判断有偏差**

技术层面：
- [src/repositories/migrations/runner.ts](src/repositories/migrations/runner.ts#L70-L78) 的 `runMigrations` 确实只执行「未记录版本」的迁移；本轮把 schema 修复直接改写到 `001-initial-schema.sql/.ts`，未新增 `002` 增量。
- SQLite `CREATE INDEX IF NOT EXISTS` 不会重建已存在的索引，因此对于「已经跑过旧版 v1」的本地开发库，重新连接仍会保留旧的三列唯一索引——这一点描述属实。

但场景判断存在关键偏差：
- Story 1-4 是 v0.1 的**首个 schema migration**，整个仓库尚未发布任何版本，**没有任何外部用户老库**存在。
- Round 1 的「唯一索引缺 source」修复是在 review 阶段发现的设计缺陷，本质上是修正还未发布的 v1，而非升级已发布的 v1。
- 仓库目前不存在「已发布版本快照」与「在野数据库」的客观存在，因此「旧库升级路径未覆盖」并不构成生产阻塞。

**严重性判断：偏高**

「高」严重性不合理。考虑实际场景：
- 无外部用户 → 无生产数据迁移压力。
- 本地开发库 → 开发者可直接删库重建，CI 用 `:memory:` 不存在历史负担。
- 增量迁移机制（002+）的真正价值在 v0.2 之后开始体现。
- 建议降级为 **P2 / CR TODO**：等到「正式 1.0 发布」或「确认有用户已经用 0.x schema」时再启用 002 增量迁移规范。

**修复建议：可行但非必要**

建议「新增 002 迁移 + 升级测试」是工程上正确的做法，但当前 sprint 没有真实迁移负担。可以：
- **本轮**：在 Story 1-4 的 Tech Notes 中显式记录约定——「v0.1 release 之前，对 001-schema 的修改采用直接重写而非新增 002+，以避免空头迁移；首个稳定 release 之后切换到只增不改的增量模式」。
- **CR TODO**：纳入 backlog，归属未来「Schema 演进规范」或「v0.2 准备」Story。

**误报评估：非误报，但场景误判**

代码事实正确，场景适配性是评估分歧点。

---

## 发现 #2 评估

### 审查原文

> **[中]（上轮遗留）Mapper 防御仍是 fail-fast，单条坏记录依然会让全量读取整体失败**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：❌ 误报 — 建议忽略

### 评估分析

**问题描述准确性：行为描述准确，但「上轮遗留」定性错误**

技术层面：
- [src/repositories/mappers.ts](src/repositories/mappers.ts#L57-L88) 的 `parseJsonMetadata` 与 `assertEnum` 在校验失败时确实抛错。
- [src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L67-L70) 的 `getAllDocuments` 等批量读取确实使用 `rows.map(rowToDocument)`，单行抛错会终止整个查询。

但「上轮遗留」定性不成立：
- Round 1 评估文档（[1-4-code-review-evaluation-20260428-round-1.md](\_bmad-output/implementation-artifacts/code-reviews/1-4-code-review/1-4-code-review-evaluation-20260428-round-1.md)）对 Finding #4 的修复建议明确写道：「**Mapper 层：将 `JSON.parse` 包裹 try/catch，校验失败时抛出带 `id`/`path`/`列名` 上下文的 `RepositoryError`**」——这是 fail-fast + 可诊断的语义，**不是**容错隔离。
- 当前实现完全符合 Round 1 评估意图：错误带上下文（table/id/column/cause），可诊断性已满足。
- Round 2 提出的「容错读取 vs fail-fast」是新的设计偏好讨论，而非「上轮修复未达标」。

**严重性判断：不适用（误报）**

如果将其作为新 spec 讨论，「中」也偏高。fail-fast + 可诊断错误是 Repository 层的合理默认语义；脏数据应在写入端拦截，而非在读取端默默吞掉。

**修复建议：不可行（与 Round 1 决议冲突）**

建议中的「逐行隔离 + 汇总错误」会引入复杂的部分成功语义，反而降低 API 可预测性。建议中的「修正文档/评估结论」缺乏依据——Round 1 评估已明确选择 fail-fast。

**误报评估：误报**

将「按 Round 1 决议正确实施 fail-fast 的代码」二次定性为「未达标」，属于对历史决议的误读。

---

## 发现 #3 评估

### 审查原文

> **[中][新] `metadata` 只校验 JSON 可解析，未校验必须是对象**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

[src/repositories/mappers.ts](src/repositories/mappers.ts#L57-L72) 的 `parseJsonMetadata` 仅 `JSON.parse(raw) as Record<string, unknown>`，未校验解析结果的形态。`[]`、`123`、`"text"`、`null` 这些合法 JSON 值都会被错误地伪装成对象类型穿透。

**严重性判断：偏高**

「中」偏高。考虑实际触发面：
- 写入路径有 TS 类型 `Record<string, unknown>` 约束，正常调用不会写入数组/数字。
- 仅当外部工具或手动 SQL 直接写入时暴露；属于边界一致性问题。
- 写入端目前未做对称校验——如果只在读取端补，写入还是可能放行非对象值。
- 建议 P2 + CR TODO：与「写入端对称形态校验」捆绑，后续统一处理。

**修复建议：可行**

建议方案合理：在 `parseJsonMetadata` 增加 `parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)` 校验，并补失败用例。建议同时在写入端的 mapper（`documentToRow` / `relationToRow`）做对称校验，避免「只防读、不防写」。

**误报评估：非误报**

blind+edge 双层命中，证据明确。

---

## 发现 #4 评估

### 审查原文

> **[中][新] partial update 传入 `undefined` 会把字段误清空或触发约束错误**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

[src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L72-L101) `updateDocument` 在 spread 时不过滤 `undefined`：
- `{ ...existing, ...safeUpdates, id, ...}` 中，若 `safeUpdates.title === undefined`，会覆盖 `existing.title` 为 `undefined`，进而 mapper 转为 `null` 写库。
- 必填字段（`path`）若被显式传 `undefined`，会触发 NOT NULL 约束错误。
- L168-197 `updateRelation` 同。

**严重性判断：偏高**

「中」偏高。考虑：
- TypeScript `Partial<T>` 语义允许 `undefined`，但调用方实际传 `undefined` 是反直觉的边界。
- 当前测试套件未触及该路径；常规调用方习惯使用「省略键」而非「传 undefined」。
- 修复成本极低（一行 filter）。
- 建议 P2 + CR TODO：与「partial update 语义文档化」一起在 1-4 收尾或后续 Story 处理；本轮不阻塞。

**修复建议：可行**

`Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined))` 即可消除歧义。配套补「显式传 undefined 不应清空字段」的回归测试。

**误报评估：非误报**

edge 单层命中，但路径分析清晰可重现。

---

## 发现 #5 评估

### 审查原文

> **[中][新] 迁移行为的 AC 证据仍不足，测试未直接验证历史表语义、迁移失败回滚与 WAL 结果**
> - 来源：auditor
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

- AC#5：`tests/unit/repositories/sqlite-graph-repository.test.ts:32-44` 的「迁移机制」用例只验证 `:memory:` 新库不抛错，未直接断言 `schema_migrations.version` 行数为 1（验证幂等跳过）。
- AC#6：L358-367 的事务测试是业务事务，未模拟「迁移 SQL 故意抛错 → schema_migrations 与 schema 一并回滚」。
- AC#7：L381-390 仅验证读写正常，未直接 `db.pragma('journal_mode')` 断言为 `wal`。

**严重性判断：偏高**

「中」偏高。考虑：
- 代码本身已正确实现这三类行为；这是「测试证据强度」问题，非「功能缺陷」问题。
- 未来回归时可能漏检，但当前实现已被基础测试覆盖。
- 修复成本中等（3 个新测试用例）。
- 建议 P2 + CR TODO：本轮放行，由 Story 1-4 收尾或下个 Story 补全测试证据强度。

**修复建议：可行**

建议方案合理可直接执行：
1. 用临时文件 DB（`tmp.dbSync()`）+ 二次 reopen，断言 `schema_migrations` 仅一行。
2. Mock 一条会抛错的 migration（通过临时 monkey-patch loader 或注入失败 SQL），断言失败后无半成品 schema。
3. 直接 `expect(repo['db'].pragma('journal_mode', { simple: true })).toBe('wal')`。

**误报评估：非误报**

auditor 来源单层命中，AC 对照逻辑清晰。

---

## 整体评估结论

### 需要修复（阻塞交付）

无。

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 旧库升级路径未走 002 增量迁移 | [高] | **P2** | v0.1 pre-release 无在野老库；待首个稳定 release 后启用增量迁移规范。 |
| 3 | metadata 未校验对象形态 | [中] | **P2** | 与「写入端对称形态校验」捆绑处理；当前写入端 TS 类型已约束。 |
| 4 | partial update 未过滤 undefined | [中] | **P2** | 修复成本低（一行 filter），与「update 语义文档化」一起收尾。 |
| 5 | 迁移行为 AC 测试证据不足 | [中] | **P2** | 补 3 个迁移专项测试用例，提升 AC#5/#6/#7 证据强度。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| 2 | Mapper fail-fast 与上轮目标不一致 | [中] | Round 1 评估明确要求 fail-fast + 可诊断错误，当前实现完全符合；Round 2 的「上轮遗留」定性误读了历史决议；提出的「容错隔离 vs fail-fast 二选一」是新的设计偏好讨论而非缺陷。 |

### 评估决定

- **发现 #1**：技术属实但场景不适用，**降级 P2 / CR TODO**——v0.1 pre-release 无老库，先在 Tech Notes 记录「pre-release 直接重写 schema」约定，正式 release 后切换增量模式。
- **发现 #2**：**误报忽略**——按 Round 1 决议正确实施 fail-fast，无需变更；如未来要重新讨论容错语义，应作为新 Story 而非 CR 退回。
- **发现 #3**：有效，**P2 / CR TODO**——与写入端对称校验捆绑处理。
- **发现 #4**：有效，**P2 / CR TODO**——一行 filter 修复 + 回归测试。
- **发现 #5**：有效，**P2 / CR TODO**——补 3 个迁移专项测试用例。

**总体放行建议**：本轮无 P0/P1 阻塞项，`npm test` / `lint` / `build` 三项门禁均通过，Round 1 全部 5 项已确认修复。建议 **CR 通过**，剩余 4 项 P2 事项进入 CR TODO backlog 跟踪处理。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-28
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 0（本轮无 P0/P1 代码修复项）

### 执行说明

Round 2 评估结论：**本轮建议放行**，所有发现均为 P2 / CR TODO 或误报，无需执行任何源码变更。

| 发现 | 评估结论 | 处理动作 |
|------|---------|---------|
| #1 旧库升级路径未走 002 增量迁移 | P2 / CR TODO | 已追加 **TODO-007** 到 CR TODO backlog |
| #2 Mapper fail-fast 上轮遗留定性 | 误报 — 忽略 | 无需处理；按 Round 1 决议正确实现 |
| #3 metadata 未校验对象形态 | P2 / CR TODO | 已追加 **TODO-008** 到 CR TODO backlog |
| #4 partial update 未过滤 undefined | P2 / CR TODO | 已追加 **TODO-009** 到 CR TODO backlog |
| #5 迁移 AC 测试证据不足 | P2 / CR TODO | 已追加 **TODO-010** 到 CR TODO backlog |

### CR TODO 追加记录

新增 4 项 CR TODO（[cr-todo-backlog.md](../../cr-rules/cr-todo-backlog.md)）：
- **TODO-007**：旧库升级路径（pre-release 直接重写约定文档化）— 首个稳定 release 前处理
- **TODO-008**：`parseJsonMetadata` 未校验结果为非 null 对象 — 与写入端对称校验捆绑
- **TODO-009**：`updateDocument`/`updateRelation` 未过滤 `undefined` 字段 — 一行 filter 修复
- **TODO-010**：迁移行为 AC 测试证据不足（3 个专项用例） — Story 1-4 收尾补全

### 门禁验证状态（复核）

| 检查项 | 结果 |
|--------|------|
| `npx vitest run` | ✅ 198 tests passed（Round 1 修复后验证，Round 2 未引入变更） |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ ESM + DTS build success，`dist/` 无 .sql 依赖 |
