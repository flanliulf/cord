---
Story: 5-5
Round: 2
Date: 2026-05-18
Model Used: GitHub Copilot (model identifier unavailable in VS Code session)
Review Source: 5-5-code-review-summary-20260518-round-2.md
Review Model: GitHub Copilot (model identifier unavailable in VS Code session)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮复审确认 Round 1 的 Hooks 触发验证已闭合，但三大 IDE MCP 验证仍未通过生成的 IDE `command/args` 启动 stdio MCP server；复审提出 1 个上轮遗留 `patch` 类发现。经独立代码验证，该发现有效，仍属于阻塞交付的验收覆盖缺口；本轮评估决定：**不通过，需修复后复审**。

---

## 上轮问题回顾确认

### Round 1 / Finding #1 — AC7 Hooks 触发缺少执行性验证：已闭合

经代码验证，`tests/unit/adapters/ide.test.ts:112-129` 已将 Claude Code `hooks.PostToolUse` 从宽松存在性断言提升为精确断言，覆盖 `matcher: 'Write|Edit'` 与 `command: './.claude/hooks/cord-post-edit.sh "$TOOL_INPUT_PATH"'`。`tests/unit/adapters/ide.test.ts:132-156` 新增 hook 执行性测试，生成 hook 后注入 stub `cord` 到 `PATH`，执行 `.claude/hooks/cord-post-edit.sh docs/example.md`，并断言实际参数为 `impact --json docs/example.md`。因此 Round 1 Finding #1 可判定为已闭合。

### Round 1 / Finding #2 — 三大 IDE MCP 端到端验证证据不足：未闭合

经代码验证，`tests/integration/mcp/server.test.ts:209-253` 的三 IDE 矩阵测试会读取 Claude Code / Cursor / VS Code Copilot 生成配置，并断言 `command: 'node'`、`args: ['./dist/mcp/server.js']`，以及 VS Code Copilot 的 `type: 'stdio'`；但随后在 `tests/integration/mcp/server.test.ts:248` 调用的是 `connectTestServer(projectRoot)`。该 helper 在 `tests/integration/mcp/server.test.ts:27-36` 中直接调用 `createCordMcpServer({ projectRoot })` 并使用 `InMemoryTransport.createLinkedPair()`，没有执行前面读取到的 `entry.command` / `entry.args`。因此 Round 1 Finding #2 仍未闭合。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-known | QueryService 三跳遍历性能阈值测试波动 | CR TODO / 非阻塞 | 同意维持为非阻塞。该问题已在 Round 1 评估中归类为非 Story 5-5 改动引入的既有测试稳定性问题；Round 2 复审也仅将其列入验证摘要，不应阻塞本 Story 的功能修复路径。 |

---

## 发现 #1 评估

### 审查原文

> **[中] Round 1 / Finding #2 仍未闭合：三大 IDE MCP 测试没有通过生成的 command/args 启动 MCP server**
> - 来源：auditor+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

Story AC6 明确要求 “MCP 验证” 在 3 大 IDE 验证通过，AC7 要求测试覆盖 “Hooks 触发 + Skills 格式 + IDE MCP 验证”（`_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:18-19`）。当前 IDE 配置生成契约本身确实是 `node ./dist/mcp/server.js`：`src/adapters/ide/shared.ts:17-20` 的 `createNodeMcpEntry()` 返回 `command: 'node'` 与 `args: ['./dist/mcp/server.js']`，`src/adapters/ide/shared.ts:23-27` 还为 VS Code Copilot 包装了 `type: 'stdio'`。

但复审指出的测试缺口成立。`tests/integration/mcp/server.test.ts:209-253` 的矩阵测试仅证明三类 IDE 配置文件写出了预期 entry，并在 `tests/integration/mcp/server.test.ts:248-253` 之后复用同一个 in-memory MCP 连接执行 `listTools()` 与核心工具链校验。该连接来自 `tests/integration/mcp/server.test.ts:27-36` 的 `connectTestServer()`，其直接创建 `createCordMcpServer({ projectRoot })` 并使用 `InMemoryTransport.createLinkedPair()`，没有通过子进程或 stdio transport 执行刚读取到的 `entry.command` / `entry.args`。因此当前测试没有证明真实 IDE 配置入口可启动 stdio MCP server。

**严重性判断：合理**

原始严重性为 `[中]`，评估后维持 P1。该问题不是普通测试风格偏好，而是 AC6/AC7 的验收证据缺口：如果 `./dist/mcp/server.js` 相对路径、cwd、stdio 启动入口、打包产物位置或真实进程启动行为发生漂移，当前矩阵测试仍可能通过。由于 Story 明确要求三大 IDE MCP 验证，该缺口应阻塞交付。

**修复建议：可行**

复审建议可行。应让三 IDE 矩阵测试真正消费生成配置中的 `entry.command` / `entry.args`，通过 MCP SDK 的 stdio/client transport 或等价子进程方式启动 `node ./dist/mcp/server.js`，再执行 `listTools()` 与 `init_graph` / `query_relations` / `analyze_impact` / `sync_docs` 最小调用链。若测试夹具中无法直接使用 `./dist/mcp/server.js`，应在测试前显式准备可执行 dist 入口，或明确调整 adapter 配置契约，而不是用 in-memory 直连替代 IDE 配置验证。

**误报评估：非误报**

现有测试确实没有执行 IDE 配置生成出的 `command/args`，因此无法覆盖复审指出的 stdio 进程入口风险；该 finding 不是误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 三大 IDE MCP 测试未通过生成的 command/args 启动 MCP server | [中] | **P1** | 当前矩阵测试只验证配置形状，并继续使用 in-memory MCP server；未证明三 IDE 生成配置可真实启动 stdio MCP server 并完成工具注册与调用。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R1-known | QueryService 三跳遍历性能阈值测试波动 | 既有问题 | **P2** | 同意继续作为非阻塞既有测试稳定性问题跟踪，不属于 Story 5-5 本轮改动引入。 |

### 可忽略（误报）

无。本轮复审 finding 未发现误报。

### 评估决定

- **发现 #1（三大 IDE MCP 测试未通过生成的 command/args 启动 MCP server）**：确认有效，需补齐真实消费 IDE MCP `command/args` 的 stdio 启动验证后复审。
- **Round 1 / Finding #1（AC7 Hooks 触发缺少执行性验证）**：已闭合，无需继续修复。
- **历史 CR TODO（QueryService 性能阈值波动）**：维持非阻塞延期处理，不影响本轮对 Story 5-5 CR finding 的判断。
- **整体决定**：不通过。Story 5-5 仍有 1 个 P1 阻塞项需修复。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-18
- **Model Used**: GPT-5.4
- **Fix Items**: 1

#### Fix #1: 三大 IDE MCP 测试改为通过生成的 command/args 启动 stdio MCP server
- **对应评估项**: 发现 #1（三大 IDE MCP 测试未通过生成的 command/args 启动 MCP server）
- **修改文件**: `tests/integration/mcp/server.test.ts`
- **修复内容**:
	- 保留原有 `connectTestServer()` 供非 IDE 配置用例继续使用，不扩大改动面。
	- 新增基于 `StdioClientTransport` 的 `connectConfiguredStdioServer()`，在 IDE 矩阵测试中实际消费生成配置里的 `command` 与 `args`。
	- 在临时 fixture 项目下补充指向仓库 `dist` 与 `node_modules` 的运行时链接，使 `node ./dist/mcp/server.js` 能以 fixture 目录为 cwd 真实启动 stdio MCP server，并继续对 `listTools()` 与核心工具链执行断言。
- **验证命令**: `./node_modules/.bin/vitest run tests/integration/mcp/server.test.ts`
- **验证结果**: 通过。`tests/integration/mcp/server.test.ts` 共 7 个测试全部通过，其中 IDE MCP 矩阵用例已改为真实 stdio 启动链路验证。
- **结果判定**: 已按评估要求完成修复；本次未处理任何非 evaluation 明确要求的事项。