# Story 6.2: 用户文档与 README

Status: done

## Story

As a 新用户，
I want 完整的用户文档，
So that 我可以通过自助式阅读快速上手 CORD，从安装到首次影响分析 < 5 分钟阅读。

## Acceptance Criteria (AC)

1. **Given** 所有功能 Epic 已完成 **When** 编写 README **Then** 包含项目介绍、核心概念、快速开始链接、安装指南、Star 徽章
2. **Given** 文档 **When** 检查快速开始 **Then** `docs/getting-started.md` 从安装到首次影响分析（< 5 分钟阅读）
3. **Given** 文档 **When** 检查 CLI 参考 **Then** `docs/cli-reference.md` 每个命令的用法、参数、选项、示例输出
4. **Given** 文档 **When** 检查 MCP 参考 **Then** `docs/mcp-tools-reference.md` 覆盖全部 7 个 MCP Tool 的命名 inputSchema、命名 outputSchema、使用场景和调用示例（`query_relations` 的 outputSchema 含 `relationId`，作为 `remove_relation` / `deprecate_relation` 的输入句柄；`sync_docs` 含单文档输入边界）
5. **Given** 文档 **When** 检查配置参考 **Then** `docs/configuration.md` 包含 cord.config 配置项说明 + IDE 配置文件模板 + 框架适配配置 + YAML/JSON 双格式与 JSON Schema 规则
6. **Given** 文档语言 **When** 检查 **Then** 所有文档使用中文编写

## Tasks / Subtasks

- [x] Task 1: 编写 README.md (AC: #1)
- [x] Task 2: 编写 getting-started.md (AC: #2)
- [x] Task 3: 编写 cli-reference.md (AC: #3)
- [x] Task 4: 编写 mcp-tools-reference.md，覆盖全部 7 个 MCP Tool（Story 5.1 的 4 个 + Story 5.2 的 3 个）的命名 inputSchema / outputSchema、使用场景和调用示例 (AC: #4)
- [x] Task 5: 编写 configuration.md，覆盖 cord.config 配置项、IDE 配置模板、框架适配配置、YAML/JSON 双格式与 JSON Schema 规则 (AC: #5)

## Dev Notes

### README.md 结构

1. 项目标题 + 徽章（npm、CI、coverage、Stars）
2. 一句话描述 + "确定性优于推理性" 核心概念
3. 快速开始（3 条命令）
4. 核心功能列表
5. IDE 支持矩阵
6. 文档链接
7. 贡献指南链接
8. License

### MCP Tool 清单（mcp-tools-reference.md 覆盖范围）

Story 5.1（4 个 Tool）：

- `analyze_impact` — inputSchema / outputSchema
- `query_relations` — inputSchema / outputSchema（outputSchema 含 `relationId`，作为 `remove_relation` / `deprecate_relation` 的输入句柄）
- `init_graph` — inputSchema / outputSchema
- `sync_docs` — inputSchema（单文档输入边界）/ outputSchema

Story 5.2（3 个 Tool）：

- `add_relation` — inputSchema / outputSchema
- `remove_relation` — inputSchema（接收 `relationId`）/ outputSchema
- `deprecate_relation` — inputSchema（接收 `relationId`）/ outputSchema

### 配置文档说明（configuration.md 覆盖范围）

- cord.config 核心配置项（YAML 默认格式 + `--format json` 支持）
- IDE 配置文件模板
- 框架适配配置（`config.framework` 显式覆盖 + `detectFramework()` 自动检测）
- YAML/JSON 双格式、加载优先级与 JSON Schema 校验规则（参考 architecture 03）

### 文档语言

所有文档使用中文编写（document_output_language: Mandarin）

### Project Structure Notes

- `README.md`
- `docs/getting-started.md`
- `docs/cli-reference.md`
- `docs/mcp-tools-reference.md`
- `docs/configuration.md`

### References

- [Source: prd.md#文档要求] — 文档清单
- [Source: epics.md#Story 6.2] — 验收标准
- [Source: stories/5-1-mcp-server-core-and-4-tools.md] — MCP Tool canonical contract（4 个 Tool：`analyze_impact`、`query_relations`、`init_graph`、`sync_docs`，含 `sync_docs` 单文档输入边界与 `query_relations` outputSchema `relationId`）
- [Source: stories/5-2-mcp-tools-relation-management.md] — MCP Tool canonical contract（3 个 Tool：`add_relation`、`remove_relation`、`deprecate_relation`，后两者接收 `relationId` 作为输入句柄）
- [Source: architecture/03-core-architectural-decisions.md] — YAML/JSON 双格式与 JSON Schema 规则

## Dev Agent Record

### Agent Model Used

- GPT-5.5

### Debug Log References

- `npx prettier --check README.md docs/getting-started.md docs/cli-reference.md docs/mcp-tools-reference.md docs/configuration.md`（首次检查发现新文档格式需调整）
- `npx prettier --write README.md docs/getting-started.md docs/cli-reference.md docs/mcp-tools-reference.md docs/configuration.md`
- `npx prettier --check README.md docs/getting-started.md docs/cli-reference.md docs/mcp-tools-reference.md docs/configuration.md`
- `npm run type-check`
- `npm run lint`
- `npm test`
- Story AC 只读一致性检查：README 徽章/链接、7 个 MCP Tool、14 个命名 schema、`relationId` 句柄、`sync_docs` 单文档边界、配置双格式与 schema 说明

### Completion Notes List

- 编写中文 README，覆盖项目介绍、确定性优于推理性的核心概念、快速开始、安装、IDE 支持矩阵、文档入口、贡献指南与 License；因仓库未配置 git remote，Star/CI 徽章采用 `fancyliu/cord` 作为保守默认发布路径。
- 编写 `docs/getting-started.md`，提供从安装、初始化、扫描到首次 `cord impact` 的 5 分钟上手路径，并补充查询和状态检查入口。
- 编写 `docs/cli-reference.md`，覆盖当前 6 个 CLI 命令的用法、参数、选项、示例输出、退出码与路径规则。
- 编写 `docs/mcp-tools-reference.md`，覆盖 7 个 MCP Tool 的命名 inputSchema/outputSchema、使用场景和调用示例；明确 `query_relations` 输出 `relationId` 作为 `remove_relation` / `deprecate_relation` 输入句柄，并说明 `sync_docs` 只接收单文档输入。
- 编写 `docs/configuration.md`，覆盖 `cord.config` 配置项、YAML/JSON 双格式与加载优先级、JSON Schema 规则、IDE 配置模板，以及 `config.framework` 显式覆盖和 `detectFramework()` 自动检测链。
- 本 Story 为文档交付，未新增代码测试文件；执行格式检查、类型检查、lint 与全量测试验证，最终全部通过。

### File List

- `README.md`
- `docs/getting-started.md`
- `docs/cli-reference.md`
- `docs/mcp-tools-reference.md`
- `docs/configuration.md`
- `_bmad-output/implementation-artifacts/stories/6-2-user-docs-and-readme.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-19: 完成 Story 6.2 中文用户文档与 README 交付，补齐 CLI、MCP Tools、配置参考与快速开始；Story 状态更新为 review。
