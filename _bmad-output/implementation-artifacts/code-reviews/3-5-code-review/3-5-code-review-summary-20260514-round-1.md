---
Story: 3-5
Round: 1
Date: 2026-05-14
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成（Blind Hunter / Edge Case Hunter / Acceptance Auditor），`npm test`、`npm run lint`、`npm run build` 均通过。本轮未发现测试或构建门禁失败，但发现 3 个中优先级 patch 问题和 1 个低优先级 patch 问题；建议修复中优先级问题后再进入 CR 评估/收尾。

## 新发现

### 1. [中] `cord status` 在查看状态时会创建 `.cord/cord.db` 并触发迁移

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/cli/commands/status.ts:61-65` 中 `createDefaultStatusService()` 对 `projectRoot/.cord` 执行 `mkdirSync(..., { recursive: true })`，随后用 `.cord/cord.db` 构造 `SqliteGraphRepository`。
  - `src/repositories/sqlite-graph-repository.ts:29-36` 中仓库构造函数会打开 SQLite 数据库并运行 `runMigrations(this.db)`。

- **影响**
  - `cord status` 是查看状态的命令，但在未初始化项目中会创建 `.cord` 和数据库文件；在旧数据库上会先执行迁移，再报告 `migrationVersion`，掩盖执行前的真实状态。
  - 这也让“未初始化/尚未扫描”和“已初始化但空图谱”的状态边界变得不清晰。

- **建议**
  - 对 `status` 增加只读路径：数据库文件不存在时直接返回空图谱/未初始化状态，不创建 `.cord` 或 `cord.db`。
  - 若数据库存在，避免在 status 路径隐式迁移；可新增只读仓库打开方式，或在输出中明确区分“检查前迁移版本”和“已迁移后版本”。
  - 补充测试：未初始化项目执行 `cord status --json` 后不得创建 `.cord/cord.db`。

### 2. [中] `StatusService` 状态快照由多次非事务读取拼装，可能输出互相矛盾的指标

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/status-service.ts:36-68` 中先读取 `documents`、`relations`、`syncStates`，再独立调用 `getDocumentCount()`、`getRelationCount()`、`getMigrationVersion()`。
  - `relationsByType`、`staleRelations`、`orphanedNodes` 使用前面读到的数组计算，而 `documentCount` / `relationCount` 来自后续 count 查询。

- **影响**
  - 扫描或重建同时写入时，`relationCount` 可能来自新表状态，但 `relationsByType` / `staleRelations` 仍来自旧关系数组，健康检查会显示自相矛盾的结果。

- **建议**
  - 在 `repository.transaction()` 中读取同一快照，或新增 repository 级 status snapshot 方法。
  - 若保留数组读取，可从同一批 `documents.length` / `relations.length` 派生 count，避免重复查询产生口径漂移。
  - 补充测试：用可变 fake repository 模拟两次读取之间数据变化，断言输出来自同一快照。

### 3. [中] 悬空关系会把仍存在的一端计为 connected，导致 `orphanedNodes` 低估

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/services/status-service.ts:45-57` 中发现 dangling edge 后，仍会把存在的 `sourceDocId` 或 `targetDocId` 加入 `connectedDocumentIds`。
  - `tests/unit/services/status-service.test.ts:283-318` 的 dangling 场景里 `doc-a` 同时还有另一条有效/过时关系，未覆盖“某节点唯一关系就是 dangling”的情况。

- **影响**
  - 若某文档唯一关系指向缺失节点，它会被排除在 `orphanedNodes` 之外；AC4 要报告孤立节点和悬空关系边，这会低估“没有有效图谱连接”的节点数量。

- **建议**
  - 只有当关系两端文档都存在时，才将 source/target 加入 `connectedDocumentIds`。
  - 补充测试：一个文档只连接到缺失目标时，应同时产生 `danglingEdges = 1`，且该文档是否计为 orphaned 需按 AC4 口径明确断言。

### 4. [低] `finally` 中 `close()` 抛错会覆盖成功输出或原始错误

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/cli/commands/status.ts:56` 在 `finally` 中直接调用 `service?.close?.()`。
  - `tests/unit/cli/commands/status.test.ts:169-197` 只覆盖 close 被调用，没有覆盖 close 失败。

- **影响**
  - 如果 close 抛错，成功路径会变成未捕获异常；失败路径也会丢失原始错误上下文，影响 CLI 诊断稳定性。

- **建议**
  - 捕获 close 错误，避免覆盖业务错误；必要时仅在没有原始错误时报告 close 失败。
  - 补充 close 失败路径测试。

## 验证摘要

- `npm test` ✅ 通过（355 / 355，38 个 test files；输出包含一次非阻塞 scan pipeline warning）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 定向复现：未执行额外复现；本轮基于 diff、代码上下文、三层审查输出和现有测试结果完成判断。

## 通过项

- Acceptance Auditor 未发现 AC 覆盖缺口：Story 3.5 的 StatusService、CLI dashboard、`--json`、过时关系、空图谱、迁移版本显示均有对应实现或测试覆盖。
- `createdAt` 过时关系口径与 AC3 一致：实现使用 `Date.parse(relation.createdAt)` 与 `lastObservedMtimeMs` 比较。
- `migrationVersion` 当前按 `schema_migrations` 记录数返回，符合 Story AC5 “已执行迁移版本数”的描述。
- 配置状态字段包含 `configFilePath`、`framework`、`scanPaths`、`excludePaths`、`confidenceThreshold`，覆盖 AC2。
