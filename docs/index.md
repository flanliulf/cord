# CORD Documentation Index

[English](index.md) | [简体中文](index.zh.md)

This index helps different readers find the right document quickly. If you are using CORD for the first time, start with [Getting Started](getting-started.md). If you are preparing a PR, start with the [Contributing Guide](contributing.md).

## User Documentation

| Goal                               | Document                                      | Description                                                                   |
| ---------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Install and run the first workflow | [Getting Started](getting-started.md)         | Installation, initialization, scanning, and first impact analysis.            |
| Look up CLI commands               | [CLI Reference](cli-reference.md)             | 6 CLI commands, options, JSON output, and exit codes.                         |
| Connect an AI IDE                  | [MCP Tools Reference](mcp-tools-reference.md) | 7 MCP Tools, input/output schemas, and call examples.                         |
| Adjust configuration               | [Configuration Reference](configuration.md)   | `cord.config.yaml/json`, scan paths, IDEs, frameworks, and update strategies. |

## Contributor Documentation

| Goal                                       | Document                                    | Description                                                                     |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Prepare a code, docs, or test contribution | [Contributing Guide](contributing.md)       | Local setup, validation commands, PR requirements, and review flow.             |
| Add a framework adapter                    | [Framework Adapter Guide](adapter-guide.md) | Adapter API, registration flow, minimal implementation path, and test guidance. |
| Develop and troubleshoot locally           | [Development Guide](development-guide.md)   | Build, test, local CLI/MCP validation, and common troubleshooting.              |

## Project Understanding

These documents are useful for maintainers and deeper contributors who need to understand CORD internals.

| Topic               | Document                                           |
| ------------------- | -------------------------------------------------- |
| Project overview    | [project-overview.md](project-overview.md)         |
| Architecture        | [architecture.md](architecture.md)                 |
| Source tree         | [source-tree-analysis.md](source-tree-analysis.md) |
| Component inventory | [component-inventory.md](component-inventory.md)   |
| Data models         | [data-models.md](data-models.md)                   |

## Common Reading Paths

### I Want To Start Using CORD

1. [Getting Started](getting-started.md)
2. [CLI Reference](cli-reference.md)
3. [Configuration Reference](configuration.md)

### I Want An AI IDE To Use CORD

1. [Getting Started](getting-started.md)
2. [MCP Tools Reference](mcp-tools-reference.md)
3. [Configuration Reference](configuration.md#ide-configuration-templates)

### I Want To Contribute A Framework Adapter

1. [Contributing Guide](contributing.md)
2. [Framework Adapter Guide](adapter-guide.md)
3. [Development Guide](development-guide.md)

### I Want To Change CLI, MCP, Or Storage Behavior

1. [Architecture](architecture.md)
2. [Component Inventory](component-inventory.md)
3. Synchronize the corresponding user reference: CLI changes update [CLI Reference](cli-reference.md), MCP changes update [MCP Tools Reference](mcp-tools-reference.md), and configuration changes update [Configuration Reference](configuration.md).

## Maintainer Internal Materials

`_bmad-output/` stores process artifacts such as the PRD, architectural decisions, epics, stories, code reviews, and retrospectives. They are useful for maintainers tracing decisions, but they are not required for normal CORD usage.

- [AI agent primary rule file](../_bmad-output/project-context.md)
- [PRD](../_bmad-output/planning-artifacts/prd.md)
- [Architecture decision index](../_bmad-output/planning-artifacts/architecture/00-index.md)
- [Epic planning index](../_bmad-output/planning-artifacts/epics/index.md)
- [Sprint status](../_bmad-output/implementation-artifacts/sprint-status.yaml)

DP scan state is stored in [project-scan-report.json](project-scan-report.json).
