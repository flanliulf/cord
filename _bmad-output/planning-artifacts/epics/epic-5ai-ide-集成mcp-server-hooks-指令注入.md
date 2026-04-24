# Epic 5：AI IDE 集成（MCP Server + Hooks + 指令注入）

用户运行 `cord init` 即可一键完成 IDE 检测、框架检测、MCP Server 配置、Hooks 脚本安装和指令文件注入。AI Agent 可通过 MCP Server 自动调用 CORD 能力（影响分析、关系查询、图谱初始化、同步建议、关系管理）。文档变更落盘时自动触发关系检查。

## Story 5.1：MCP Server 核心与 4 个 Tools

As a AI Agent（通过 AI IDE），
I want 通过 MCP Server 调用 CORD 的核心能力，
So that 我可以在用户的开发流程中自动执行影响分析、关系查询等操作。

**Acceptance Criteria:**

**Given** Epic 2-4 的 Service 层已就绪
**When** 实现 MCP Server
**Then** `src/mcp/server.ts` 实现 MCP Server 入口，使用 TypeScript SDK v1.x + Stdio Transport
**And** `src/mcp/tools/analyze-impact.ts` 实现 analyze_impact Tool（调用 ImpactService）
**And** `src/mcp/tools/query-relations.ts` 实现 query_relations Tool（调用 QueryService）
**And** `src/mcp/tools/init-graph.ts` 实现 init_graph Tool（调用 ScanService）
**And** `src/mcp/tools/sync-docs.ts` 实现 sync_docs Tool（触发关联文档同步建议）
**And** 每个 Tool 的 inputSchema 和 outputSchema 均从命名 Zod schema 自动导出为 JSON Schema，统一在 `src/mcp/tools/schemas.ts` 中导出；新增 Tool 时已有全部 Tool 的 input/output schema 保持不变（NFR10）
**And** MCP Server 作为长驻进程运行（FR32）
**And** MCP Tool 单次调用响应时间 p95 < 50ms（NFR4）
**And** CLI 与 MCP Server 对相同输入返回语义一致的输出（NFR13）
**And** MCP Server 收到 SIGTERM 后 ≤ 2 秒内优雅退出（关闭 SQLite + flush 日志）（NFR17）
**And** 新增 MCP Tool 时已有 4 个 Tool 的 JSON Schema 保持不变（NFR10）
**And** 所有日志输出到 stderr，不污染 stdout JSON-RPC 通道
**And** 集成测试：4 个 Tool 端到端调用 + SIGTERM 优雅退出 + 输入验证失败

## Story 5.2：MCP Tools 关系管理能力

As a AI Agent（通过 AI IDE），
I want 通过 MCP Tools 添加、移除或标记关系为 deprecated，
So that 用户可以通过自然语言对话让我修正文档关系（AI IDE 负责意图解析，CORD 提供原子化 CRUD）。

**Acceptance Criteria:**

**Given** Story 5.1 的 MCP Server 和 Epic 4 的 RelationService 已就绪
**When** 扩展 MCP Tools 关系管理能力
**Then** 在 MCP Server 中注册关系管理 Tools：add_relation、remove_relation、deprecate_relation（FR20）
**And** 每个 Tool 暴露原子化的关系 CRUD 操作
**And** CORD 提供操作接口，AI IDE 负责从用户自然语言中解析意图后调用（FR20 职责边界）
**And** 新增 Tools 不影响已有 4 个 Tool 的 JSON Schema（NFR10）
**And** 集成测试：通过 MCP 添加/移除/deprecated 关系 + 操作结果验证

## Story 5.3：IDE 适配器与自动检测

As a 用户，
I want 系统自动检测我使用的 AI IDE 类型，
So that `cord init` 可以为我的 IDE 生成正确的配置文件。

**Acceptance Criteria:**

**Given** 需要支持多种 IDE
**When** 实现 IDE 适配层
**Then** `src/adapters/ide/interfaces.ts` 定义 IIdeAdapter 接口
**And** `src/adapters/ide/detector.ts` 实现 IDE 自动检测逻辑（FR2）——检测 Claude Code / Cursor / VS Code Copilot / Codex CLI
**And** `src/adapters/ide/claude-code.ts` 实现 Claude Code 适配器（Hooks 配置 + CLAUDE.md 指令注入 + MCP 配置）
**And** `src/adapters/ide/cursor.ts` 实现 Cursor 适配器（.cursor/mcp.json + .cursor/rules/）
**And** `src/adapters/ide/vscode-copilot.ts` 实现 VS Code Copilot 适配器（copilot-instructions.md + AGENTS.md + MCP Host，与 PRD IDE 矩阵对齐）
**And** `src/adapters/ide/codex-cli.ts` 实现 Codex CLI 适配器（AGENTS.md，基础集成层）
**And** 全局指令文件生成采用独立文件注入策略，不修改用户已有 IDE 专属配置文件（NFR12）；`AGENTS.md` 为 NFR12 appendable 例外共享文件（Copilot + Codex CLI 共享），已存在时以 CORD 注释边界追加
**And** 单元测试：4 种 IDE 检测 + 各适配器配置文件生成 + 零侵入验证（SHA-256 校验分两类：居正不变 vs CORD 注释段外不变）

## Story 5.4：InitService 一键初始化（cord init）

As a 用户，
I want 通过 `cord init` 一键完成项目的完整初始化配置，
So that 从安装到首次使用的体验闭环 < 30 分钟，零摩擦上手。

**Acceptance Criteria:**

**Given** Story 5.3 的 IDE 适配器和 Story 2.1 的框架适配器已就绪
**When** 执行 `cord init`
**Then** `src/services/init-service.ts` 编排完整初始化流程（FR1）：
**And** 自动检测 IDE 类型（FR2）并选择对应适配器
**And** 自动检测开发框架（FR3）并选择对应适配器
**And** 根据 IDE 类型生成配置文件——MCP 配置、指令文件、Hooks 脚本（FR4）
**And** 生成 `cord.config.yaml` 默认配置文件
**And** 创建 `.cord/` 数据目录
**And** `src/cli/commands/init.ts` 实现 `cord init` CLI 命令（薄壳），使用 @clack/prompts 提供交互向导
**And** CLI 输出人类可读的步骤进度 + 结果摘要
**And** 支持 `--json` 输出（非 TTY 自动化场景跳过交互向导，直接返回机器可读 InitResult；多 IDE 命中时返回 `AMBIGUOUS_IDE` 结构化错误）
**And** 支持 `--format json` 生成 cord.config.json（默认生成 cord.config.yaml，对齐架构决策 D6）
**And** `--ide <name>` 显式指定 IDE 覆盖自动检测
**And** 集成测试：在 BMAD 项目中 init + 在通用项目中 init + IDE 检测正确性

## Story 5.5：Hooks 文档变更自动触发与 Skills 生成

As a 用户，
I want 文档变更落盘时自动触发关系检查，且 AI Agent 有 Skills 定义文件引导它调用 CORD，
So that 日常开发中我无需手动操作，AI Agent 自动完成影响分析和同步建议。

**Acceptance Criteria:**

**Given** Story 5.4 的 init 流程已就绪
**When** 配置 Hooks 和 Skills
**Then** `cord init` 为 Claude Code 生成 Hooks 脚本——文档变更落盘时自动触发 `analyze_impact`（FR29）
**And** 对不支持 Hooks 的 IDE（Cursor/VS Code Copilot），通过指令文件引导 AI Agent 在文档编辑后主动调用 CORD
**And** `src/adapters/ide/skills-generator.ts` 生成符合 Claude Code Skills 规范的定义文件（FR31）
**And** Skills 文件覆盖 4 个核心意图场景：影响分析、关系查询、图谱初始化、同步建议
**And** 每个 Skills 文件包含触发条件描述、对应 MCP Tool 调用序列，以及直接引用 `src/mcp/tools/schemas.ts` 中对应命名 outputSchema 的预期输出格式（不使用自然语言描述）
**And** MCP Server 在 Claude Code ≥ 1.0 / Cursor ≥ 0.48 / VS Code Copilot ≥ 1.96 中验证通过（NFR11）
**And** 集成测试：Hooks 脚本触发验证 + Skills 文件格式验证 + 三大 IDE MCP 端到端验证

---
