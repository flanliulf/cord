---
Story: 5-5
Round: 1
Date: 2026-05-18
Model Used: GitHub Copilot (model identifier unavailable in VS Code session)
Type: Code Review Summary
---

## 审查结论

首轮审查。Agent 并行子代理调度能力在当前环境不可用，已按 `bmenhance-cr-01-reviewer` 降级规则改为串行执行 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三层审查；三层均完成。`npm run lint` 与 `npm run build` 通过；`npm test` 首次全量运行被一个既有性能阈值测试波动挡住，定向复跑该文件通过。当前存在 2 个 `patch` 类验收/测试覆盖问题，均集中在 AC6/AC7 的可验证证据不足，因此本轮建议：不通过，补齐验证后复审。

## 新发现

### 1. [中] AC7 的 Hooks “触发”只验证了文件存在，没有验证落盘后会调用影响分析

- **来源**：auditor+blind
- **分类**：patch

- **证据**
  - `_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:19` 要求测试覆盖 “Hooks 触发 + Skills 格式 + IDE MCP 验证”。
  - `tests/unit/adapters/ide.test.ts:109-119` 只断言 `.claude/settings.json` 中存在 `PostToolUse: expect.any(Array)`，以及 `.claude/hooks/cord-post-edit.sh` 文件存在；没有断言 matcher、command，也没有执行脚本。
  - `tests/integration/cli/init.test.ts:83-108` 同样只检查 hook 文件存在和 Skills 文件内容，没有模拟 PostToolUse/文件路径输入来证明 `cord impact --json` 会被触发。

- **影响**
  - FR29/AC1 的核心体验是“文档变更落盘时自动触发关系检查”。当前实现可能生成了文件和配置，但测试无法捕获 hook command 拼错、`$TOOL_INPUT_PATH` 未传递、脚本参数为空、或脚本没有调用影响分析命令等回归。

- **建议**
  - 增加一个针对 Claude Code adapter/init 输出的执行性测试：在临时项目中生成 hook，放置 stub `cord` 到 PATH，执行 `.claude/hooks/cord-post-edit.sh docs/example.md`，断言 stub 收到 `impact --json docs/example.md`。
  - 同时在 adapter 测试中断言 `PostToolUse` 的 `matcher` 与 `command` 精确值，避免只用 `expect.any(Array)` 放过配置漂移。

### 2. [中] AC6/AC7 要求三大 IDE MCP 端到端验证，但当前证据只覆盖通用 MCP server 与部分 IDE 配置形状

- **来源**：auditor
- **分类**：patch

- **证据**
  - `_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:18-19` 要求 MCP 在 3 大 IDE 验证通过，并在测试中覆盖 IDE MCP 验证。
  - `tests/integration/mcp/server.test.ts:61-190` 验证的是内存传输下的通用 MCP server 工具注册与 4 个核心工具调用，不经过 Claude Code / Cursor / VS Code Copilot 生成的 IDE 配置。
  - `tests/unit/adapters/ide.test.ts:122-158` 对 Cursor 和 VS Code Copilot 只验证配置文件 JSON 形状与指令文件内容；没有用这些配置启动/连接 MCP server，也没有验证 3 个 IDE 入口均能完成 Tool 注册 + Tool 调用返回正确结果。
  - `tests/integration/cli/init.test.ts:83-108` 只对 Claude Code 初始化路径断言生成 Skills 文件与 schema 名称，未形成三大 IDE MCP 验证矩阵。

- **影响**
  - NFR11 在 PRD 中定义为 “Tool 注册成功 + Tool 调用返回正确结果”。当前测试能证明 MCP server 自身可用，也能证明部分 IDE 配置文件被写出，但不能证明每个 IDE 生成配置与 MCP server 的端到端链路没有漂移。

- **建议**
  - 增加三大 IDE 初始化矩阵测试，至少对 Claude Code / Cursor / VS Code Copilot 生成的 MCP 配置解析出 command/args 后启动同一 MCP server，并验证 `listTools()` 与 `init_graph` / `query_relations` / `analyze_impact` / `sync_docs` 的最小调用链。
  - 如果真实 IDE 版本验证必须手工完成，应在 Story/测试产物中补充可追溯的手工验证记录，并把自动化测试边界写清楚；否则 AC6/AC7 仍缺少可审计证据。

## 验证摘要

- `npm test` ❌ 首次全量运行失败：416 / 417 通过；失败项为 `tests/unit/services/query-service.test.ts > QueryService > keeps three-hop traversal performance within 10% on indexed in-memory adjacency lookup`，断言为 `0.14833 > 0.09964`。
- `npx vitest run tests/unit/services/query-service.test.ts --reporter=verbose` ✅ 定向复跑通过：15 / 15 通过，包含失败的性能测试。
- `npm run lint` ✅ 通过。
- `npm run build` ✅ 通过。
- 审查输入模式：`main...HEAD` 不可用（当前分支 `master`，无 `main` revision），已按技能降级使用 `git diff HEAD -- <Story 5-5 File List>` 与未跟踪新增文件内容。

## 通过项

- `src/adapters/ide/claude-code.ts:44-45` 已将 `ClaudeCodeAdapter.generateSkills()` 委托到 `generateClaudeSkills()`，与 Story 5.4 的 `InitService -> IIdeAdapter.generateSkills?()` 编排链一致。
- `src/services/init-service.ts:66-68` 会调用 `generateHooksConfig?.()` 与 `generateSkills?.()`，并将生成的 Skills 写入项目目录。
- `src/adapters/ide/skills-generator.ts:27-76` 覆盖 4 个意图场景：影响分析、关系查询、图谱初始化、同步建议。
- `src/adapters/ide/skills-generator.ts:96-105` 每个 Skill 输出 Trigger Conditions、MCP Tool Sequence、Expected Output Format，并引用 `src/mcp/tools/schemas.ts` 作为 schema 来源。
- `src/mcp/tools/schemas.ts:23-89` 存在 `AnalyzeImpactResult`、`QueryRelationsResult`、`InitGraphResult`、`SyncDocsResult` 命名 schema；生成器使用的 schema 名称可对应到实际导出。
- `tests/unit/adapters/skills-generator.test.ts:7-33` 覆盖四个 Skill 文件路径、必需章节、命名 schema、`relationId` 与 `sync_docs` 单文档调用提示。
- `tests/integration/cli/init.test.ts:86-108` 覆盖 Claude Code 初始化后四个 Skills 文件出现在 `generatedSkills` 且写入磁盘。
- 已知既有问题（defer）：全量测试中的 QueryService 性能阈值波动不在 Story 5-5 改动范围内，定向复跑已通过；建议后续单独处理性能测试稳定性。

## 结论

- **结论：不通过**
- **阻塞项**：2 个 `patch` 类验收/测试覆盖缺口（Hooks 触发验证、三大 IDE MCP 验证证据）。
- **建议**：补齐 AC6/AC7 的自动化或可追溯手工验证证据后进入下一轮 CR。
