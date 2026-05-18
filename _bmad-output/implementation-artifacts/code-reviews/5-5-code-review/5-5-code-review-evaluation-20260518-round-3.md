---
Story: 5-5
Round: 3
Date: 2026-05-18
Model Used: GitHub Copilot (model identifier unavailable in VS Code session)
Review Source: 5-5-code-review-summary-20260518-round-3.md
Review Model: GitHub Copilot (model identifier unavailable in VS Code session)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。本轮 summary 包含 1 个新的 `patch` 发现：stdio MCP helper 捕获异常后重抛未保留 `cause`，导致 `npm run lint` 门禁失败；另有 1 个历史 CR TODO：QueryService 三跳遍历性能阈值波动。经独立核对，新增发现有效，整体评估结论为不通过。

---

## 上轮问题回顾确认

### Round 2 / Finding #1：三大 IDE MCP 测试未通过生成的 command/args 启动 MCP server：已闭合

经代码核对，当前集成测试已在 Claude Code、Cursor、VS Code Copilot 三个 adapter case 中分别读取生成配置，并断言 `command: 'node'` 与 `args: ['./dist/mcp/server.js']`；随后调用 `connectConfiguredStdioServer({ projectRoot, command: entry.command, args: entry.args })`，再通过 `listTools()` 和 `expectCoreToolsWork()` 验证同一 server 工具链。证据位于 `tests/integration/mcp/server.test.ts:264-314`。该回归点已从 in-memory 直连转为消费生成的 stdio 配置，第三轮 summary 的闭合判断准确。

### Round 1 / Finding #1：AC7 Hooks 触发缺少执行性验证：持续闭合

经代码核对，Claude Code adapter 测试继续断言 `hooks.PostToolUse` 的 matcher 与 command，并验证 hook 文件存在；另一个测试直接执行生成的 `cord-post-edit.sh`，用 stub `cord` 断言参数为 `impact --json docs/example.md`。证据位于 `tests/unit/adapters/ide.test.ts:112-156`。第三轮 summary 判断该项持续闭合是准确的。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-历史 | QueryService 三跳遍历性能阈值测试波动 | CR TODO / 非阻塞 | 同意维持延期项。该测试仍存在严格的 `largeGraphP95 <= smallGraphP95 * 1.1` 性能阈值断言，证据位于 `tests/unit/services/query-service.test.ts:670-676`。第三轮 summary 报告的全量 `npm test` 单项波动属于既有性能阈值问题，不是本轮 stdio MCP 修复新增的功能回归。 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] stdio MCP 修复引入的错误重抛未保留 cause，导致 lint 门禁失败**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`connectConfiguredStdioServer()` 的 `catch (error)` 分支会在捕获连接异常后关闭 transport，并在存在 stderr 时抛出一个新的 `Error`，但新错误只拼接了原始 `error.message` 与 stderr 文本，没有通过 `cause` 保留原始异常链。证据位于 `tests/integration/mcp/server.test.ts:82-94`。我也只读运行了 `npm run lint`，当前仍报告 `tests/integration/mcp/server.test.ts:93:7` 的 `preserve-caught-error` 错误，第三轮 summary 对 lint 门禁失败的描述准确。

**严重性判断：合理**

原始严重性标为 `[中][新]` 合理。该问题不是业务行为错误，但会导致项目基础质量门禁 `npm run lint` 失败，阻塞 Story 5-5 交付；同时它发生在本轮重点补强的 stdio MCP 启动 helper 中，会削弱连接失败时的诊断链路。因此评估后按 P1 处理。

**修复建议：可行**

审查建议使用 `throw new Error(message, { cause: error })` 保留原始异常，同时保留 stderr 追加信息。该建议与当前代码结构匹配，修复范围可局限在 catch 分支，不需要改变 stdio MCP 验证逻辑本身。

**误报评估：非误报**

代码证据和 lint 复核均支持该发现；来源为 `blind+auditor`，且分类为明确 `patch`，可信度高。该项不是误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | stdio MCP helper 重抛增强错误未保留 `cause` | [中][新] | **P1** | 当前 `npm run lint` 仍因 `preserve-caught-error` 失败，阻塞 Story 5-5 交付。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R1-历史 | QueryService 三跳遍历性能阈值测试波动 | 既有问题 | **P2** | 同意维持历史 CR TODO；该项不是本轮 stdio MCP 修复引入的新阻塞。 |

### 可忽略（误报）

无。本轮第三轮 CR summary 中的新发现未发现误报。

### 评估决定

- **发现 #1（stdio MCP helper 重抛增强错误未保留 `cause`）**：确认有效，必须修复后再进入下一轮 CR 复审。
- **历史 CR TODO（QueryService 三跳遍历性能阈值测试波动）**：维持延期处理，不阻塞本次 Story 5-5 的 stdio MCP / Hooks / Skills 交付范围。
- **整体是否通过**：不通过。当前仍存在 1 个需要修复的 P1 阻塞项；无可忽略项；1 个延期项继续纳入 CR TODO。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-18
- **Model Used**: GPT-5.4
- **Fix Items**: 1

1. 已在 `tests/integration/mcp/server.test.ts` 的 `connectConfiguredStdioServer()` catch 分支中，将增强后的重抛改为 `throw new Error(message, { cause: error })`，在保留 stderr 诊断信息的同时保留原始异常链，消除 `preserve-caught-error` lint 阻塞。
2. 未扩大修复范围；未修改 Story 文档；历史 CR TODO（QueryService 三跳遍历性能阈值波动）保持不变。