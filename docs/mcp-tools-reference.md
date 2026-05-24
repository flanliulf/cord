# MCP Tools Reference

[English](mcp-tools-reference.md) | [简体中文](mcp-tools-reference.zh.md)

CORD MCP Server exposes 7 tools over stdio. Tool names use snake_case, and argument fields use camelCase. All `inputSchema` and `outputSchema` definitions are named Zod schemas in `src/mcp/tools/schemas.ts` and are exported as JSON Schema. Core tool output semantics stay aligned with CLI `--json` output and Service DTOs.

## Tool Overview

| Tool                 | inputSchema              | outputSchema              | Access | Typical use                                                         |
| -------------------- | ------------------------ | ------------------------- | ------ | ------------------------------------------------------------------- |
| `analyze_impact`     | `AnalyzeImpactInput`     | `AnalyzeImpactResult`     | Read   | Determine affected documents after a change.                        |
| `query_relations`    | `QueryRelationsInput`    | `QueryRelationsResult`    | Read   | Inspect upstream and downstream relationships before editing.       |
| `init_graph`         | `InitGraphInput`         | `InitGraphResult`         | Write  | Initialize or rebuild the local graph.                              |
| `sync_docs`          | `SyncDocsInput`          | `SyncDocsResult`          | Read   | Generate synchronization suggestions from a single document change. |
| `add_relation`       | `AddRelationInput`       | `AddRelationResult`       | Write  | Manually add one document relationship.                             |
| `remove_relation`    | `RemoveRelationInput`    | `RemoveRelationResult`    | Write  | Physically delete a relationship by `relationId`.                   |
| `deprecate_relation` | `DeprecateRelationInput` | `DeprecateRelationResult` | Write  | Mark a relationship as deprecated by `relationId`.                  |

Relationship type values: `sync_required`, `context_for`, `lifecycle_bound`, `contains`, `must_consistent`, `sync_suggested`, `derived_from`, `deprecated`, `references`.

Relationship source values: `auto_scan`, `manual`, `framework_preset`.

Update strategy values: `auto`, `suggest`, `log_only`.

## `analyze_impact`

Analyze which documents are affected by a document change.

### When To Use

- An AI IDE saves a requirement, architecture, epic, story, or user document and needs the impact scope.
- A user asks, "I changed this file. Which files should be synchronized?"

### `AnalyzeImpactInput`

| Field                 | Type     | Required | Description                                                                        |
| --------------------- | -------- | -------- | ---------------------------------------------------------------------------------- |
| `docPath`             | `string` | Yes      | Document path to analyze. It must be inside the project root.                      |
| `confidenceThreshold` | `number` | No       | Minimum confidence threshold from 0 to 1. If omitted, uses the configured default. |

### `AnalyzeImpactResult`

| Field                            | Type                                                | Description                     |
| -------------------------------- | --------------------------------------------------- | ------------------------------- |
| `impactedDocs`                   | `array`                                             | Affected document list.         |
| `impactedDocs[].docPath`         | `string`                                            | Affected document path.         |
| `impactedDocs[].relationType`    | `RelationType`                                      | Matched relationship type.      |
| `impactedDocs[].propagationType` | `RelationType`                                      | Propagation type.               |
| `impactedDocs[].suggestedAction` | `string`                                            | Human-facing suggested action.  |
| `impactedDocs[].updateStrategy`  | `UpdateStrategy`                                    | Machine-facing update strategy. |
| `impactedDocs[].severity`        | `critical \| high \| medium \| low \| info \| none` | Impact severity.                |
| `impactedDocs[].confidence`      | `number`                                            | Confidence score.               |
| `impactedDocs[].hopDistance`     | `number`                                            | Hit distance, starting at 1.    |
| `totalCount`                     | `number`                                            | Total hits.                     |

### Call Example

```json
{
  "name": "analyze_impact",
  "arguments": {
    "docPath": "docs/getting-started.md",
    "confidenceThreshold": 0.7
  }
}
```

Response example:

```json
{
  "impactedDocs": [
    {
      "docPath": "docs/cli-reference.md",
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

## `query_relations`

Query relationships for a document, with 1 to 3 hops of traversal.

### When To Use

- Before editing a document, inspect its upstream and downstream context.
- Find the relationship handle that can be passed to `remove_relation` or `deprecate_relation`.

### `QueryRelationsInput`

| Field               | Type           | Required | Description                                                    |
| ------------------- | -------------- | -------- | -------------------------------------------------------------- |
| `docPath`           | `string`       | Yes      | Document path to query. It must be inside the project root.    |
| `type`              | `RelationType` | No       | Filter by relationship type.                                   |
| `includeDeprecated` | `boolean`      | No       | Whether to include deprecated relationships. Default: `false`. |
| `depth`             | `number`       | No       | Traversal depth from 1 to 3. Default: `1`.                     |

### `QueryRelationsResult`

| Field                      | Type                                      | Description                                                                               |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `relations`                | `array`                                   | Relationship list.                                                                        |
| `relations[].relationId`   | `string`                                  | Relationship ID. This is the input handle for `remove_relation` and `deprecate_relation`. |
| `relations[].targetPath`   | `string`                                  | Target document path.                                                                     |
| `relations[].relationType` | `RelationType`                            | Relationship type.                                                                        |
| `relations[].confidence`   | `number`                                  | Confidence score.                                                                         |
| `relations[].source`       | `auto_scan \| manual \| framework_preset` | Relationship source.                                                                      |
| `relations[].status`       | `active \| deprecated`                    | Relationship status.                                                                      |
| `relations[].hopDistance`  | `number`                                  | Hit distance, starting at 1.                                                              |
| `totalCount`               | `number`                                  | Total hits.                                                                               |

### Call Example

```json
{
  "name": "query_relations",
  "arguments": {
    "docPath": "docs/getting-started.md",
    "type": "references",
    "depth": 2,
    "includeDeprecated": false
  }
}
```

Response example:

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

## `init_graph`

Initialize or rebuild the current project's document relationship graph.

### When To Use

- `.cord/cord.db` does not exist, so other tools cannot query the graph.
- The user asks the AI IDE to rescan all documents.

### `InitGraphInput`

| Field     | Type      | Required | Description                                                                                                                 |
| --------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `rebuild` | `boolean` | No       | Whether to fully rebuild the graph. Default: `false`.                                                                       |
| `force`   | `boolean` | No       | When `rebuild=true`, whether to skip manual relationship confirmation. Default: `false`. `force=true` cannot be used alone. |

### `InitGraphResult`

| Field                 | Type       | Description                                    |
| --------------------- | ---------- | ---------------------------------------------- |
| `documentsFound`      | `number`   | Number of documents found.                     |
| `relationsDiscovered` | `number`   | Number of relationships discovered or written. |
| `warnings`            | `string[]` | Scan warnings.                                 |
| `durationMs`          | `number`   | Scan duration in milliseconds.                 |

### Call Example

```json
{
  "name": "init_graph",
  "arguments": {
    "rebuild": true,
    "force": true
  }
}
```

Response example:

```json
{
  "documentsFound": 42,
  "relationsDiscovered": 96,
  "warnings": [],
  "durationMs": 128
}
```

## `sync_docs`

Provide read-only synchronization suggestions for a single changed document. It does not write any document content.

### When To Use

- After `analyze_impact` finds possibly drifting related documents, an AI IDE needs execution-oriented suggestions.
- A hook or skill saved a document and needs to know whether to update, review, or only log related documents.

### Single-Document Input Boundary

`sync_docs` accepts exactly one `filePath`. If one change touches multiple documents, the MCP host or AI IDE should call `sync_docs` once per file instead of passing multiple files in a single call.

### `SyncDocsInput`

| Field      | Type     | Required | Description                                                       |
| ---------- | -------- | -------- | ----------------------------------------------------------------- |
| `filePath` | `string` | Yes      | Changed single document path. It must be inside the project root. |

### `SyncDocsResult`

| Field                          | Type                           | Description                                                                |
| ------------------------------ | ------------------------------ | -------------------------------------------------------------------------- |
| `suggestions`                  | `array`                        | Synchronization suggestions.                                               |
| `suggestions[].targetPath`     | `string`                       | Target document to handle.                                                 |
| `suggestions[].action`         | `update \| review \| log_only` | Action derived from `updateStrategy`.                                      |
| `suggestions[].updateStrategy` | `UpdateStrategy`               | Original update strategy.                                                  |
| `suggestions[].reason`         | `string`                       | Suggestion reason, directly reused from impact analysis `suggestedAction`. |
| `affectedCount`                | `number`                       | Number of suggestions.                                                     |

### Call Example

```json
{
  "name": "sync_docs",
  "arguments": {
    "filePath": "docs/getting-started.md"
  }
}
```

Response example:

```json
{
  "suggestions": [
    {
      "targetPath": "docs/cli-reference.md",
      "action": "review",
      "updateStrategy": "suggest",
      "reason": "Review for sync need"
    }
  ],
  "affectedCount": 1
}
```

## `add_relation`

Add one manual document relationship.

### When To Use

- A user finds a relationship that automatic scanning missed and asks the AI IDE to add it.
- A new document has just been created and is not recognized by rules yet, but its relationship to another document is already known.

### `AddRelationInput`

| Field          | Type           | Required | Description                                               |
| -------------- | -------------- | -------- | --------------------------------------------------------- |
| `sourcePath`   | `string`       | Yes      | Source document path. It must be inside the project root. |
| `targetPath`   | `string`       | Yes      | Target document path. It must be inside the project root. |
| `relationType` | `RelationType` | Yes      | Relationship type.                                        |

### `AddRelationResult`

| Field          | Type           | Description           |
| -------------- | -------------- | --------------------- |
| `relationId`   | `string`       | New relationship ID.  |
| `sourcePath`   | `string`       | Source document path. |
| `targetPath`   | `string`       | Target document path. |
| `relationType` | `RelationType` | Relationship type.    |
| `source`       | `manual`       | Fixed manual source.  |
| `status`       | `active`       | Fixed active status.  |

### Call Example

```json
{
  "name": "add_relation",
  "arguments": {
    "sourcePath": "docs/getting-started.md",
    "targetPath": "docs/cli-reference.md",
    "relationType": "references"
  }
}
```

Response example:

```json
{
  "relationId": "rel_manual_01",
  "sourcePath": "docs/getting-started.md",
  "targetPath": "docs/cli-reference.md",
  "relationType": "references",
  "source": "manual",
  "status": "active"
}
```

## `remove_relation`

Physically delete a relationship by `relationId`.

### When To Use

- The user confirms a relationship is incorrect and does not need historical state.
- The AI IDE calls `query_relations` to get `relationId`, then calls this tool to delete it.

### `RemoveRelationInput`

| Field        | Type     | Required | Description                                               |
| ------------ | -------- | -------- | --------------------------------------------------------- |
| `relationId` | `string` | Yes      | Relationship ID to remove, from `query_relations` output. |

### `RemoveRelationResult`

| Field        | Type     | Description                         |
| ------------ | -------- | ----------------------------------- |
| `success`    | `true`   | Deletion success marker.            |
| `relationId` | `string` | Physically deleted relationship ID. |

### Call Example

```json
{
  "name": "remove_relation",
  "arguments": {
    "relationId": "rel_01"
  }
}
```

Response example:

```json
{
  "success": true,
  "relationId": "rel_01"
}
```

## `deprecate_relation`

Mark a relationship as deprecated by `relationId`.

### When To Use

- The user believes a relationship is no longer valid but wants to preserve history.
- The AI IDE needs normal queries to hide this relationship by default while still allowing `includeDeprecated` tracing.

### `DeprecateRelationInput`

| Field        | Type     | Required | Description                                                  |
| ------------ | -------- | -------- | ------------------------------------------------------------ |
| `relationId` | `string` | Yes      | Relationship ID to deprecate, from `query_relations` output. |

### `DeprecateRelationResult`

| Field          | Type           | Description                            |
| -------------- | -------------- | -------------------------------------- |
| `relationId`   | `string`       | Deprecated relationship ID.            |
| `status`       | `deprecated`   | Fixed deprecated status.               |
| `relationType` | `RelationType` | Original relationship type, unchanged. |

### Call Example

```json
{
  "name": "deprecate_relation",
  "arguments": {
    "relationId": "rel_01"
  }
}
```

Response example:

```json
{
  "relationId": "rel_01",
  "status": "deprecated",
  "relationType": "references"
}
```

## Paths And Safety Boundaries

All path inputs are normalized to project-relative POSIX paths. Empty paths, paths outside the project root, `..`, and `../...` are rejected. MCP Server stdout is reserved for JSON-RPC communication; logs and diagnostics go to stderr.
