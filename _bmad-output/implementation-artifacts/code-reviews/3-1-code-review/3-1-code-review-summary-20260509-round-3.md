---
Story: 3-1
Round: 3
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为第 3 轮复审。Round 2 的 2 个低严重度问题均已修复并有回归测试覆盖；三层审查未发现阻塞问题或功能回归。`npm test`、`npm run lint`、`npm run type-check`、`npm run build` 均通过。

结论：**通过（非阻塞）**。本轮新增 2 个低严重度 patch 项，均为测试覆盖增强，不影响 Story 3.1 当前验收通过。

## 上轮问题回顾

### 已修复

1. Round 2 / Finding #1 — projectRoot 外路径会以 `../` 形式进入 QueryService
   - 修复位置：`src/cli/commands/query.ts` 的 `normalizeQueryDocPath(projectRoot, docPath)` 已拒绝空路径、`..`、以及 `../` 前缀路径，并在 `serviceFactory` 调用前抛出 `ConfigError`。
   - 验证结果：`tests/unit/cli/commands/query.test.ts` 覆盖项目外相对路径 `../outside.md` 和项目外绝对路径 `/outside.md`，并断言不会初始化 service。

2. Round 2 / Finding #2 — 默认 QueryService 未关闭底层 SQLite repository
   - 修复位置：`src/services/query-service.ts` 新增 `close()`，转发到底层 `repository.close()`；CLI 的 `finally` 块继续调用 `service?.close?.()`。
   - 验证结果：`tests/unit/services/query-service.test.ts` 覆盖 `QueryService.close()` 转发；`tests/unit/cli/commands/query.test.ts` 覆盖 query 成功和失败路径都会调用 service `close()`。

### 仍为非阻塞待办

无。Round 2 的 2 个发现均已修复。

## 新发现

### 1. [低][新] `CORD_QUERY_002` 关系端点缺失错误路径缺少测试

- **来源**：blind + acceptance
- **分类**：patch

- **证据**
  - `src/services/query-service.ts` 的 `resolveTargetPath()` 在关系端点文档不存在时会抛出 `QueryError`，错误码为 `CORD_QUERY_002`。
  - `tests/unit/services/query-service.test.ts` 当前覆盖了源文档不存在的 `CORD_QUERY_001`，但未覆盖关系边指向不存在目标文档的 `CORD_QUERY_002` 分支。

- **影响**
  - 当前代码逻辑清晰，未发现实现错误；风险在于该错误分支没有回归测试，未来修改时可能破坏错误码、suggestion 或异常类型而不被测试捕获。

- **建议**
  - 补充一个服务层测试：构造存在源文档、但关系端点目标文档不存在的仓储数据，断言抛出 `QueryError` 且 `code === 'CORD_QUERY_002'`，并包含建议操作。

### 2. [低][新] `--json` 错误输出缺少测试覆盖

- **来源**：edge + acceptance
- **分类**：patch

- **证据**
  - `src/cli/commands/query.ts` 的 `writeFailure()` 支持 `--json` 错误输出，并通过 `toErrorPayload()` 保留 `message`、`code`、`suggestion`。
  - `tests/unit/cli/commands/query.test.ts` 当前覆盖了成功路径 `--json` 输出，但未覆盖 `QueryError` 或 `ConfigError` 在 `--json` 模式下的 stderr JSON 结构。

- **影响**
  - 机器可读错误输出目前看起来正确，但缺少测试保护；后续维护中若破坏 `code` / `suggestion` 序列化，现有测试无法发现。

- **建议**
  - 补充 CLI 测试：`--json` + `QueryError` 时 stderr JSON 包含 `message`、`code`、`suggestion`；可选再覆盖 `--json` + 无效 `--type` / 项目外路径的 `ConfigError` JSON 输出。

## 已忽略项

### `normalizeQueryDocPath` 未特殊拒绝 `.` 路径

- **来源**：edge
- **处理**：dismiss
- **理由**：Story 3.1 和 `QueryInput` schema 只要求非空文档路径，并未要求 CLI 对“文件 vs 目录”做文件系统级校验。`.` 代表项目根目录，会通过仓储精确查询并得到正常的 `CORD_QUERY_001` 文档不存在结果；它不会造成 projectRoot 越界，也不会绕过 Round 2 修复目标。因此不作为本轮缺陷输出。

## 验证摘要

- ✅ `npm test -- tests/unit/services/query-service.test.ts tests/unit/schemas/query-input.test.ts tests/unit/cli/commands/query.test.ts tests/unit/cli/index.test.ts` 通过（45 / 45）
- ✅ `npm test` 通过（290 / 290）
- ✅ `npm run lint` 通过
- ✅ `npm run type-check` 通过
- ✅ `npm run build` 通过

## 通过项

- AC1-AC3：`QueryService` 实现一跳双向关系查询，结果字段完整，并支持关系类型过滤。
- AC4-AC6：`cord query <doc>` 已注册，CLI 保持薄壳，支持人类可读表格和成功路径 `--json` 输出。
- AC7：服务测试继续覆盖一跳查询 p95 < 1ms。
- AC8：文档不存在时抛出 `QueryError`，包含 `code` 和 `suggestion`，并符合 `[错误码] 错误描述 → 建议操作` 格式。
- AC9-AC10：默认过滤 `status='deprecated'`，`--include-deprecated` / `includeDeprecated=true` 可返回 deprecated 关系并保留 status 字段。
- AC11：服务、schema、CLI 命令、CLI 入口相关测试覆盖正常查询、类型过滤、空结果、文档不存在、deprecated 默认过滤与 includeDeprecated 可见。
- Round 2 修复：项目外路径拒绝和默认 repository close 生命周期均已复核通过。

## 结论

- **结论：通过（非阻塞）**
- **阻塞项**：无
- **建议**：将本轮 2 个低严重度新增发现作为后续 patch/TODO 处理；它们均为测试覆盖增强，不影响 Story 3.1 当前交付判断。
