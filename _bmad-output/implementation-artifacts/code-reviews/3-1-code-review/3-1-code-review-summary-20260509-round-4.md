---
Story: 3-1
Round: 4
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为第 4 轮复审。Round 3 的 2 个低严重度测试覆盖问题均已修复并经三层审查复核通过；Blind Hunter、Edge Case Hunter、Acceptance Auditor 三层均可用。本轮未发现新的阻塞项、中高优先级问题或功能回归。`npm test`、`npm run lint`、`npm run type-check`、`npm run build` 均通过。

结论：**通过**。

## 上轮问题回顾

### 已修复

1. Round 3 / Finding #1 — `CORD_QUERY_002` 关系端点缺失错误路径缺少测试
   - 修复位置：`tests/unit/services/query-service.test.ts` 新增关系端点文档缺失回归测试，构造源文档存在但关系目标文档不存在的内存仓储数据。
   - 验证结果：测试断言抛出 `QueryError`，并校验 `code === 'CORD_QUERY_002'` 与 suggestion `请重新运行 cord scan 重建关系图谱`；定向测试通过。

2. Round 3 / Finding #2 — `--json` 错误输出缺少测试覆盖
   - 修复位置：`tests/unit/cli/commands/query.test.ts` 新增 `--json` 错误输出测试，模拟 `QueryError` 并校验 stderr JSON 载荷。
   - 验证结果：测试断言 stdout 为空，stderr JSON 包含 `message`、`code`、`suggestion`；定向测试通过。

### 仍为非阻塞待办

无。Round 3 的 2 个发现均已修复。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 已忽略项

### 1. CORD_QUERY_002 在 `--json` 模式下缺少单独 CLI JSON 测试

- **来源**：blind
- **处理**：dismiss
- **理由**：CLI JSON 错误序列化对所有 CordError-like 错误使用同一 `toErrorPayload()` 路径，当前已有 `QueryError` JSON stderr 测试覆盖 `message`、`code`、`suggestion` 序列化；`CORD_QUERY_002` 的服务层错误契约也已有专门测试。要求每个 QueryError code 都走一遍 CLI JSON mock 属于重复覆盖，不构成当前缺陷。

### 2. `--include-deprecated` 缺少 CLI 端到端输出测试

- **来源**：blind
- **处理**：dismiss
- **理由**：当前测试分层符合 CLI 薄壳边界：CLI 测试验证 `--include-deprecated` 正确转发到 `QueryInput`，服务层测试验证 deprecated 过滤语义。将服务过滤逻辑复制到 CLI 命令测试会弱化薄壳边界，而不是暴露具体缺陷。

## 验证摘要

- ✅ `npm test -- tests/unit/services/query-service.test.ts tests/unit/cli/commands/query.test.ts` 通过（19 / 19）
- ✅ `npm test -- tests/unit/services/query-service.test.ts tests/unit/schemas/query-input.test.ts tests/unit/cli/commands/query.test.ts tests/unit/cli/index.test.ts` 通过（47 / 47）
- ✅ `npm test` 通过（292 / 292）
- ✅ `npm run lint` 通过
- ✅ `npm run type-check` 通过
- ✅ `npm run build` 通过
- 额外复核：
  - ✅ Round 3 的 `CORD_QUERY_002` 服务层错误分支测试已真实触发 `resolveTargetPath()` 缺失端点分支。
  - ✅ Round 3 的 `--json` 错误输出测试已验证 stderr JSON，且 stdout 保持为空。
  - ✅ Round 2 的项目外路径拒绝与 QueryService close 生命周期仍保持有效。

## 通过项

- AC1-AC3：`QueryService` 实现一跳双向关系查询，输出字段完整，并支持关系类型过滤。
- AC4-AC6：`cord query <doc>` 已注册，CLI 保持薄壳，支持人类可读表格和 JSON 输出。
- AC7：服务测试继续覆盖一跳查询 p95 < 1ms。
- AC8：文档不存在与关系端点缺失均使用 `QueryError`，包含 `code` 和 `suggestion`，错误消息符合 `[错误码] 错误描述 → 建议操作` 格式。
- AC9-AC10：默认过滤 `status='deprecated'`，`--include-deprecated` / `includeDeprecated=true` 可返回 deprecated 关系并保留 status 字段。
- AC11：服务、schema、CLI 命令、CLI 入口相关测试覆盖正常查询、类型过滤、空结果、文档不存在、关系端点缺失、deprecated 默认过滤、includeDeprecated 可见、以及 JSON 成功/错误输出。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：Story 3.1 的 CR reviewer 视角已无新增有效问题；可进入后续 CR 评估/最终化流程。
