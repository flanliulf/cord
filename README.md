# CORD

[English](README.md) | [简体中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/cord.svg)](https://www.npmjs.com/package/cord)
[![CI](https://github.com/fancyliu/cord/actions/workflows/ci.yml/badge.svg)](https://github.com/fancyliu/cord/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen.svg)](./coverage/coverage-summary.json)
[![GitHub stars](https://img.shields.io/github/stars/fancyliu/cord?style=social)](https://github.com/fancyliu/cord/stargazers)

CORD is a document relationship graph engine for AI-assisted development. It uses deterministic scanning, querying, and impact analysis to keep requirements, architecture, epics, stories, and user documentation aligned as they evolve.

The core idea is: deterministic beats inferential. CORD does not ask AI to guess which documents might be affected. It first writes document relationships into a local graph, then lets the CLI or MCP Tools answer questions from the same structured contract.

## Who It Is For

- Teams maintaining layered documentation such as requirements, architecture, epics, stories, and user docs.
- Developers who want AI IDEs to query upstream and downstream document context before and after edits.
- Framework maintainers who want to add scanning rules and preset relationships for their own documentation framework.

## Quick Start

```bash
npm install -D cord
npx cord init --ide vscode-copilot
npx cord scan --rebuild --force
npx cord impact docs/getting-started.md
```

Replace `docs/getting-started.md` with the Markdown document path that changed in your project.

For the full first-run walkthrough, see [docs/getting-started.md](docs/getting-started.md).

## Basic Workflow

1. `cord init` creates project configuration, IDE MCP configuration, and the local data directory.
2. `cord scan` scans Markdown documents and writes the graph to `.cord/cord.db`.
3. `cord query` or MCP `query_relations` checks upstream and downstream relationships before edits.
4. `cord impact` or MCP `analyze_impact` analyzes the synchronization scope after edits.
5. When needed, MCP `add_relation`, `remove_relation`, and `deprecate_relation` correct the document graph.

## Features

- Scan Markdown documents and build a local SQLite relationship graph.
- Query 1 to 3 hops of relationships for a document, with relation type and deprecated-status filters.
- Analyze the impact scope of document changes, including suggested action, severity, update strategy, and confidence.
- Export a complete relationship graph JSON snapshot.
- Expose 7 structured MCP Tools for AI IDEs.
- Manually add, remove, or deprecate relationships through MCP Tools to correct the document graph.
- Support framework adapters. Built-in adapters currently include BMAD and Generic.

## IDE Support Matrix

AI IDE integrations use MCP Tools for relationship queries, impact analysis, and relationship correction. The CLI covers initialization, scanning, querying, impact analysis, export, and status checks.

| IDE             | Init option            | Generated files                                                                  |
| --------------- | ---------------------- | -------------------------------------------------------------------------------- |
| Claude Code     | `--ide claude-code`    | `.claude/settings.json`, rule file, PostToolUse Hook, CORD Skills                |
| Cursor          | `--ide cursor`         | `.cursor/mcp.json`, `.cursor/rules/cord-relations.mdc`                           |
| VS Code Copilot | `--ide vscode-copilot` | `.vscode/mcp.json`, `.github/copilot-instructions.md`, CORD block in `AGENTS.md` |
| Codex CLI       | `--ide codex-cli`      | CORD block in `AGENTS.md`                                                        |

If `--ide` is omitted, `cord init` attempts to detect IDE configuration in the current project. When multiple candidates are detected, interactive terminals prompt for a choice. In non-interactive environments, pass `--ide` explicitly.

## Documentation

| Goal                                                                             | Document                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| Install, initialize, and run first impact analysis                               | [Getting Started](docs/getting-started.md)         |
| Look up CLI commands, options, and exit codes                                    | [CLI Reference](docs/cli-reference.md)             |
| Let an AI IDE call CORD                                                          | [MCP Tools Reference](docs/mcp-tools-reference.md) |
| Configure scan paths, IDE integration, framework adapters, and update strategies | [Configuration Reference](docs/configuration.md)   |
| Contribute code, docs, or tests                                                  | [Contributing Guide](docs/contributing.md)         |
| Add a framework adapter                                                          | [Framework Adapter Guide](docs/adapter-guide.md)   |
| Browse all public docs                                                           | [Documentation Index](docs/index.md)               |

## Developing This Repository

```bash
npm install
npm run build
npm run test
```

After building, the source checkout CLI entry point is available at `dist/cli/index.js`:

```bash
node dist/cli/index.js status
```

## Contributing

Before contributing docs, framework adapters, or tests, read [docs/contributing.md](docs/contributing.md). Framework adapter contributors should also read [docs/adapter-guide.md](docs/adapter-guide.md).

If you are unsure where a change belongs, start from [docs/index.md](docs/index.md), then describe the user or contributor docs you synchronized in the PR.

## License

MIT
