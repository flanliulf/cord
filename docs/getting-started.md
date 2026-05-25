# Getting Started

[English](getting-started.md) | [简体中文](getting-started.zh.md)

This guide helps you initialize CORD, scan your document graph, and run the first impact analysis in about 5 minutes. CORD creates `.cord/cord.db` in your project to store document nodes, relationship edges, and scan state.

After completing this guide, you will have:

- A `cord.config.yaml` or `cord.config.json` file.
- A local graph database at `.cord/cord.db`.
- A reproducible document impact analysis result.
- If you choose an IDE, MCP configuration or instruction files that your AI IDE can use.

## Prerequisites

- Node.js 20 LTS or later.
- A project containing Markdown documents.
- Either direct CLI usage or an AI IDE that can call CORD through MCP integration.

## 1. Install

Install CORD in your project root:

```bash
npm install -D @fancyliu/cord
```

If you are developing or validating from this CORD source checkout, install dependencies and build first:

```bash
npm install
npm run build
```

After building from source, replace `npx cord` in examples with `node dist/cli/index.js`.

## 2. Initialize The Project

Choose the AI IDE used by the current project. This example targets VS Code Copilot:

```bash
npx cord init --ide vscode-copilot
```

Common IDE options:

| IDE             | Option                 |
| --------------- | ---------------------- |
| Claude Code     | `--ide claude-code`    |
| Cursor          | `--ide cursor`         |
| VS Code Copilot | `--ide vscode-copilot` |
| Codex CLI       | `--ide codex-cli`      |

By default, CORD generates `cord.config.yaml` and a `.cord/` data directory. If you prefer JSON configuration:

```bash
npx cord init --ide vscode-copilot --format json
```

If `--ide` is omitted, CORD attempts to detect IDE configuration in the current project. In non-interactive environments, pass `--ide` explicitly for stable initialization.

Typical output:

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

## 3. Scan The Document Graph

Scanning reads `scanPaths` and `excludePaths` from configuration, discovers Markdown documents, and writes them to the local graph.

For the first run, perform a full rebuild:

```bash
npx cord scan --rebuild --force
```

Typical output:

```text
Scan complete
Documents: 42
Relations: 96
Duration: 128ms
Warnings: 0
```

For daily use after the first scan, run an incremental scan:

```bash
npx cord scan
```

## 4. Run First Impact Analysis

After changing a document, run impact analysis. This example uses `docs/getting-started.md`; replace it with the Markdown document path that changed in your project:

```bash
npx cord impact docs/getting-started.md
```

Typical output:

```text
docPath                      | relationType  | propagationType | suggestedAction       | updateStrategy | severity | confidence | hopDistance
-----------------------------+---------------+-----------------+-----------------------+----------------+----------+------------+------------
docs/cli-reference.md        | sync_required | sync_required   | Sync related document | auto           | high     | 0.95       | 1
docs/configuration.md        | references    | references      | Review for sync need  | suggest        | medium   | 0.72       | 1
Total: 2
```

If you want to pass the result to a script or AI IDE, add `--json`:

```bash
npx cord impact docs/getting-started.md --json
```

## 5. Query Document Relationships

Impact analysis answers "I changed this document; which documents are affected?" Relationship query answers "Which documents is this document currently connected to?"

```bash
npx cord query docs/getting-started.md --depth 2
```

Common filters:

```bash
npx cord query docs/getting-started.md --type sync_required
npx cord query docs/getting-started.md --include-deprecated
```

If you need to correct automatically scanned results, call MCP Tools from an AI IDE to manually add, remove, or deprecate relationships. See [MCP Tools Reference](mcp-tools-reference.md) for schemas and examples.

## 6. Check Current Status

```bash
npx cord status
```

Typical output:

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

## Next Steps

- For complete CLI options, read [CLI Reference](cli-reference.md).
- To let an AI IDE call CORD, read [MCP Tools Reference](mcp-tools-reference.md).
- To adjust scan paths, framework adapters, or update strategies, read [Configuration Reference](configuration.md).
- To contribute code, docs, or tests, read [Contributing Guide](contributing.md).
