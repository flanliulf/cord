# Story 6.2: 用户文档与 README

Status: ready-for-dev

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

- [ ] Task 1: 编写 README.md (AC: #1)
- [ ] Task 2: 编写 getting-started.md (AC: #2)
- [ ] Task 3: 编写 cli-reference.md (AC: #3)
- [ ] Task 4: 编写 mcp-tools-reference.md，覆盖全部 7 个 MCP Tool（Story 5.1 的 4 个 + Story 5.2 的 3 个）的命名 inputSchema / outputSchema、使用场景和调用示例 (AC: #4)
- [ ] Task 5: 编写 configuration.md，覆盖 cord.config 配置项、IDE 配置模板、框架适配配置、YAML/JSON 双格式与 JSON Schema 规则 (AC: #5)

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
### Debug Log References
### Completion Notes List
### File List
