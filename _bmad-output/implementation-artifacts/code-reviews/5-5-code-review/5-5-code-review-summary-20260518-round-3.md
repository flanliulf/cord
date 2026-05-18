---
Story: 5-5
Round: 3
Date: 2026-05-18
Model Used: GitHub Copilot (model identifier unavailable in VS Code session)
Type: Code Review Summary
---

## 审查结论

本轮为第 3 轮复审，审查文件路径：`_bmad-output/implementation-artifacts/code-reviews/5-5-code-review/5-5-code-review-summary-20260518-round-3.md`。当前环境未提供独立 Agent 子审查调度能力，本轮按 `bmenhance-cr-01-reviewer` 降级规则在当前上下文中完成 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三维复核。Round 2 的 stdio MCP 修复已闭合：三大 IDE 矩阵测试现在读取生成配置中的 `command/args`，并通过 `StdioClientTransport` 真实启动 `node ./dist/mcp/server.js` 后执行 `listTools()` 与核心工具链验证；相关定向测试通过。当前不通过，原因是本轮发现 1 个新的 `patch` 门禁问题：`npm run lint` 因 catch 重抛未保留 `cause` 失败。

## 上轮问题回顾

### 已修复

1. Round 2 / Finding #1 — 三大 IDE MCP 测试未通过生成的 command/args 启动 MCP server
   - `tests/integration/mcp/server.test.ts:53-97` 新增 `connectConfiguredStdioServer()`，通过 `StdioClientTransport` 消费传入的 `command` 与 `args`，并以 fixture 项目为 `cwd` 启动 stdio MCP server。
   - `tests/integration/mcp/server.test.ts:223-253` 的 Claude Code / Cursor / VS Code Copilot 矩阵测试读取各 IDE 生成的配置 entry，断言 `command: 'node'` 与 `args: ['./dist/mcp/server.js']`，随后调用 `connectConfiguredStdioServer({ command: entry.command, args: entry.args })`，不再回退到 `connectTestServer()` 的 in-memory 直连。
   - 验证结果：`./node_modules/.bin/vitest run tests/integration/mcp/server.test.ts tests/unit/adapters/ide.test.ts tests/unit/adapters/skills-generator.test.ts` 通过，3 个测试文件、24 个测试全部通过；其中 `tests/integration/mcp/server.test.ts` 7 个测试通过。

2. Round 1 / Finding #1 — AC7 Hooks 触发缺少执行性验证
   - 继续保持闭合。`tests/unit/adapters/ide.test.ts:112-129` 精确断言 Claude Code `hooks.PostToolUse` 的 matcher 与 command；`tests/unit/adapters/ide.test.ts:132-156` 执行生成的 hook 脚本，并断言 stub `cord` 收到 `impact --json docs/example.md`。

### 仍为非阻塞待办

1. Round 1 已知既有问题 — QueryService 三跳遍历性能阈值测试波动
   - 维持既有评估结论：CR TODO / 非阻塞。
   - 本轮全量 `npm test` 仍失败于该既有性能阈值波动：418 / 419 通过，失败项为 `tests/unit/services/query-service.test.ts > QueryService > keeps three-hop traversal performance within 10% on indexed in-memory adjacency lookup`。

## 新发现

### 1. [中][新] stdio MCP 修复引入的错误重抛未保留 cause，导致 lint 门禁失败

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `npm run lint` 失败，ESLint 报错：`tests/integration/mcp/server.test.ts:93:7 error There is no cause attached to the symptom error being thrown preserve-caught-error`。
  - 触发位置在 `connectConfiguredStdioServer()` 的 `catch (error)` 分支：捕获 stdio 连接异常并拼接 stderr 后抛出新的 `Error`，但新错误没有通过 `cause` 关联原始 `error`。
  - 该代码位于 Round 2 修复新增的 stdio MCP helper 中，因此是本轮复审范围内的新质量门禁问题。

- **影响**
  - `npm run lint` 是 CR 模板要求的基础验证命令，当前失败会阻塞 Story 5-5 通过。
  - 丢失原始 `cause` 会削弱 stdio MCP 启动失败时的诊断链路；这正好发生在本轮重点验证的 IDE stdio 启动 helper 上。

- **建议**
  - 在重抛增强错误时保留原始异常，例如使用 `throw new Error(message, { cause: error })`，并保持现有 stderr 追加信息。
  - 修复后重新运行 `npm run lint`、`npm run build`、`npm test` 和 Story 5-5 定向测试。

## 验证摘要

- `npm run lint` ❌ 失败：1 个 error，位置为 `tests/integration/mcp/server.test.ts:93:7`，规则为 `preserve-caught-error`。
- `npm run build` ✅ 通过：ESM 与 DTS 构建完成，生成 `dist/cli/index.js`、`dist/mcp/server.js`、`dist/cli/index.d.ts`、`dist/mcp/server.d.ts`。
- `npm test` ❌ 418 / 419 通过；唯一失败项为既有 QueryService 三跳遍历性能阈值波动，断言 `0.087917 <= 0.0805288` 未满足。全量测试输出中 `tests/integration/mcp/server.test.ts` 7 个测试均通过。
- `./node_modules/.bin/vitest run tests/integration/mcp/server.test.ts tests/unit/adapters/ide.test.ts tests/unit/adapters/skills-generator.test.ts` ✅ 通过：3 / 3 test files，24 / 24 tests。
- 额外复核：Round 2 stdio MCP 修复已闭合；当前阻塞项不是 stdio 链路未执行，而是新 helper 的 lint 规则违规。

## 四桶摘要

| 桶 | 数量 | 摘要 |
|----|------|------|
| decision_needed | 0 | 无需人工裁决项。 |
| patch | 1 | 新增 lint 门禁失败：stdio MCP helper 捕获异常后重抛未保留 `cause`。 |
| defer | 1 | QueryService 三跳遍历性能阈值波动，维持既有非阻塞待办。 |
| dismiss | 0 | 无误报项。 |

## 通过项

- Round 2 的重点修复已闭合：三大 IDE MCP 矩阵测试实际消费生成的 `command/args`，使用 stdio transport 启动 MCP server，并执行 `listTools()` 与 `init_graph` / `query_relations` / `analyze_impact` / `sync_docs` 核心链路。
- Claude Code Hooks 执行性验证持续有效，hook 配置精确断言与脚本执行测试均在定向测试中通过。
- Skills 生成器相关测试持续通过，四个 Skills 文件路径、必需章节、命名 schema 与单文档 `sync_docs` 提示均有覆盖。

## 结论

- **结论：不通过**
- **阻塞项**：1 个新的 `patch` 项：`tests/integration/mcp/server.test.ts` 的 stdio MCP helper 重抛错误未保留 `cause`，导致 `npm run lint` 失败。
- **上轮问题闭合情况**：Round 2 stdio MCP 修复已闭合；Round 1 Hooks 修复保持闭合；QueryService 性能阈值波动维持非阻塞既有待办。
- **建议**：仅修复 lint 门禁问题后进入下一轮 CR 复审；本轮不建议继续修改 stdio MCP 验证逻辑本身。