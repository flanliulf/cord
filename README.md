# CORD

[![npm version](https://img.shields.io/npm/v/cord.svg)](https://www.npmjs.com/package/cord)
[![CI](https://github.com/fancyliu/cord/actions/workflows/ci.yml/badge.svg)](https://github.com/fancyliu/cord/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen.svg)](./coverage/coverage-summary.json)
[![GitHub stars](https://img.shields.io/github/stars/fancyliu/cord?style=social)](https://github.com/fancyliu/cord/stargazers)

CORD 是面向 AI 辅助开发的文档关系图谱引擎，用确定性的关系扫描、查询与影响分析，帮助需求、架构、Epic、Story 和用户文档在持续演进中保持一致。

核心理念是：确定性优于推理性。CORD 不要求 AI 猜哪些文档可能受影响，而是先把文档关系写入本地图谱，再让 CLI 或 MCP Tool 基于同一套结构化契约回答问题。

## 快速开始

```bash
npm install -D cord
npx cord init --ide vscode-copilot
npx cord scan --rebuild --force
npx cord impact docs/getting-started.md
```

从安装到首次影响分析的完整说明见 [docs/getting-started.md](docs/getting-started.md)。

## 核心功能

- 扫描 Markdown 文档并构建本地 SQLite 关系图谱。
- 查询单文档的 1 到 3 跳关联关系，支持按关系类型和 deprecated 状态过滤。
- 分析文档变更影响范围，返回建议动作、严重度、更新策略和置信度。
- 导出完整关系图谱 JSON 快照。
- 通过 MCP Server 为 AI IDE 暴露 7 个结构化 Tool。
- 支持手动添加、删除和标记 deprecated 关系，便于修正文档图谱。
- 支持框架适配器，当前内置 BMAD 和 Generic 适配器。

## IDE 支持矩阵

| IDE             | 初始化参数             | 生成内容                                                                   |
| --------------- | ---------------------- | -------------------------------------------------------------------------- |
| Claude Code     | `--ide claude-code`    | `.claude/settings.json`、规则文件、PostToolUse Hook、CORD Skills           |
| Cursor          | `--ide cursor`         | `.cursor/mcp.json`、`.cursor/rules/cord-relations.mdc`                     |
| VS Code Copilot | `--ide vscode-copilot` | `.vscode/mcp.json`、`.github/copilot-instructions.md`、`AGENTS.md` CORD 段 |
| Codex CLI       | `--ide codex-cli`      | `AGENTS.md` CORD 段                                                        |

未传 `--ide` 时，`cord init` 会尝试自动检测当前项目中的 IDE 配置；检测到多个候选时，交互式终端会提示选择，非交互式场景建议显式传入 `--ide`。

## 文档

- [快速开始](docs/getting-started.md)
- [CLI 参考](docs/cli-reference.md)
- [MCP Tools 参考](docs/mcp-tools-reference.md)
- [配置参考](docs/configuration.md)
- [框架适配器开发指南](docs/adapter-guide.md)
- [贡献指南](docs/contributing.md)

## 开发者安装

```bash
npm install
npm run build
npm test
```

源码仓库中的 CLI 入口位于 `dist/cli/index.js`，构建后可用下面的方式本地验证：

```bash
node dist/cli/index.js status
```

## 贡献

贡献文档、框架适配器或测试前，请先阅读 [docs/contributing.md](docs/contributing.md)。框架适配器贡献者还应阅读 [docs/adapter-guide.md](docs/adapter-guide.md)。

## License

MIT
