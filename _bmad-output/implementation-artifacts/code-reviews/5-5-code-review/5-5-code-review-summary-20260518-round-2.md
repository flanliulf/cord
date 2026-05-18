---
Story: 5-5
Round: 2
Date: 2026-05-18
Model Used: GitHub Copilot (model identifier unavailable in VS Code session)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Agent 并行子代理调度能力在当前环境不可用，已按 `bmenhance-cr-01-reviewer` 降级规则串行执行 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三层审查；三层均完成。Round 1 的 2 个 P1 修复项中，Hooks 触发验证已闭合；三大 IDE MCP 验证仍未完全闭合，因为新增矩阵测试只校验生成配置形状，随后仍直接连接 in-memory MCP server，没有通过生成的 IDE `command/args` 启动 stdio MCP server。`npm run lint` 与 `npm run build` 通过，Story 5-5 定向测试通过；全量 `npm test` 仍失败于既有 QueryService 性能阈值波动。当前仍存在 1 个上轮遗留 `patch` 阻塞项，因此本轮建议：不通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — AC7 的 Hooks “触发”只验证了文件存在，没有验证落盘后会调用影响分析
   - `tests/unit/adapters/ide.test.ts:123-124` 已将 Claude Code `hooks.PostToolUse` 提升为精确断言，覆盖 `matcher: 'Write|Edit'` 与 `command: './.claude/hooks/cord-post-edit.sh "$TOOL_INPUT_PATH"'`。
   - `tests/unit/adapters/ide.test.ts:132-156` 新增 hook 执行性测试，生成 hook 后注入 stub `cord` 到 `PATH`，执行 `.claude/hooks/cord-post-edit.sh docs/example.md`，并断言实际参数为 `impact --json docs/example.md`。
   - 验证结果：`npx vitest run tests/unit/adapters/ide.test.ts tests/integration/mcp/server.test.ts tests/unit/adapters/skills-generator.test.ts` 通过，24 / 24 tests passed。

### 仍为非阻塞待办

1. Round 1 已知既有问题 — QueryService 三跳遍历性能阈值测试波动
   - 维持既有评估结论：非 Story 5-5 改动引入，属于既有测试稳定性问题。
   - 本轮全量 `npm test` 仍复现该波动：418 / 419 通过，失败项为 `tests/unit/services/query-service.test.ts > QueryService > keeps three-hop traversal performance within 10% on indexed in-memory adjacency lookup`。

## 新发现

### 1. [中] Round 1 / Finding #2 仍未闭合：三大 IDE MCP 测试没有通过生成的 command/args 启动 MCP server

- **来源**：auditor+edge
- **分类**：patch
- **标记**：上轮遗留

- **证据**
  - Round 1 Finding #2 要求补齐 Claude Code / Cursor / VS Code Copilot 三大 IDE MCP 端到端验证证据；Round 1 evaluation 将其确认为 P1。
  - `tests/integration/mcp/server.test.ts:209-253` 新增的矩阵测试会分别生成三种 IDE 配置并读取 `entry`，随后只断言 `command: 'node'`、`args: ['./dist/mcp/server.js']`，以及 VS Code Copilot 的 `type: 'stdio'`。
  - 同一测试在 `tests/integration/mcp/server.test.ts:248-253` 之后调用 `connectTestServer(projectRoot)`、`client.listTools()`、`expectCoreToolsWork(connection, projectRoot)`；但 `connectTestServer` 在 `tests/integration/mcp/server.test.ts:27-36` 中直接调用 `createCordMcpServer({ projectRoot })` 并使用 `InMemoryTransport.createLinkedPair()`，没有执行刚刚读取到的 `entry.command` / `entry.args`。
  - 因此该测试证明了 “IDE 配置文件写出了预期字符串” 与 “内存传输下 MCP server 工具链可用”，但没有证明 “三种 IDE 生成配置可实际启动 stdio MCP server 并完成工具注册与调用”。

- **影响**
  - AC6/AC7 与 NFR11 的核心证据仍不完整：如果生成配置中的相对路径、cwd、stdio 启动入口、打包产物路径或真实进程启动行为发生漂移，当前测试仍可能通过。
  - 这正是 Round 1 Finding #2 的风险面，因此该 P1 不能判定闭合。

- **建议**
  - 将三 IDE MCP 矩阵测试改为真正消费生成的 `entry.command` / `entry.args`：用 MCP SDK 的 stdio/client transport 或等价子进程方式启动 `node ./dist/mcp/server.js`，再执行 `listTools()` 与 `init_graph` / `query_relations` / `analyze_impact` / `sync_docs` 最小调用链。
  - 若测试夹具项目中没有 `./dist/mcp/server.js`，应在测试中显式准备可执行的 dist 入口，或调整 adapter 配置契约使其指向可由真实 IDE 启动的包入口；不要用 `createCordMcpServer()` 的 in-memory 直连替代 IDE 配置验证。

## 验证摘要

- `npm run lint` ✅ 通过。
- `npm run build` ✅ 通过；生成 `dist/cli/index.js` 与 `dist/mcp/server.js`。
- `npm test` ❌ 418 / 419 通过；失败项为既有 QueryService 三跳遍历性能阈值波动，断言 `0.16779199999996308 <= 0.0813086999999939` 未满足。
- `npx vitest run tests/unit/adapters/ide.test.ts tests/integration/mcp/server.test.ts tests/unit/adapters/skills-generator.test.ts` ✅ 通过，3 / 3 test files，24 / 24 tests。
- 额外复核：
  - Round 1 Finding #1 的 hook 配置精确断言和脚本执行性测试均已存在并通过。
  - Round 1 Finding #2 的新增矩阵测试未消费生成的 MCP `command/args` 启动 server，仍未覆盖 stdio 进程入口。

## 通过项

- `src/adapters/ide/claude-code.ts` 已将 Skills 生成委托给 `generateClaudeSkills()`，保持 `InitService -> IIdeAdapter.generateSkills?()` 编排链。
- `src/adapters/ide/skills-generator.ts` 覆盖影响分析、关系查询、图谱初始化、同步建议 4 个意图场景，并在每个 Skill 中包含 Trigger Conditions、MCP Tool Sequence、Expected Output Format。
- `tests/unit/adapters/skills-generator.test.ts` 覆盖四个 Skills 文件路径、必需章节、命名 schema、`relationId` 与 `sync_docs` 单文档调用提示。
- Round 1 Finding #1 已闭合，Hook command 漂移和脚本参数传递已有自动化回归保护。
- 已知既有问题（defer）：QueryService 性能阈值波动仍存在，但不属于 Story 5-5 本轮改动引入。

## 结论

- **结论：不通过**
- **阻塞项**：1 个上轮遗留 `patch` 项：Round 1 Finding #2（三大 IDE MCP 端到端验证证据不足）仍未完全闭合。
- **建议**：补齐真正通过生成的 IDE MCP `command/args` 启动 stdio server 的三 IDE 矩阵验证后，再进入下一轮 CR。