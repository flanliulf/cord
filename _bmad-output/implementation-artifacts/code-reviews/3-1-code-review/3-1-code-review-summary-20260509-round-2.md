---
Story: 3-1
Round: 2
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 3 个低严重度问题均已修复并有回归测试覆盖；`npm test`、`npm run lint`、`npm run build`、`npm run type-check` 均通过。本轮未发现阻塞问题；新增 2 个低严重度非阻塞 patch 项，建议进入 CR TODO 或下一轮小补丁。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 关系类型 schema 通过 Object.values 退化为 string 类型契约
   - 修复位置：`src/schemas/query-input.ts` 改为显式 `relationTypeValues` 字面量元组，并通过 `satisfies readonly [RelationType, ...RelationType[]]` 保持 `QueryInput.type` 的编译期联合类型。
   - 验证结果：`tests/unit/schemas/query-input.test.ts` 增加 `RelationType | undefined` 赋值断言；`npm run type-check` 通过。

2. Round 1 / Finding #2 — 无效 `--type` 会先初始化数据库再触发 schema 校验
   - 修复位置：`src/cli/commands/query.ts` 调整为先 `validateQueryInput(...)`，再调用 `serviceFactory(projectRoot)`。
   - 验证结果：`tests/unit/cli/commands/query.test.ts` 覆盖无效 `--type invalid_type` 不调用 `serviceFactory`，并返回 exit code 2。

3. Round 1 / Finding #3 — 查询 `docPath` 未规范化，常见 `./` 或绝对路径会误报文档不存在
   - 修复位置：`src/cli/commands/query.ts` 新增 `normalizeQueryDocPath(projectRoot, docPath)`，将 CLI 输入转换为 project-relative POSIX 路径后传给 QueryService。
   - 验证结果：`tests/unit/cli/commands/query.test.ts` 覆盖 `./docs/source.md` 归一化为 `docs/source.md`。

### 仍为非阻塞待办

无。Round 1 的 3 个发现均已修复。

## 新发现

### 1. [低][新] projectRoot 外路径会以 ../ 形式进入 QueryService

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/cli/commands/query.ts:78-80` 中 `normalizeQueryDocPath(projectRoot, docPath)` 使用 `resolve(projectRoot, docPath)` + `relative(projectRoot, absoluteDocPath)` 归一化路径。
  - 当用户传入 `../outside.md` 或 projectRoot 外绝对路径时，归一化结果会是 `../outside.md` 这类路径，并继续传入 QueryService。

- **影响**
  - 当前实现不会访问该路径对应的文件系统，只会按仓储 path 精确查询，因此不构成阻塞或安全问题；但 CLI 未显式拒绝项目外路径，错误语义会退化为普通 `CORD_QUERY_001` 文档不存在，诊断不够清晰。

- **建议**
  - 在 `normalizeQueryDocPath` 中显式拒绝 `relativePath === ''`、`relativePath === '..'` 或 `relativePath.startsWith('../')` 的项目外输入，并返回 `ConfigError`。
  - 补充测试：`../outside.md` 与 projectRoot 外绝对路径不调用 `serviceFactory`，并输出稳定的配置错误。

### 2. [低][新] 默认 QueryService 未关闭底层 SQLite repository

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/cli/commands/query.ts:70-75` 的默认工厂返回 `new QueryService(new SqliteGraphRepository(dbPath))`。
  - `QueryService` 没有 `close()` 方法；因此 CLI action 的 `finally { service?.close?.(); }` 对默认服务不会关闭底层 SQLite 连接。

- **影响**
  - CLI 单次进程退出时影响有限，但在测试、嵌入式 CLI program 或长生命周期进程中可能留下 SQLite 连接资源；同时 `close?()` 接口暗示默认实现也应遵守资源释放契约。

- **建议**
  - 让默认工厂返回带 `close()` 的适配对象，或为 `QueryService` 注入并转发 repository lifecycle。
  - 补充测试：默认/注入 service 的 `close()` 在成功和错误路径均被调用。

## 验证摘要

- ✅ `npm test` 通过（285 / 285）
- ✅ `npm run lint` 通过
- ✅ `npm run build` 通过
- ✅ `npm run type-check` 通过
- 额外复核：
  - ✅ `npm test -- tests/unit/services/query-service.test.ts tests/unit/schemas/query-input.test.ts tests/unit/cli/commands/query.test.ts tests/unit/cli/index.test.ts` 通过（40 / 40）
  - ✅ Round 1 三项修复均由 Acceptance Auditor 复核为已修复。

## 通过项

- AC1-AC3：一跳双向关系查询、结果字段完整、关系类型过滤保持通过。
- AC4-AC6：CLI query 命令注册、表格输出、JSON 输出保持通过。
- AC7：当前测试口径下一跳查询 p95 < 1ms 仍有覆盖。
- AC8：文档不存在 `QueryError` 的 `code` / `suggestion` / message 格式保持通过。
- AC9-AC10：默认过滤 deprecated，`--include-deprecated` 可见 deprecated 关系保持通过。
- AC11：服务、schema、CLI 命令、CLI 入口相关测试覆盖已扩展到 40 个定向用例。

## 结论

- **结论：通过（非阻塞）**
- **阻塞项**：无
- **建议**：将本轮 2 个低严重度新发现作为非阻塞 patch/TODO 处理；若希望 Story 3.1 完全清零 CR 项，可优先补默认 repository close 和项目外路径拒绝测试。
