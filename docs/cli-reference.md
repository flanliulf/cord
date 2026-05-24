# CLI Reference

[English](cli-reference.md) | [简体中文](cli-reference.zh.md)

CORD CLI command names use kebab-case. The current top-level command is `cord`. Business errors return structured error information and suggestions. Commands that support JSON output emit machine-readable JSON when `--json` is used.

## Global Usage

```bash
cord [global-options] <command> [command-options]
```

Global options:

| Option          | Description            |
| --------------- | ---------------------- |
| `-V, --version` | Print current version. |
| `-h, --help`    | Print help.            |
| `-v, --verbose` | Enable debug output.   |

Current version: `0.1.0`.

## `cord init`

Initialize CORD configuration, IDE integration, and the data directory for the current project.

### Usage

```bash
cord init [options]
```

### Arguments

No positional arguments.

### Options

| Option              | Description                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| `--ide <name>`      | Explicit IDE. Valid values: `claude-code`, `cursor`, `vscode-copilot`, `codex-cli`. |
| `--format <format>` | Configuration file format. Valid values: `yaml`, `json`. Default: `yaml`.           |
| `--json`            | Output machine-readable JSON and skip the interactive wizard.                       |

### Examples

```bash
cord init --ide vscode-copilot
```

Example output:

```text
✅ CORD initialized
IDE: vscode-copilot
Framework: bmad
Config file: /path/to/project/cord.config.yaml
Data directory: /path/to/project/.cord
Generated/updated files:
- .github/copilot-instructions.md
- .vscode/mcp.json
- AGENTS.md
```

JSON example:

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

Scan project documents and build the relationship graph.

### Usage

```bash
cord scan [options]
```

### Arguments

No positional arguments. The scan scope comes from `cord.config.yaml` or `cord.config.json`; if no config file exists, default configuration is used.

### Options

| Option      | Description                                                                          |
| ----------- | ------------------------------------------------------------------------------------ |
| `--rebuild` | Fully rebuild the graph.                                                             |
| `--force`   | Use with `--rebuild` to skip manual relationship confirmation. Errors if used alone. |
| `--json`    | Output JSON.                                                                         |

### Examples

```bash
cord scan --rebuild --force
```

Example output:

```text
Scan complete
Documents: 42
Relations: 96
Duration: 128ms
Warnings: 0
```

JSON example:

```bash
cord scan --json
```

```json
{ "documentsFound": 42, "relationsDiscovered": 96, "warnings": [], "durationMs": 128 }
```

## `cord query`

Query relationships for a document, with 1 to 3 hops of traversal.

### Usage

```bash
cord query <doc> [options]
```

### Arguments

| Argument | Description                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `<doc>`  | Document path to query. It must be inside the project root and is normalized to a project-relative POSIX path. |

### Options

| Option                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `--type <relationType>` | Filter by relationship type.                    |
| `--depth <depth>`       | Traversal depth from 1 to 3. Default: `1`.      |
| `--include-deprecated`  | Include relationships with `status=deprecated`. |
| `--json`                | Output JSON.                                    |

Relationship type values: `sync_required`, `context_for`, `lifecycle_bound`, `contains`, `must_consistent`, `sync_suggested`, `derived_from`, `deprecated`, `references`.

### Examples

```bash
cord query docs/getting-started.md --depth 2 --type references
```

Example output:

```text
relationId | targetPath               | relationType | confidence | source    | status | hopDistance
-----------+--------------------------+--------------+------------+-----------+--------+------------
rel_01     | docs/cli-reference.md    | references   | 0.82       | auto_scan | active | 1
rel_02     | docs/configuration.md    | references   | 0.76       | manual    | active | 2
Total: 2
```

JSON example:

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

Analyze which documents are affected by a document change.

### Usage

```bash
cord impact <doc> [options]
```

### Arguments

| Argument | Description                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `<doc>`  | Changed document path. It must be inside the project root and is normalized to a project-relative POSIX path. |

### Options

| Option                           | Description                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--confidence-threshold <value>` | Minimum confidence threshold from 0.0 to 1.0. If omitted, uses `confidenceThreshold` from config; default: 0.50. |
| `--json`                         | Output JSON.                                                                                                     |

### Examples

```bash
cord impact docs/prd.md --confidence-threshold 0.7
```

Example output:

```text
docPath                  | relationType  | propagationType | suggestedAction       | updateStrategy | severity | confidence | hopDistance
-------------------------+---------------+-----------------+-----------------------+----------------+----------+------------+------------
docs/architecture.md     | sync_required | sync_required   | Sync related document | auto           | high     | 0.93       | 1
docs/epics/epic-1.md     | derived_from  | derived_from    | Review derived docs   | suggest        | medium   | 0.78       | 2
Total: 2
```

JSON example:

```json
{
  "impactedDocs": [
    {
      "docPath": "docs/architecture.md",
      "relationType": "sync_required",
      "propagationType": "sync_required",
      "suggestedAction": "Sync related document",
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

Export the complete relationship graph as a JSON snapshot file.

### Usage

```bash
cord export [options]
```

### Arguments

No positional arguments.

### Options

| Option            | Description                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--output <path>` | Export file path. Defaults to `cord-snapshot.json` in the project root. The path must stay inside the project root. |
| `--json`          | Output JSON.                                                                                                        |

### Examples

```bash
cord export --output snapshots/graph.json
```

Example output:

```text
Export complete
File: snapshots/graph.json
schemaVersion: 1.0
Documents: 42
Relations: 96
```

JSON example:

```json
{
  "outputPath": "snapshots/graph.json",
  "snapshot": { "schemaVersion": "1.0", "documents": [], "relations": [] }
}
```

## `cord status`

Show current CORD configuration status and graph health. This is a read-only command. If `.cord/cord.db` does not exist, it returns uninitialized status and does not create a database just for reading.

### Usage

```bash
cord status [options]
```

### Arguments

No positional arguments.

### Options

| Option   | Description  |
| -------- | ------------ |
| `--json` | Output JSON. |

### Examples

```bash
cord status
```

Example output:

```text
CORD status overview
Graph health
Documents: 42
Relations: 96
By type: references=30, sync_required=18
Last scan: 2026-05-19T12:00:00.000Z
Migration version: 2
Stale relations: 0
Orphaned nodes: 3
Dangling edges: 0
Configuration
Config file: /path/to/project/cord.config.yaml
framework: bmad
scanPaths: _bmad-output, docs
excludePaths: src/, node_modules/, .git/, dist/, _bmad/
confidenceThreshold: 0.50
```

JSON example:

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

## Exit Codes

| Exit code | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `0`       | Success.                                             |
| `1`       | Runtime error or user cancellation.                  |
| `2`       | Configuration, argument, or schema validation error. |

## MCP-Only Capabilities

Relationship management is currently exposed through MCP Tools. There are no matching CLI subcommands. To manually correct the document graph, call `add_relation`, `remove_relation`, or `deprecate_relation` from the [MCP Tools Reference](mcp-tools-reference.md) in an AI IDE.

## Path Rules

`query`, `impact`, and `export --output` trim whitespace first, then normalize paths to project-relative POSIX paths. Empty paths, paths outside the project root, `..`, and `../...` are rejected with `ConfigError`.
