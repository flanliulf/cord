# 快速开始

本指南帮助你在 5 分钟内完成 CORD 初始化、图谱扫描和首次影响分析。CORD 会在项目本地创建 `.cord/cord.db`，用于保存文档节点、关系边和扫描状态。

## 前置条件

- Node.js 20 LTS 或更高版本。
- 一个包含 Markdown 文档的项目。
- 任选一种支持方式：CLI 直接使用，或通过 AI IDE 的 MCP 集成调用。

## 1. 安装

在项目根目录安装 CORD：

```bash
npm install -D cord
```

如果你正在使用本仓库源码体验，请先安装依赖并构建：

```bash
npm install
npm run build
```

源码构建后的命令示例可用 `node dist/cli/index.js` 代替 `npx cord`。

## 2. 初始化项目

选择当前项目使用的 AI IDE：

```bash
npx cord init --ide vscode-copilot
```

常用 IDE 参数：

| IDE             | 参数                   |
| --------------- | ---------------------- |
| Claude Code     | `--ide claude-code`    |
| Cursor          | `--ide cursor`         |
| VS Code Copilot | `--ide vscode-copilot` |
| Codex CLI       | `--ide codex-cli`      |

默认会生成 `cord.config.yaml` 和 `.cord/` 数据目录。若你偏好 JSON 配置：

```bash
npx cord init --ide vscode-copilot --format json
```

典型输出：

```text
✅ CORD 初始化完成
IDE: vscode-copilot
框架: bmad
配置文件: /path/to/project/cord.config.yaml
数据目录: /path/to/project/.cord
生成/更新文件:
- .github/copilot-instructions.md
- .vscode/mcp.json
- AGENTS.md
```

## 3. 扫描文档图谱

首次使用建议执行一次完整重建：

```bash
npx cord scan --rebuild --force
```

典型输出：

```text
扫描完成
文档数: 42
关系数: 96
耗时: 128ms
警告: 0
```

后续日常使用可以直接运行增量扫描：

```bash
npx cord scan
```

## 4. 首次影响分析

当你修改了某个文档，运行：

```bash
npx cord impact docs/getting-started.md
```

典型输出：

```text
docPath                      | relationType  | propagationType | suggestedAction       | updateStrategy | severity | confidence | hopDistance
-----------------------------+---------------+-----------------+-----------------------+----------------+----------+------------+------------
docs/cli-reference.md        | sync_required | sync_required   | 同步更新相关文档       | auto           | high     | 0.95       | 1
docs/configuration.md        | references    | references      | 审阅是否需要同步       | suggest        | medium   | 0.72       | 1
总数: 2
```

如果你更适合把结果交给脚本或 AI IDE 处理，添加 `--json`：

```bash
npx cord impact docs/getting-started.md --json
```

## 5. 查询文档关系

影响分析回答“我改了这个文档，哪些文档受影响”；关系查询回答“这个文档当前连到哪些文档”。

```bash
npx cord query docs/getting-started.md --depth 2
```

常用过滤：

```bash
npx cord query docs/getting-started.md --type sync_required
npx cord query docs/getting-started.md --include-deprecated
```

## 6. 查看当前状态

```bash
npx cord status
```

典型输出：

```text
CORD 状态概览
图谱健康
文档数: 42
关系总数: 96
按类型分布: references=30, sync_required=18
最后扫描: 2026-05-19T12:00:00.000Z
迁移版本: 2
过时关系: 0
孤立节点: 3
悬空关系: 0
配置状态
配置文件: /path/to/project/cord.config.yaml
framework: bmad
scanPaths: _bmad-output, docs
excludePaths: src/, node_modules/, .git/, dist/, _bmad/
confidenceThreshold: 0.50
```

## 下一步

- 需要完整 CLI 参数时，阅读 [CLI 参考](cli-reference.md)。
- 需要让 AI IDE 调用 CORD 时，阅读 [MCP Tools 参考](mcp-tools-reference.md)。
- 需要调整扫描路径、框架适配或更新策略时，阅读 [配置参考](configuration.md)。
