# CORD

[English](README.md) | [简体中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/cord.svg)](https://www.npmjs.com/package/cord)
[![CI](https://github.com/fancyliu/cord/actions/workflows/ci.yml/badge.svg)](https://github.com/fancyliu/cord/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen.svg)](./coverage/coverage-summary.json)
[![GitHub stars](https://img.shields.io/github/stars/fancyliu/cord?style=social)](https://github.com/fancyliu/cord/stargazers)

CORD 是面向 AI 辅助开发的文档关系图谱引擎，用确定性的关系扫描、查询与影响分析，帮助需求、架构、Epic、Story 和用户文档在持续演进中保持一致。

核心理念是：确定性优于推理性。CORD 不要求 AI 猜哪些文档可能受影响，而是先把文档关系写入本地图谱，再让 CLI 或 MCP Tool 基于同一套结构化契约回答问题。

## 适合谁使用

- 正在维护需求、架构、Epic、Story、用户文档等多层文档的团队。
- 希望 AI IDE 在改文档前后能查询上下游关系，而不是靠上下文窗口猜测的开发者。
- 想为自有文档框架补充扫描规则和预设关系的框架维护者。

## 快速开始

```bash
npm install -D cord
npx cord init --ide vscode-copilot
npx cord scan --rebuild --force
npx cord impact docs/getting-started.md
```

将 `docs/getting-started.md` 替换为你项目中实际变更的 Markdown 文档路径。

从安装到首次影响分析的完整说明见 [docs/getting-started.md](docs/getting-started.zh.md)。

## 基本工作流

1. `cord init` 生成项目配置、IDE MCP 配置和本地数据目录。
2. `cord scan` 扫描 Markdown 文档，写入 `.cord/cord.db`。
3. `cord query` 或 MCP `query_relations` 在编辑前查看上下游关系。
4. `cord impact` 或 MCP `analyze_impact` 在编辑后分析同步范围。
5. 必要时通过 MCP `add_relation`、`remove_relation`、`deprecate_relation` 修正文档图谱。

## 核心功能

- 扫描 Markdown 文档并构建本地 SQLite 关系图谱。
- 查询单文档的 1 到 3 跳关联关系，支持按关系类型和 deprecated 状态过滤。
- 分析文档变更影响范围，返回建议动作、严重度、更新策略和置信度。
- 导出完整关系图谱 JSON 快照。
- 通过 MCP Server 为 AI IDE 暴露 7 个结构化 Tool。
- 通过 MCP Tool 支持手动添加、删除和标记 deprecated 关系，便于修正文档图谱。
- 支持框架适配器，当前内置 BMAD 和 Generic 适配器。

## IDE 支持矩阵

AI IDE 集成通过 MCP Tools 使用关系查询、影响分析和关系修正能力；CLI 主要覆盖初始化、扫描、查询、影响分析、导出和状态查看。

| IDE             | 初始化参数             | 生成内容                                                                   |
| --------------- | ---------------------- | -------------------------------------------------------------------------- |
| Claude Code     | `--ide claude-code`    | `.claude/settings.json`、规则文件、PostToolUse Hook、CORD Skills           |
| Cursor          | `--ide cursor`         | `.cursor/mcp.json`、`.cursor/rules/cord-relations.mdc`                     |
| VS Code Copilot | `--ide vscode-copilot` | `.vscode/mcp.json`、`.github/copilot-instructions.md`、`AGENTS.md` CORD 段 |
| Codex CLI       | `--ide codex-cli`      | `AGENTS.md` CORD 段                                                        |

未传 `--ide` 时，`cord init` 会尝试自动检测当前项目中的 IDE 配置；检测到多个候选时，交互式终端会提示选择，非交互式场景建议显式传入 `--ide`。

## 文档

| 目标                                  | 文档                                             |
| ------------------------------------- | ------------------------------------------------ |
| 首次安装、初始化和影响分析            | [快速开始](docs/getting-started.zh.md)           |
| 查 CLI 命令、参数、退出码             | [CLI 参考](docs/cli-reference.zh.md)             |
| 让 AI IDE 调用 CORD                   | [MCP Tools 参考](docs/mcp-tools-reference.zh.md) |
| 调整扫描路径、IDE、框架适配和更新策略 | [配置参考](docs/configuration.zh.md)             |
| 贡献代码、文档或测试                  | [贡献指南](docs/contributing.zh.md)              |
| 新增框架适配器                        | [框架适配器开发指南](docs/adapter-guide.zh.md)   |
| 查看完整文档索引                      | [文档索引](docs/index.zh.md)                     |

## 本仓库开发

```bash
npm install
npm run build
npm run test
```

源码仓库中的 CLI 入口位于 `dist/cli/index.js`，构建后可用下面的方式本地验证：

```bash
node dist/cli/index.js status
```

## 贡献

贡献文档、框架适配器或测试前，请先阅读 [docs/contributing.md](docs/contributing.zh.md)。框架适配器贡献者还应阅读 [docs/adapter-guide.md](docs/adapter-guide.zh.md)。

如果你不确定改动应该落在哪份文档，先从 [docs/index.md](docs/index.zh.md) 选择阅读路径，再在 PR 中说明你同步过的用户文档或贡献者文档。

## License

MIT
