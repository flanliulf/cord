# Research Synthesis: 综合技术研究报告

## Executive Summary

本研究对 MCP Server 开发实践与 TypeScript SDK 进行了全面的技术评估，涵盖协议架构、SDK 版本选择、跨 IDE 兼容性、生命周期管理和实现架构五大维度。基于对 MCP 官方规范、TypeScript SDK 仓库、参考实现和四大 AI IDE 文档的深度分析，得出以下核心结论：

**关键技术发现：**

- **SDK 选择已确定**：v1.x（v1.29.0）是唯一生产推荐版本；v2 pre-alpha 不适合 MVP
- **传输层已确定**：Stdio Transport 是 CORD 本地 CLI 工具的最佳选择，所有主流 AI IDE 均支持
- **核心原语已确定**：Tools 是跨 IDE 兼容性最强的原语，应作为 CORD 的首选交互载体
- **架构模式已确定**：分层模块化架构（Tools → Services → Repository → SQLite）
- **跨 IDE 兼容性已验证**：Claude Code / Cursor / VS Code 均完整支持 Stdio + Tools，配置差异可通过文档覆盖

**战略建议：**

1. 立即启动 MVP 开发，使用 v1.x SDK + Stdio + better-sqlite3
2. 优先实现 5-8 个核心 Tools（关系管理 + 文档扫描 + 图谱查询）
3. Resources 和 Prompts 作为 Phase 3 增强功能
4. 持续关注 v2 SDK 进展，在 v2 稳定后规划迁移

## Table of Contents

1. [Technical Research Scope Confirmation](#technical-research-scope-confirmation) — 研究范围与方法论
2. [Technology Stack Analysis](#technology-stack-analysis) — MCP 协议、SDK、传输层、核心原语、AI IDE 兼容性
3. [Integration Patterns Analysis](#integration-patterns-analysis) — JSON-RPC 协议、生命周期、Tool 注册、SQLite 集成、跨 IDE 配置
4. [Architectural Patterns and Design](#architectural-patterns-and-design) — 系统架构、设计原则、安全模式、数据架构
5. [Implementation Approaches](#implementation-approaches-and-technology-adoption) — 采纳策略、开发工作流、调试故障排查、风险评估
6. [Research Synthesis](#research-synthesis-综合技术研究报告) — 综合结论与建议（本章节）

## 研究方法论

本研究采用多源验证的技术研究方法论：

| 维度 | 方法 |
|------|------|
| **一手资料** | MCP 官方规范文档、TypeScript SDK GitHub README 与源码文档、各 IDE 官方配置文档 |
| **二手验证** | npm 包元数据、GitHub 社区数据（Stars/Forks/Usage）、MCP 客户端列表 |
| **交叉验证** | 多个 IDE 文档对比验证 MCP 能力支持情况 |
| **置信度标注** | 每项结论标注置信度等级（🟢 高 / 🟡 中 / 🔴 低） |

## 研究目标达成评估

| 研究目标 | 达成状态 | 核心结论 |
|---------|---------|---------|
| **SDK 版本选择** | ✅ 完成 | v1.x（v1.29.0）用于 MVP；v2 观望至稳定 |
| **Tool 定义模式** | ✅ 完成 | `server.registerTool()` + Zod schema；支持 structuredContent、resource_link、annotations |
| **AI IDE 兼容性** | ✅ 完成 | Stdio + Tools 在所有主流 IDE 通用；配置格式差异已记录 |
| **生命周期管理** | ✅ 完成 | 三阶段协议（Initialize → Operation → Shutdown）；SIGTERM 优雅关闭 SQLite |

## CORD 项目技术决策汇总

| 决策项 | 选择 | 置信度 | 替代方案 | 否决理由 |
|--------|------|--------|---------|---------|
| MCP SDK 版本 | v1.x | 🟢 高 | v2 pre-alpha | 不稳定，无生产推荐 |
| 传输层 | Stdio | 🟢 高 | Streamable HTTP | 本地 CLI 工具不需要远程传输 |
| 核心原语 | Tools 优先 | 🟢 高 | Resources/Prompts 优先 | Tools 跨 IDE 兼容性最强 |
| Schema 验证 | Zod v3 | 🟢 高 | ArkType / Valibot | v1.x SDK 原生支持 Zod v3 |
| SQLite 驱动 | better-sqlite3 | 🟢 高 | sql.js / drizzle-orm | 同步 API + 高性能（TR1 已验证） |
| 测试框架 | Vitest | 🟢 高 | Jest | SDK 内部使用 Vitest，生态一致 |
| 调试工具 | MCP Inspector | 🟢 高 | 自建 Client | 官方工具，完整功能 |
| 日志输出 | console.error (stderr) | 🟢 高 | 第三方日志库 | 简单直接，不污染 stdout |
| 包分发 | npx cord-mcp | 🟢 高 | 全局安装 | 零安装体验更好 |

## 后续技术研究依赖

本研究（TR2）为以下待研究主题提供了基础输入：

| 后续 TR | 主题 | TR2 提供的输入 |
|---------|------|-------------|
| **TR3** | Markdown AST 解析 | Tool 定义模式确定后，`document.scan` 工具需要 AST 解析引擎 |
| **TR5** | CLI 框架选择 | CLI 子命令体系可参考 MCP Tool 命名约定（`.` 分隔分组） |
| **TR4** | IDE Hooks 对比 | 已获取各 IDE 的 MCP 能力支持详情，可直接输入 |
| **TR9** | npm 分发 | better-sqlite3 跨平台 prebuild 策略已初步评估 |

## 信息来源汇总

| 来源 | URL | 用途 |
|------|-----|------|
| MCP 官方文档 | https://modelcontextprotocol.io | 协议规范、架构、概念 |
| TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk | SDK 版本、API、示例 |
| MCP 参考 Servers | https://github.com/modelcontextprotocol/servers | 架构模式参考 |
| MCP Inspector | https://github.com/modelcontextprotocol/inspector | 调试工具 |
| Claude Code MCP 文档 | https://code.claude.com/docs/en/mcp | IDE 集成配置 |
| Cursor MCP 文档 | https://cursor.com/docs/context/mcp | IDE 集成配置 |
| VS Code MCP 文档 | https://code.visualstudio.com/docs/copilot/chat/mcp-servers | IDE 集成配置 |
| MCP Lifecycle Spec | https://modelcontextprotocol.io/specification/latest/basic/lifecycle | 生命周期规范 |
| MCP Tools Spec | https://modelcontextprotocol.io/specification/latest/server/tools | Tool 规范详情 |
| MCP Authorization Spec | https://modelcontextprotocol.io/specification/latest/basic/authorization | 认证授权规范 |
| better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 | SQLite 驱动详情 |

---

**Technical Research Completion Date:** 2026-03-31
**Document Status:** ✅ 完成
**Steps Completed:** 6/6
**Source Verification:** 所有技术声明均引用当前可访问的官方源
**Overall Confidence Level:** 🟢 高 — 基于多个权威技术源的交叉验证
