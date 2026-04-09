# Technical Research Recommendations

## 实现路线图推荐

| 阶段 | 产出 | 依赖 | 工时 |
|------|------|------|------|
| **Phase 1** | MCP Server + 6 Tools | TR2 MCP 方案 | 2 周 |
| **Phase 2** | `cord init` + 指令模板 | Phase 1 | 1 周 |
| **Phase 3** | Claude Code + Windsurf Hooks | Phase 1 + TR5 CLI 框架 | 2 周 |
| **Phase 4** | 优化 + 测试 + 文档 | Phase 1-3 | 1 周 |

## 技术栈推荐

| 组件 | 技术选择 | 来源 |
|------|----------|------|
| MCP Server | TypeScript SDK v1.x + Stdio Transport | TR2 |
| 数据库 | better-sqlite3 + WAL 模式 | TR1 |
| 文档解析 | remark / unified.js | TR3 |
| CLI 框架 | 待 TR5 研究 | TR5（下一优先项） |
| Hook 脚本 | Bash（主）+ Node.js（备选） | TR4 本研究 |
| 测试框架 | Vitest（TS）+ bats-core（Bash） | 本研究 |
| 构建工具 | tsup | TR2 |

## 技能发展要求

| 技能 | 深度 | 用途 |
|------|------|------|
| **MCP SDK (TypeScript)** | 深度 | MCP Server 开发 |
| **Bash 脚本** | 中等 | Hook 脚本编写 |
| **jq JSON 处理** | 中等 | Hook stdin 解析 |
| **各 IDE 配置体系** | 熟悉 | 配置模板维护 |
| **bats-core 测试** | 基础 | Hook 脚本测试 |

_Source: 基于前序 TR1-TR3 研究结论、Claude Code / Windsurf 官方文档及 npm 生态最佳实践_

---
