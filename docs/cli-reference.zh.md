# CLI 参考

[English](cli-reference.md) | [简体中文](cli-reference.zh.md)

CORD CLI 命令名使用 kebab-case，当前顶层命令为 `cord`。所有命令的业务错误会返回结构化错误信息和建议；支持 JSON 输出的命令会在 `--json` 模式下输出机器可读 JSON。

## 全局用法

```bash
cord [global-options] <command> [command-options]
```

全局选项：

| 选项            | 说明           |
| --------------- | -------------- |
| `-V, --version` | 输出当前版本。 |
| `-h, --help`    | 输出帮助信息。 |
| `-v, --verbose` | 启用调试输出。 |

`--version` 输出当前安装的 CORD package 版本。

## `cord init`

一键初始化当前项目的 CORD 配置、IDE 集成与数据目录。

### 用法

```bash
cord init [options]
```

### 参数

无位置参数。

### 选项

| 选项                | 说明                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `--ide <name>`      | 显式指定 IDE。可选值：`claude-code`、`cursor`、`vscode-copilot`、`codex-cli`。 |
| `--format <format>` | 配置文件格式。可选值：`yaml`、`json`。默认 `yaml`。                            |
| `--json`            | 输出机器可读 JSON，并跳过交互向导。                                            |

### 示例

```bash
cord init --ide vscode-copilot
```

示例输出：

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

JSON 示例：

```bash
cord init --ide cursor --format json --json
```

```json
{
  "ide": "cursor",
  "framework": "generic",
  "configPath": "/path/to/project/cord.config.json",
  "dataDirectory": "/path/to/project/.cord",
  "generatedFiles": [".cursor/mcp.json", ".cursor/rules/cord-relations.mdc", "cord.config.json"],
  "generatedSkills": []
}
```

## `cord scan`

扫描项目文档并构建关系图谱。

### 用法

```bash
cord scan [options]
```

### 参数

无位置参数。扫描范围来自 `cord.config.yaml` 或 `cord.config.json`；没有配置文件时使用默认配置。

### 选项

| 选项        | 说明                                                            |
| ----------- | --------------------------------------------------------------- |
| `--rebuild` | 完全重建图谱。                                                  |
| `--force`   | 与 `--rebuild` 一起使用，跳过 manual 关系确认。单独使用会报错。 |
| `--json`    | JSON 格式输出。                                                 |

### 示例

```bash
cord scan --rebuild --force
```

示例输出：

```text
扫描完成
文档数: 42
关系数: 96
耗时: 128ms
警告: 0
```

JSON 示例：

```bash
cord scan --json
```

```json
{ "documentsFound": 42, "relationsDiscovered": 96, "warnings": [], "durationMs": 128 }
```

## `cord query`

查询指定文档的关联关系，支持 1 到 3 跳遍历。

### 用法

```bash
cord query <doc> [options]
```

### 参数

| 参数    | 说明                                                                           |
| ------- | ------------------------------------------------------------------------------ |
| `<doc>` | 待查询文档路径。必须位于项目根目录内，会归一化为 project-relative POSIX 路径。 |

### 选项

| 选项                    | 说明                              |
| ----------------------- | --------------------------------- |
| `--type <relationType>` | 按关系类型过滤。                  |
| `--depth <depth>`       | 遍历深度，范围 1 到 3，默认 1。   |
| `--include-deprecated`  | 包含 `status=deprecated` 的关系。 |
| `--json`                | JSON 格式输出。                   |

关系类型可选值：`sync_required`、`context_for`、`lifecycle_bound`、`contains`、`must_consistent`、`sync_suggested`、`derived_from`、`deprecated`、`references`。

### 示例

```bash
cord query docs/getting-started.md --depth 2 --type references
```

示例输出：

```text
relationId | targetPath               | relationType | confidence | source    | status | hopDistance
-----------+--------------------------+--------------+------------+-----------+--------+------------
rel_01     | docs/cli-reference.md    | references   | 0.82       | auto_scan | active | 1
rel_02     | docs/configuration.md    | references   | 0.76       | manual    | active | 2
总数: 2
```

JSON 示例：

```json
{
  "relations": [
    {
      "relationId": "rel_01",
      "targetPath": "docs/cli-reference.md",
      "relationType": "references",
      "confidence": 0.82,
      "source": "auto_scan",
      "status": "active",
      "hopDistance": 1
    }
  ],
  "totalCount": 1
}
```

## `cord impact`

分析指定文档变更的影响范围。

### 用法

```bash
cord impact <doc> [options]
```

### 参数

| 参数    | 说明                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| `<doc>` | 发生变更的文档路径。必须位于项目根目录内，会归一化为 project-relative POSIX 路径。 |

### 选项

| 选项                             | 说明                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `--confidence-threshold <value>` | 最低置信度阈值，范围 0.0 到 1.0。未传时使用配置中的 `confidenceThreshold`，默认 0.50。 |
| `--json`                         | JSON 格式输出。                                                                        |

### 示例

```bash
cord impact docs/prd.md --confidence-threshold 0.7
```

示例输出：

```text
docPath                  | relationType  | propagationType | suggestedAction | updateStrategy | severity | confidence | hopDistance
-------------------------+---------------+-----------------+-----------------+----------------+----------+------------+------------
docs/architecture.md     | sync_required | sync_required   | 同步更新相关文档 | auto           | high     | 0.93       | 1
docs/epics/epic-1.md     | derived_from  | derived_from    | 审阅派生内容     | suggest        | medium   | 0.78       | 2
总数: 2
```

JSON 示例：

```json
{
  "impactedDocs": [
    {
      "docPath": "docs/architecture.md",
      "relationType": "sync_required",
      "propagationType": "sync_required",
      "suggestedAction": "同步更新相关文档",
      "updateStrategy": "auto",
      "severity": "high",
      "confidence": 0.93,
      "hopDistance": 1
    }
  ],
  "totalCount": 1
}
```

## `cord export`

导出完整关系图谱为 JSON 快照文件。

### 用法

```bash
cord export [options]
```

### 参数

无位置参数。

### 选项

| 选项              | 说明                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| `--output <path>` | 导出文件路径，默认为项目根目录下的 `cord-snapshot.json`。路径必须位于项目根目录内。 |
| `--json`          | JSON 格式输出。                                                                     |

### 示例

```bash
cord export --output snapshots/graph.json
```

示例输出：

```text
导出成功
文件: snapshots/graph.json
schemaVersion: 1.0
文档: 42
关系: 96
```

JSON 示例：

```json
{
  "outputPath": "snapshots/graph.json",
  "snapshot": { "schemaVersion": "1.0", "documents": [], "relations": [] }
}
```

## `cord status`

查看当前项目的 CORD 配置状态与图谱健康信息。该命令是只读命令；当 `.cord/cord.db` 不存在时返回未初始化状态，不会为了读取而创建数据库。

### 用法

```bash
cord status [options]
```

### 参数

无位置参数。

### 选项

| 选项     | 说明            |
| -------- | --------------- |
| `--json` | JSON 格式输出。 |

### 示例

```bash
cord status
```

示例输出：

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

JSON 示例：

```json
{
  "projectRoot": "/path/to/project",
  "documentCount": 42,
  "relationCount": 96,
  "relationsByType": { "references": 30, "sync_required": 18 },
  "lastScanTime": "2026-05-19T12:00:00.000Z",
  "migrationVersion": 2,
  "staleRelations": 0,
  "orphanedNodes": 3,
  "danglingEdges": 0,
  "configFilePath": "/path/to/project/cord.config.yaml",
  "framework": "bmad",
  "scanPaths": ["_bmad-output", "docs"],
  "excludePaths": ["src/", "node_modules/", ".git/", "dist/", "_bmad/"],
  "confidenceThreshold": 0.5
}
```

## 退出码

| 退出码 | 含义                           |
| ------ | ------------------------------ |
| `0`    | 成功。                         |
| `1`    | 运行时错误或用户取消。         |
| `2`    | 配置、参数或 schema 验证错误。 |

## 仅通过 MCP 提供的功能

关系管理当前通过 MCP Tools 暴露，CLI 没有对应子命令。如果需要手动修正文档图谱，请在 AI IDE 中调用 [MCP Tools 参考](mcp-tools-reference.zh.md) 中的 `add_relation`、`remove_relation` 或 `deprecate_relation`。

## 路径规则

`query`、`impact` 和 `export --output` 会先清理空白，再把路径归一化为 project-relative POSIX 路径。空路径、项目根目录外路径、`..` 或 `../...` 形式都会被拒绝并返回 `ConfigError`。
