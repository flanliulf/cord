# 配置参考

[English](configuration.md) | [简体中文](configuration.zh.md)

CORD 配置文件位于项目根目录。推荐格式是 `cord.config.yaml`，同时支持 `cord.config.json`。加载优先级固定为：先查找 `cord.config.yaml`，再查找 `cord.config.json`；两者同时存在时，YAML 生效。

## 快速模板

### YAML

```yaml
# yaml-language-server: $schema=<schema-url>
projectName: CORD
framework: bmad
ide: vscode-copilot
scanPaths:
  - _bmad-output
  - docs
excludePaths:
  - src/
  - node_modules/
  - .git/
  - dist/
  - _bmad/
confidenceThreshold: 0.5
relationTypes:
  sync_required:
    enabled: true
  references:
    enabled: true
adapters:
  - bmad
updateStrategies:
  prd: auto
  story: suggest
  technical-research: log_only
```

### JSON

```json
{
  "$schema": "<schema-url>",
  "projectName": "CORD",
  "framework": "bmad",
  "ide": "vscode-copilot",
  "scanPaths": ["_bmad-output", "docs"],
  "excludePaths": ["src/", "node_modules/", ".git/", "dist/", "_bmad/"],
  "confidenceThreshold": 0.5,
  "relationTypes": {
    "sync_required": { "enabled": true },
    "references": { "enabled": true }
  },
  "adapters": ["bmad"],
  "updateStrategies": {
    "prd": "auto",
    "story": "suggest",
    "technical-research": "log_only"
  }
}
```

`<schema-url>` 是文档模板占位。当前运行时校验来源是源码中的 Zod `configSchema`，JSON Schema 发布地址可在项目发布后替换为实际地址。

## 配置项

所有配置项都是可选项。未配置时，CORD 会合并默认值。

| 配置项                | 类型                                                | 默认值                                                            | 说明                                                                         |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `projectName`         | `string`                                            | 调用方回退到项目根目录名                                          | 项目显示名，用于导出快照等面向用户的输出。                                   |
| `framework`           | `string`                                            | 自动检测，最终可回退到 `generic`                                  | 框架适配器名称，例如 `bmad` 或 `generic`。显式配置后不再自动检测其他适配器。 |
| `ide`                 | `string`                                            | 由 `cord init` 检测或命令行参数决定                               | IDE 类型，例如 `claude-code`、`cursor`、`vscode-copilot`、`codex-cli`。      |
| `scanPaths`           | `string[]`                                          | `['.']`，或由框架适配器覆盖                                       | 参与扫描的路径列表。                                                         |
| `excludePaths`        | `string[]`                                          | `['src/', 'node_modules/', '.git/', 'dist/']`，或由框架适配器扩展 | 扫描排除路径。                                                               |
| `confidenceThreshold` | `number`                                            | `0.5`                                                             | 影响分析最低置信度阈值，范围 0 到 1。                                        |
| `relationTypes`       | `Record<RelationType, { enabled: boolean }>`        | 未配置时使用内置关系类型默认行为                                  | 控制 9 类内置关系是否启用。                                                  |
| `adapters`            | `string[]`                                          | 未配置                                                            | 启用的框架适配模块名称列表。                                                 |
| `updateStrategies`    | `Record<string, 'auto' \| 'suggest' \| 'log_only'>` | 未命中文档类别时回退到 `suggest`                                  | 按文档类别配置同步策略，键为 docType。                                       |

内置关系类型：`sync_required`、`context_for`、`lifecycle_bound`、`contains`、`must_consistent`、`sync_suggested`、`derived_from`、`deprecated`、`references`。

## 加载规则

1. 从项目根目录查找 `cord.config.yaml`。
2. 如果 YAML 不存在，再查找 `cord.config.json`。
3. 如果都不存在，使用默认配置：`scanPaths: ['.']`、`excludePaths: ['src/', 'node_modules/', '.git/', 'dist/']`、`confidenceThreshold: 0.5`。
4. 配置文件存在但语法错误时抛出 `ConfigError`。
5. 配置文件解析成功后必须通过 Zod `configSchema` 校验，否则抛出 `CORD_SCHEMA_003`。

## `cord init` 生成规则

默认生成 YAML：

```bash
cord init --ide vscode-copilot
```

生成 JSON：

```bash
cord init --ide vscode-copilot --format json
```

`cord init` 会根据 IDE 和框架检测结果写入基础配置，并创建 `.cord/` 数据目录。当前源码中的初始化配置包含：`framework`、`ide`、`scanPaths`、`excludePaths`、`confidenceThreshold`。如果需要 `projectName`、`relationTypes`、`adapters` 或 `updateStrategies`，可以在初始化后手动添加。

## 框架适配配置

框架适配由 `config.framework` 和自动检测共同决定。

### 显式指定

```yaml
framework: bmad
```

显式指定时，CORD 只按名称查找适配器。找不到时抛出 `CORD_CONFIG_004`，不会继续尝试自动检测。

### 自动检测

未设置 `framework` 时，CORD 按注册表顺序调用每个适配器的 `detectFramework(projectRoot)`。当前内置顺序是：

1. `bmad`
2. `generic`

`generic` 恒定命中，因此作为最后兜底。

### 默认扫描边界

| 适配器    | 默认扫描路径           | 默认排除路径                                        |
| --------- | ---------------------- | --------------------------------------------------- |
| `bmad`    | `_bmad-output`、`docs` | `src/`、`node_modules/`、`.git/`、`dist/`、`_bmad/` |
| `generic` | 继承默认 `.`           | `src/`、`node_modules/`、`.git/`、`dist/`           |

如果配置中显式提供 `scanPaths` 或 `excludePaths`，适配器会按自身实现合并或覆盖默认边界。

## IDE 配置文件模板

### Claude Code

`.claude/settings.json`：

```json
{
  "mcpServers": {
    "cord": {
      "command": "node",
      "args": ["./dist/mcp/server.js"]
    }
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "./.claude/hooks/cord-post-edit.sh \"$TOOL_INPUT_PATH\""
      }
    ]
  }
}
```

`.claude/rules/cord-relations.md` 会提示 AI 在编辑文档前调用 `query_relations`，编辑后调用 `analyze_impact`，需要同步建议时调用 `sync_docs`。

### Cursor

`.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "cord": {
      "command": "node",
      "args": ["./dist/mcp/server.js"]
    }
  }
}
```

`.cursor/rules/cord-relations.mdc` 会生成 CORD 文档关系维护规则，作用于 Markdown 和 `docs/**/*`。

### VS Code Copilot

`.vscode/mcp.json`：

```json
{
  "servers": {
    "cord": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js"]
    }
  }
}
```

`.github/copilot-instructions.md` 会写入 CORD 调用约定。`AGENTS.md` 是 Copilot 与 Codex CLI 的共享文件；已存在时，CORD 只在 `<!-- CORD:START -->` 和 `<!-- CORD:END -->` 注释边界内追加或更新 CORD 专属段。

### Codex CLI

Codex CLI 当前只使用共享 `AGENTS.md` 段：

```markdown
<!-- CORD:START -->

# CORD Integration

- Use `query_relations` before editing a document whose upstream/downstream context is unclear.
- Use `analyze_impact` after changing PRD, architecture, epic, story, or other specification documents.
- Use `sync_docs` when CORD reports that related documents are drifting.
- If `.cord/cord.db` does not exist yet, run `init_graph` first to initialize the graph.
- Prefer native IDE instruction files when present: `.claude/rules/cord-relations.md`, `.cursor/rules/cord-relations.mdc`, `.github/copilot-instructions.md`.
<!-- CORD:END -->
```

## YAML、JSON 与 JSON Schema 规则

- YAML 是推荐格式，文件名为 `cord.config.yaml`。
- JSON 是等价支持格式，文件名为 `cord.config.json`。
- 两种格式共享同一个 Zod `configSchema`，因此字段名、类型和校验规则一致。
- 两种格式同时存在时，`cord.config.yaml` 优先。
- JSON Schema 应从同一份 Zod schema 导出，供 IDE 自动补全和配置校验使用。
- YAML 可用文件头注释声明 schema：`# yaml-language-server: $schema=<schema-url>`。
- JSON 可用顶层 `$schema` 字段声明 schema。

## 常见配置片段

只扫描文档目录：

```yaml
scanPaths:
  - docs
excludePaths:
  - node_modules/
  - .git/
  - dist/
```

提高影响分析阈值：

```yaml
confidenceThreshold: 0.75
```

按文档类别设置更新策略：

```yaml
updateStrategies:
  prd: auto
  architecture: suggest
  retrospective: log_only
```

禁用弱引用关系：

```yaml
relationTypes:
  references:
    enabled: false
```
