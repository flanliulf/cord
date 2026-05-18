---
Story: 5-5
Round: 1
Date: 2026-05-18
Model Used: GitHub Copilot (model identifier unavailable in VS Code session)
Review Source: 5-5-code-review-summary-20260518-round-1.md
Review Model: GitHub Copilot (model identifier unavailable in VS Code session)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 2 个 `patch` 类发现，均指向 AC6/AC7 的自动化或可追溯验证证据不足。经独立代码验证，两项发现均有效，均属于阻塞交付的质量门禁缺口；本轮评估决定：**不通过，需修复后复审**。

---

## 发现 #1 评估

### 审查原文

> **[中] AC7 的 Hooks “触发”只验证了文件存在，没有验证落盘后会调用影响分析**
> - 来源：auditor+blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

Story AC7 明确要求测试覆盖 “Hooks 触发 + Skills 格式 + IDE MCP 验证”（`_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:19`）。实现侧确实生成了 Claude hook 脚本和配置：`src/adapters/ide/claude-code.ts:36-40` 写出 `.claude/hooks/cord-post-edit.sh`，`src/adapters/ide/claude-code.ts:58-68` 中脚本会执行 `cord impact --json "$target_path"`，`src/adapters/ide/claude-code.ts:96-104` 中 `PostToolUse` command 负责把 `$TOOL_INPUT_PATH` 传给脚本。

但测试侧没有验证触发链路。`tests/unit/adapters/ide.test.ts:103-119` 只断言 `.claude/settings.json` 中有 `PostToolUse: expect.any(Array)`，并断言 hook 文件存在；没有断言 `matcher`、`command` 精确值，也没有执行生成脚本。`tests/integration/cli/init.test.ts:83-108` 同样只检查 hook 文件存在、Skills 文件列表和 Skills 内容，没有模拟 PostToolUse 输入或执行脚本来证明 `cord impact --json <path>` 会被调用。因此审查原文对测试缺口的描述成立。

**严重性判断：合理**

该问题不会直接证明当前实现一定运行错误，但它会让 AC7 的核心行为无法被测试捕获。若 `matcher`、`command`、参数传递或脚本调用发生漂移，当前测试仍可能通过；这属于 Story 验收覆盖不足，符合 P1 质量门禁问题。

**修复建议：可行**

审查建议增加执行性测试是可行的：在临时目录中生成 Claude hook，放置 stub `cord` 到 PATH，执行 `.claude/hooks/cord-post-edit.sh docs/example.md`，断言 stub 收到 `impact --json docs/example.md`；同时把 adapter 测试中的 `PostToolUse` 从 `expect.any(Array)` 提升为精确断言，能覆盖配置漂移风险。

**误报评估：非误报**

现有测试确实只覆盖“文件/配置存在”，未覆盖 hook 触发后的影响分析命令调用，因此不是误报。

---

## 发现 #2 评估

### 审查原文

> **[中] AC6/AC7 要求三大 IDE MCP 端到端验证，但当前证据只覆盖通用 MCP server 与部分 IDE 配置形状**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

Story AC6 要求 MCP 在 3 大 IDE 验证通过，AC7 要求测试覆盖 IDE MCP 验证（`_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:18-19`）。当前 MCP 集成测试 `tests/integration/mcp/server.test.ts:20-41` 直接创建 `createCordMcpServer()` 并使用 `InMemoryTransport` 连接测试 client；`tests/integration/mcp/server.test.ts:65-85` 验证工具注册，`tests/integration/mcp/server.test.ts:88-189` 验证 4 个核心工具调用。这能证明 MCP server 本身可用，但没有经过 Claude Code、Cursor、VS Code Copilot 生成的 IDE 配置入口。

IDE adapter 测试覆盖的是配置形状而不是端到端连接：Claude Code 测试在 `tests/unit/adapters/ide.test.ts:103-119` 只检查 settings/rules/hooks 文件；Cursor 测试在 `tests/unit/adapters/ide.test.ts:122-138` 检查 `.cursor/mcp.json` 和 rules 内容；VS Code Copilot 测试在 `tests/unit/adapters/ide.test.ts:141-158` 检查 `.vscode/mcp.json`、instructions 和 AGENTS block。CLI init 集成测试也只覆盖 Claude Code 默认初始化和 VS Code Copilot JSON 初始化的文件落盘（`tests/integration/cli/init.test.ts:43-116`、`tests/integration/cli/init.test.ts:118-146`），未形成 Claude Code / Cursor / VS Code Copilot 三 IDE 的 MCP 配置解析、启动、注册和工具调用矩阵。

**严重性判断：合理**

AC6/AC7 明确把 IDE MCP 验证列为验收范围。当前证据能覆盖 MCP server 和配置生成的部分单元行为，但不足以证明三大 IDE 入口均满足 NFR11 的 “Tool 注册成功 + Tool 调用返回正确结果”。作为验收证据缺口，评为中等严重并阻塞交付是合理的。

**修复建议：可行**

审查建议的三 IDE 初始化矩阵测试可行：分别生成 Claude Code、Cursor、VS Code Copilot 配置，解析其中 command/args 指向同一 MCP server，再验证 `listTools()` 和 `init_graph` / `query_relations` / `analyze_impact` / `sync_docs` 的最小调用链。若真实 IDE 版本验证不能自动化，也应补充可追溯手工验证记录，并在测试/Story 产物中明确自动化边界。

**误报评估：非误报**

现有测试未证明三大 IDE 配置入口与 MCP server 的端到端链路，因此该 finding 不是误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | AC7 Hooks 触发缺少执行性验证 | [中] | **P1** | 当前测试无法捕获 hook command、参数传递或脚本调用漂移，AC7 验收证据不足。 |
| 2 | AC6/AC7 三大 IDE MCP 端到端验证证据不足 | [中] | **P1** | 当前只证明 MCP server 和部分配置形状，未证明三 IDE 入口均完成工具注册与调用。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。本轮 2 个 findings 均为 Story 5-5 AC6/AC7 验收覆盖缺口，不建议延期为非阻塞 TODO。

### 可忽略（误报）

无。本轮未发现误报。

### 评估决定

- **发现 #1（AC7 Hooks 触发缺少执行性验证）**：确认有效，需补齐 hook 配置精确断言和脚本执行性测试后复审。
- **发现 #2（AC6/AC7 三大 IDE MCP 端到端验证证据不足）**：确认有效，需补齐三 IDE MCP 验证矩阵或可追溯手工验证记录后复审。
- **整体决定**：不通过。Story 5-5 需完成上述 P1 修复项后进入下一轮 CR。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-18
- **Model Used**: GPT-5.4
- **Fix Items**: 2

1. 已在 tests/unit/adapters/ide.test.ts 补齐 AC7 Hooks 触发验证。
	- 将 Claude Code settings 中 hooks.PostToolUse 从宽松存在性断言提升为精确断言，覆盖 matcher 和 command 漂移风险。
	- 新增 hook 执行性测试：生成 .claude/hooks/cord-post-edit.sh 后，注入 stub cord 到 PATH，执行脚本并断言实际收到 impact --json docs/example.md 参数链路。
2. 已在 tests/integration/mcp/server.test.ts 补齐 AC6/AC7 三大 IDE MCP 验证证据。
	- 抽取核心 MCP 工具链校验助手，复用现有 init_graph / query_relations / analyze_impact / sync_docs 端到端断言。
	- 新增 Claude Code、Cursor、VS Code Copilot 三 IDE MCP 配置矩阵测试：分别生成各自配置文件，校验 command/args/type，并对同一服务链路执行 listTools 与 4 个核心工具调用验证。
3. 验证结果。
	- 已执行：npx vitest run tests/unit/adapters/ide.test.ts tests/integration/mcp/server.test.ts
	- 结果：2 个测试文件通过，21 个测试通过，0 个失败。
