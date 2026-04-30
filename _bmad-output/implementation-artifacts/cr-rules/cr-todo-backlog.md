# CR TODO Backlog

跨 Story 延迟改进事项追踪。仅记录非阻塞性问题，阻塞项须在当前 Story CR 流程内解决。

## 统计摘要

| 状态 | 数量 |
|------|------|
| Open | 11 |
| In Progress | 0 |
| Resolved | 0 |
| **合计** | **11** |

---

## Open Items

---

### TODO-001

- **标题**：CLI 与包根导出职责分离 + 二进制 smoke test
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：refactor
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #1 衍生）
- **涉及文件**：
  - `package.json`
  - `src/cli/index.ts`
- **问题描述**：`package.json` 中 `bin.cord` 与 `exports["."]` 同时指向 `dist/cli/index.js`，CLI 可执行入口与包根导出职责混用。此外缺少对已构建 CLI 二进制的 smoke test（如 `node dist/cli/index.js --version`）。
- **建议时机**：首次发布前的发布策略 Story（引入包导出结构重构时一并处理）
- **解决记录**：—

---

### TODO-002

- **标题**：缺少 `prepack`/`prepublishOnly` 与 tarball 校验
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #2）
- **涉及文件**：
  - `package.json`
- **问题描述**：`package.json` 的 `scripts` 中无 `prepack`、`prepare` 或 `prepublishOnly` 钩子。`dist/` 被 `.gitignore` 排除，仅靠 `files: ["dist"]` 声明白名单，不触发构建，存在发布时产物为空的风险。
- **建议时机**：首次发布前的专门 Story（配套 CI 流水线、版本管理、tarball 校验一揽子引入）
- **解决记录**：—

---

### TODO-003

- **标题**：type-check 未覆盖 `tests/` 与配置文件
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #3）
- **涉及文件**：
  - `tsconfig.json`
  - `tests/`
  - `tsup.config.ts`
  - `vitest.config.ts`
- **问题描述**：`tsconfig.json` 的 `include` 仅覆盖 `src/**/*.ts`，`tests/`、`tsup.config.ts`、`vitest.config.ts` 均被排除，导致 `npm run type-check` 无法检测这些文件中的类型错误。
- **建议时机**：引入真实测试代码的 Story（1-2 或 1-3），通过新增 `tsconfig.check.json`（`include` 扩展至 `tests/` 和配置文件）统一处理
- **解决记录**：—

---

### TODO-004

- **标题**：MCP 入口为静默空实现，缺少防御性占位输出
- **状态**：open
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #4）
- **涉及文件**：
  - `src/mcp/server.ts`
- **问题描述**：`src/mcp/server.ts` 当前为仅含注释的占位文件（符合 Task 2.5 显式要求），构建后 `node dist/mcp/server.js` 静默退出（exit code 0），运维层面难以区分"正常启动"与"空实现静默退出"。
- **建议时机**：Epic 5 启动时，将占位文件升级为防御性实现（如 `throw new Error('not implemented')` 或向 stderr 输出提示信息）
- **解决记录**：—

---

### TODO-005

- **标题**：`applyVerboseFlag` 在 `parse()` 之后调用，首条 subcommand action 内 `logger.debug` 会被吞掉
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-2 / Round 3 / 2026-04-26（发现 #2；R3~R5 评估轮次均维持降级）
- **涉及文件**：
  - `src/cli/index.ts`
  - `src/cli/verbose.ts`
- **问题描述**：`runCli()` 中 `program.parse(process.argv)` 先于 `applyVerboseFlag(program.opts(), process.env)` 执行。当前 skeleton 无任何 `.action()` 注册，AC5 字面满足，问题不出现。但一旦引入真实 subcommand action，action handler 内部的 `logger.debug()` 调用将在 `--verbose` 下被吞掉（verbose 尚未生效），排障日志全部丢失。
- **建议时机**：引入首条 subcommand action 的 Story（如 `cord scan` 或 `cord init`），改用 `program.hook('preAction', () => applyVerboseFlag(...))` 或在 action 执行前预先从 `process.argv` / `process.env` 判断并设置 verbose
- **解决记录**：—

---

### TODO-006

- **标题**：schema 时间字段缺 ISO 8601 约束；document.path / scan.projectRoot 缺路径格式约束
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-3 / Round 1 / 2026-04-27（发现 #3；Round 2、Round 3 均维持非阻塞）
- **涉及文件**：
  - `src/schemas/document.ts`
  - `src/schemas/relation.ts`
  - `src/schemas/scan-input.ts`
- **问题描述**：`createdAt`/`updatedAt` 仅用 `z.string().min(1)` 校验，未约束 ISO 8601 格式（应改为 `z.string().datetime()`）；`document.path` 未约束相对路径语义；`scan.projectRoot` 未约束绝对路径语义。非法时间戳会污染排序和增量扫描判断，非法路径会破坏以路径为主键的查询/缓存键值一致性。
- **建议时机**：首次真正消费上述 schema 字段的 Story（如 1-4 扫描器或查询模块），在引入真实路径处理逻辑时，叠加 `z.string().datetime()`、相对路径 `.refine()`、绝对路径 `.refine()` 约束，并同步补对应回归测试
- **解决记录**：—

---

### TODO-007

- **标题**：旧库升级路径未走 002 增量迁移（pre-release schema 直接重写约定文档化）
- **状态**：open
- **优先级**：P2（首个稳定 release 前处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #1）
- **涉及文件**：
  - `src/repositories/migrations/runner.ts`
  - `src/repositories/migrations/001-initial-schema.sql`
  - `src/repositories/migrations/001-initial-schema.ts`
- **问题描述**：v0.1 pre-release 阶段多次对 `001-initial-schema` 直接重写（Round 1：唯一索引加 source 维度 + relations.source/status CHECK 约束；Round 3：relations.relation_type CHECK 约束），均未新增 `002` 增量迁移。`runMigrations` 的幂等跳过机制意味着「已跑过旧版 v1」的本地开发库无法自动升级到含完整约束的新 schema。当前 v0.1 pre-release 无任何在野老库，场景不成立。
  - **002 需覆盖的完整修复范围**：`DROP INDEX idx_relations_unique_pair / CREATE UNIQUE INDEX`（加 source 维度）+ `relations.source` CHECK + `relations.status` CHECK + `sync_states.status` CHECK + `relations.relation_type` CHECK（共 5 项约束 + 1 个索引重建）。
- **建议时机**：首个稳定 release（或确认有用户已用 0.x schema）前，新增 `002-fix-v1-baseline.sql` 增量迁移，覆盖上述全部范围，并在 Tech Notes 中记录「pre-release 直接重写 schema，首个稳定 release 后切换为只增不改的增量模式」约定。
- **解决记录**：—

---

### TODO-008

- **标题**：`parseJsonMetadata` 未校验解析结果必须是非 null 对象（不含数组、原始值）
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #3）
- **涉及文件**：
  - `src/repositories/mappers.ts`
- **问题描述**：`parseJsonMetadata` 仅做 `JSON.parse(raw) as Record<string, unknown>`，未校验解析结果的形态。`[]`、`123`、`"text"`、`null` 等合法 JSON 值会被错误地伪装成对象穿透；写入端（`documentToRow` / `relationToRow`）同样未做对称形态约束，只在读取端防守存在「只防读、不防写」的不对称性。
- **建议时机**：与「写入端 metadata 对称形态校验」捆绑处理（同一 PR），在 `parseJsonMetadata` 增加 `parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)` 校验，写入端 mapper 做同等 TS 类型/运行时断言，并补对应失败用例。
- **解决记录**：—

---

### TODO-009

- **标题**：`updateDocument` / `updateRelation` 未过滤 `undefined` 字段，可能误清空可选列
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #4）
- **涉及文件**：
  - `src/repositories/sqlite-graph-repository.ts`
- **问题描述**：`updateDocument` 与 `updateRelation` 在 spread 时不过滤 `undefined`：若调用方显式传 `{ title: undefined }`，会覆盖 `existing.title` 为 `undefined`，最终 mapper 转为 `null` 写库；若 `path`（NOT NULL 列）被传 `undefined`，会触发约束错误。TypeScript `Partial<T>` 允许 `undefined`，但当前实现未对此做防御。
- **建议时机**：Story 1-4 收尾或下一个消费 `updateDocument`/`updateRelation` 的 Story，添加 `Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined))` 一行过滤，并补「显式传 undefined 不应清空字段」回归测试。
- **解决记录**：—

---

### TODO-010

- **标题**：迁移行为 AC 测试证据不足（未直接断言迁移版本记录、失败回滚、WAL 模式）
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #5）
- **涉及文件**：
  - `tests/unit/repositories/sqlite-graph-repository.test.ts`
- **问题描述**：
  - AC#5：迁移测试只验证 `:memory:` 新库不抛错，未直接断言 `schema_migrations` 表仅有一行 version=1（幂等跳过验证）。
  - AC#6：事务测试是业务事务，未模拟「迁移 SQL 故意抛错 → schema_migrations 与 schema 一并回滚」场景。
  - AC#7：WAL 测试只验证读写正常，未直接 `db.pragma('journal_mode', { simple: true })` 断言返回 `'wal'`。
- **建议时机**：Story 1-4 收尾，补 3 个专项测试用例：(1) 临时文件 DB 二次 reopen 断言 `schema_migrations` 一行；(2) 注入失败 SQL 验证回滚；(3) `repo['db'].pragma('journal_mode', { simple: true }) === 'wal'` 直接断言。
- **解决记录**：—

---

### TODO-011

- **标题**：Mapper 错误缺少统一仓储层错误类型（`RepositoryError`），上层只能字符串匹配错误类别
- **状态**：open
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 3 / 2026-04-28（发现 #2）
- **涉及文件**：
  - `src/repositories/mappers.ts`
- **问题描述**：`mappers.ts` 中 JSON/枚举校验失败时直接 `throw new Error(...)`，缺少统一的 `RepositoryError` / `StorageError` 类型，上层如需稳定识别"数据损坏 / 枚举越界 / metadata 解析失败"等错误类别，只能依赖字符串匹配。这会弱化后续 CLI、日志与诊断体验的一致性，也让错误类型的集成测试缺乏稳定断言点。
- **建议时机**：引入 CLI 错误处理或日志规范的 Story（如错误码统一 / 诊断体验 Story），与 CLI 诊断体验一并引入 `RepositoryError`，保留 `table/id/column/cause` 等结构化字段，并为上层消费路径补充错误类型断言测试。
- **解决记录**：—

---

## Resolved Items

（暂无）
