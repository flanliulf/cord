# Configuration Reference

[English](configuration.md) | [简体中文](configuration.zh.md)

CORD configuration lives in the project root. The recommended format is `cord.config.yaml`; `cord.config.json` is also supported. Loading order is fixed: CORD checks `cord.config.yaml` first, then `cord.config.json`. If both exist, YAML wins.

## Quick Templates

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

`<schema-url>` is a documentation placeholder. Runtime validation currently comes from the source Zod `configSchema`. Replace the JSON Schema URL with the real published address after release.

## Configuration Fields

All fields are optional. When a field is missing, CORD merges defaults.

| Field                 | Type                                                | Default                                                                           | Description                                                                                                               |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `projectName`         | `string`                                            | Caller falls back to the project root directory name                              | Display name used in user-facing output such as exports.                                                                  |
| `framework`           | `string`                                            | Auto-detected, eventually falling back to `generic`                               | Framework adapter name such as `bmad` or `generic`. When explicitly configured, CORD does not auto-detect other adapters. |
| `ide`                 | `string`                                            | Determined by `cord init` detection or CLI option                                 | IDE type such as `claude-code`, `cursor`, `vscode-copilot`, or `codex-cli`.                                               |
| `scanPaths`           | `string[]`                                          | `['.']`, or overridden by a framework adapter                                     | Paths to scan.                                                                                                            |
| `excludePaths`        | `string[]`                                          | `['src/', 'node_modules/', '.git/', 'dist/']`, or extended by a framework adapter | Paths excluded from scanning.                                                                                             |
| `confidenceThreshold` | `number`                                            | `0.5`                                                                             | Minimum confidence threshold for impact analysis, from 0 to 1.                                                            |
| `relationTypes`       | `Record<RelationType, { enabled: boolean }>`        | Built-in relationship type defaults when not configured                           | Enables or disables the 9 built-in relationship types.                                                                    |
| `adapters`            | `string[]`                                          | Not configured                                                                    | Enabled framework adapter module names.                                                                                   |
| `updateStrategies`    | `Record<string, 'auto' \| 'suggest' \| 'log_only'>` | Falls back to `suggest` when no document type matches                             | Synchronization strategy by document type; keys are `docType` values.                                                     |

Built-in relationship types: `sync_required`, `context_for`, `lifecycle_bound`, `contains`, `must_consistent`, `sync_suggested`, `derived_from`, `deprecated`, `references`.

## Loading Rules

1. Look for `cord.config.yaml` in the project root.
2. If YAML does not exist, look for `cord.config.json`.
3. If neither exists, use default configuration: `scanPaths: ['.']`, `excludePaths: ['src/', 'node_modules/', '.git/', 'dist/']`, `confidenceThreshold: 0.5`.
4. If the configuration file exists but has syntax errors, throw `ConfigError`.
5. After parsing succeeds, validate the config with Zod `configSchema`; invalid config throws `CORD_SCHEMA_003`.

## `cord init` Generation Rules

Generate YAML by default:

```bash
cord init --ide vscode-copilot
```

Generate JSON:

```bash
cord init --ide vscode-copilot --format json
```

`cord init` writes base configuration according to IDE and framework detection, then creates the `.cord/` data directory. The current source initialization config includes `framework`, `ide`, `scanPaths`, `excludePaths`, and `confidenceThreshold`. If you need `projectName`, `relationTypes`, `adapters`, or `updateStrategies`, add them after initialization.

## Framework Adapter Configuration

Framework adapter selection is decided by `config.framework` and automatic detection.

### Explicit Selection

```yaml
framework: bmad
```

When explicitly configured, CORD looks up the adapter by name only. If no adapter matches, it throws `CORD_CONFIG_004` and does not continue with auto-detection.

### Auto-Detection

When `framework` is not set, CORD calls `detectFramework(projectRoot)` on each registered adapter in order. The current built-in order is:

1. `bmad`
2. `generic`

`generic` always matches, so it is the final fallback.

### Default Scan Boundaries

| Adapter   | Default scan paths     | Default exclude paths                               |
| --------- | ---------------------- | --------------------------------------------------- |
| `bmad`    | `_bmad-output`, `docs` | `src/`, `node_modules/`, `.git/`, `dist/`, `_bmad/` |
| `generic` | Inherits default `.`   | `src/`, `node_modules/`, `.git/`, `dist/`           |

If configuration explicitly provides `scanPaths` or `excludePaths`, each adapter merges or overrides default boundaries according to its implementation.

## IDE Configuration Templates

### Claude Code

`.claude/settings.json`:

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

`.claude/rules/cord-relations.md` instructs the AI to call `query_relations` before editing documents, `analyze_impact` after editing, and `sync_docs` when synchronization suggestions are needed.

### Cursor

`.cursor/mcp.json`:

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

`.cursor/rules/cord-relations.mdc` generates CORD document relationship maintenance rules for Markdown and `docs/**/*`.

### VS Code Copilot

`.vscode/mcp.json`:

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

`.github/copilot-instructions.md` contains CORD usage conventions. `AGENTS.md` is shared by Copilot and Codex CLI. If it already exists, CORD only appends or updates its own block between `<!-- CORD:START -->` and `<!-- CORD:END -->`.

### Codex CLI

Codex CLI currently uses only the shared `AGENTS.md` block:

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

## YAML, JSON, And JSON Schema Rules

- YAML is the recommended format. The file name is `cord.config.yaml`.
- JSON is equivalently supported. The file name is `cord.config.json`.
- Both formats share the same Zod `configSchema`, so field names, types, and validation rules are identical.
- If both formats exist, `cord.config.yaml` takes precedence.
- JSON Schema should be exported from the same Zod schema for IDE completion and configuration validation.
- YAML may declare the schema with a file header comment: `# yaml-language-server: $schema=<schema-url>`.
- JSON may declare the schema with top-level `$schema`.

## Common Configuration Snippets

Scan only the docs directory:

```yaml
scanPaths:
  - docs
excludePaths:
  - node_modules/
  - .git/
  - dist/
```

Raise the impact analysis threshold:

```yaml
confidenceThreshold: 0.75
```

Set update strategies by document type:

```yaml
updateStrategies:
  prd: auto
  architecture: suggest
  retrospective: log_only
```

Disable weak reference relationships:

```yaml
relationTypes:
  references:
    enabled: false
```
