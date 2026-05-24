# CORD 文档索引

[English](index.md) | [简体中文](index.zh.md)

这个索引帮助不同读者快速找到对应文档。首次使用 CORD 时，建议先读 [快速开始](getting-started.zh.md)；准备提交 PR 时，先读 [贡献指南](contributing.zh.md)。

## 用户文档

| 目标                 | 文档                                        | 说明                                                     |
| -------------------- | ------------------------------------------- | -------------------------------------------------------- |
| 首次安装和跑通工作流 | [快速开始](getting-started.zh.md)           | 从安装、初始化、扫描到第一次影响分析。                   |
| 查询 CLI 命令        | [CLI 参考](cli-reference.zh.md)             | 6 个 CLI 命令、参数、JSON 输出和退出码。                 |
| 接入 AI IDE          | [MCP Tools 参考](mcp-tools-reference.zh.md) | 7 个 MCP Tool、input/output schema 和调用示例。          |
| 调整配置             | [配置参考](configuration.zh.md)             | `cord.config.yaml/json`、扫描路径、IDE、框架和更新策略。 |

## 贡献者文档

| 目标                     | 文档                                      | 说明                                           |
| ------------------------ | ----------------------------------------- | ---------------------------------------------- |
| 准备提交代码、文档或测试 | [贡献指南](contributing.zh.md)            | 本地环境、验证命令、PR 要求和审阅流程。        |
| 新增框架适配器           | [框架适配器开发指南](adapter-guide.zh.md) | 适配器 API、注册流程、最小实现路径和测试建议。 |
| 本地开发和排障           | [开发指南](development-guide.md)          | 构建、测试、CLI/MCP 本地验证和常见问题。       |

## 项目理解文档

这些文档适合需要理解 CORD 内部结构的维护者或深度贡献者。

| 主题     | 文档                                               |
| -------- | -------------------------------------------------- |
| 项目总览 | [project-overview.md](project-overview.md)         |
| 架构说明 | [architecture.md](architecture.md)                 |
| 源码树   | [source-tree-analysis.md](source-tree-analysis.md) |
| 模块清单 | [component-inventory.md](component-inventory.md)   |
| 数据模型 | [data-models.md](data-models.md)                   |

## 常见阅读路径

### 我想先用起来

1. [快速开始](getting-started.zh.md)
2. [CLI 参考](cli-reference.zh.md)
3. [配置参考](configuration.zh.md)

### 我想让 AI IDE 使用 CORD

1. [快速开始](getting-started.zh.md)
2. [MCP Tools 参考](mcp-tools-reference.zh.md)
3. [配置参考](configuration.zh.md#ide-配置文件模板)

### 我想贡献框架适配器

1. [贡献指南](contributing.zh.md)
2. [框架适配器开发指南](adapter-guide.zh.md)
3. [开发指南](development-guide.md)

### 我想修改 CLI、MCP 或存储行为

1. [架构说明](architecture.md)
2. [模块清单](component-inventory.md)
3. 对应用户参考文档：CLI 改动同步 [CLI 参考](cli-reference.zh.md)，MCP 改动同步 [MCP Tools 参考](mcp-tools-reference.zh.md)，配置改动同步 [配置参考](configuration.zh.md)。

## 维护者内部资料

`_bmad-output/` 保存 PRD、架构决策、Epic、Story、CR 和回顾等过程性资料。它们适合维护者追溯决策，不是普通用户使用 CORD 的必要前置。

- [AI agent 主规则文件](../_bmad-output/project-context.md)
- [PRD](../_bmad-output/planning-artifacts/prd.md)
- [架构决策索引](../_bmad-output/planning-artifacts/architecture/00-index.md)
- [Epic 规划索引](../_bmad-output/planning-artifacts/epics/index.md)
- [Sprint 状态](../_bmad-output/implementation-artifacts/sprint-status.yaml)

DP 扫描状态保存在 [project-scan-report.json](project-scan-report.json)。
