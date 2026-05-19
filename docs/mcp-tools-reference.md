# MCP Tools 参考

CORD MCP Server 通过 stdio 暴露 7 个 Tool。Tool 名使用 snake_case，参数字段使用 camelCase。所有 inputSchema 和 outputSchema 都在 `src/mcp/tools/schemas.ts` 中以命名 Zod schema 定义，并导出对应 JSON Schema；核心 Tool 的输出语义与 CLI `--json` / Service DTO 保持一致。

## 工具总览

| Tool                 | inputSchema              | outputSchema              | 读写属性 | 典型用途                                |
| -------------------- | ------------------------ | ------------------------- | -------- | --------------------------------------- |
| `analyze_impact`     | `AnalyzeImpactInput`     | `AnalyzeImpactResult`     | 只读     | 文档变更后判断影响范围。                |
| `query_relations`    | `QueryRelationsInput`    | `QueryRelationsResult`    | 只读     | 编辑前查看上下游关系。                  |
| `init_graph`         | `InitGraphInput`         | `InitGraphResult`         | 写入     | 初始化或重建本地图谱。                  |
| `sync_docs`          | `SyncDocsInput`          | `SyncDocsResult`          | 只读     | 基于单文档变更生成同步建议。            |
| `add_relation`       | `AddRelationInput`       | `AddRelationResult`       | 写入     | 手动添加一条文档关系。                  |
| `remove_relation`    | `RemoveRelationInput`    | `RemoveRelationResult`    | 写入     | 按 `relationId` 物理删除关系。          |
| `deprecate_relation` | `DeprecateRelationInput` | `DeprecateRelationResult` | 写入     | 按 `relationId` 标记关系为 deprecated。 |

关系类型枚举：`sync_required`、`context_for`、`lifecycle_bound`、`contains`、`must_consistent`、`sync_suggested`、`derived_from`、`deprecated`、`references`。

关系来源枚举：`auto_scan`、`manual`、`framework_preset`。

更新策略枚举：`auto`、`suggest`、`log_only`。

## `analyze_impact`

分析指定文档变更会影响哪些文档。

### 使用场景

- AI IDE 保存需求、架构、Epic、Story 或用户文档后，调用此 Tool 获取影响范围。
- 用户询问“我改了这个文件，还要同步哪些文件？”时调用。

### `AnalyzeImpactInput`

| 字段                  | 类型     | 必填 | 说明                                                |
| --------------------- | -------- | ---- | --------------------------------------------------- |
| `docPath`             | `string` | 是   | 待分析文档路径。必须位于项目根目录内。              |
| `confidenceThreshold` | `number` | 否   | 最低置信度阈值，范围 0 到 1。未传时使用配置默认值。 |

### `AnalyzeImpactResult`

| 字段                             | 类型                                                | 说明                  |
| -------------------------------- | --------------------------------------------------- | --------------------- |
| `impactedDocs`                   | `array`                                             | 受影响文档列表。      |
| `impactedDocs[].docPath`         | `string`                                            | 受影响文档路径。      |
| `impactedDocs[].relationType`    | `RelationType`                                      | 命中的关系类型。      |
| `impactedDocs[].propagationType` | `RelationType`                                      | 传播类型。            |
| `impactedDocs[].suggestedAction` | `string`                                            | 面向人的建议动作。    |
| `impactedDocs[].updateStrategy`  | `UpdateStrategy`                                    | 面向机器的更新策略。  |
| `impactedDocs[].severity`        | `critical \| high \| medium \| low \| info \| none` | 影响严重度。          |
| `impactedDocs[].confidence`      | `number`                                            | 置信度。              |
| `impactedDocs[].hopDistance`     | `number`                                            | 命中跳数，从 1 开始。 |
| `totalCount`                     | `number`                                            | 命中总数。            |

### 调用示例

```json
{
  "name": "analyze_impact",
  "arguments": {
    "docPath": "docs/getting-started.md",
    "confidenceThreshold": 0.7
  }
}
```

返回示例：

```json
{
  "impactedDocs": [
    {
      "docPath": "docs/cli-reference.md",
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

## `query_relations`

查询指定文档的关联关系，支持 1 到 3 跳。

### 使用场景

- 编辑文档前，先查看它的上下游文档。
- 需要找到可传给 `remove_relation` 或 `deprecate_relation` 的关系句柄时调用。

### `QueryRelationsInput`

| 字段                | 类型           | 必填 | 说明                                     |
| ------------------- | -------------- | ---- | ---------------------------------------- |
| `docPath`           | `string`       | 是   | 查询文档路径。必须位于项目根目录内。     |
| `type`              | `RelationType` | 否   | 按关系类型过滤。                         |
| `includeDeprecated` | `boolean`      | 否   | 是否包含 deprecated 关系。默认 `false`。 |
| `depth`             | `number`       | 否   | 遍历深度，范围 1 到 3。默认 `1`。        |

### `QueryRelationsResult`

| 字段                       | 类型                                      | 说明                                                                 |
| -------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `relations`                | `array`                                   | 关系列表。                                                           |
| `relations[].relationId`   | `string`                                  | 关系 ID。它是 `remove_relation` 和 `deprecate_relation` 的输入句柄。 |
| `relations[].targetPath`   | `string`                                  | 目标文档路径。                                                       |
| `relations[].relationType` | `RelationType`                            | 关系类型。                                                           |
| `relations[].confidence`   | `number`                                  | 置信度。                                                             |
| `relations[].source`       | `auto_scan \| manual \| framework_preset` | 关系来源。                                                           |
| `relations[].status`       | `active \| deprecated`                    | 关系状态。                                                           |
| `relations[].hopDistance`  | `number`                                  | 命中跳数，从 1 开始。                                                |
| `totalCount`               | `number`                                  | 命中总数。                                                           |

### 调用示例

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

返回示例：

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

初始化或重建当前项目的文档关系图谱。

### 使用场景

- `.cord/cord.db` 不存在，其他 Tool 无法查询图谱时调用。
- 用户要求 AI IDE 重新扫描所有文档时调用。

### `InitGraphInput`

| 字段      | 类型      | 必填 | 说明                                                                                 |
| --------- | --------- | ---- | ------------------------------------------------------------------------------------ |
| `rebuild` | `boolean` | 否   | 是否完全重建图谱。默认 `false`。                                                     |
| `force`   | `boolean` | 否   | `rebuild=true` 时是否跳过 manual 关系确认。默认 `false`。`force=true` 不能单独使用。 |

### `InitGraphResult`

| 字段                  | 类型       | 说明                 |
| --------------------- | ---------- | -------------------- |
| `documentsFound`      | `number`   | 扫描到的文档数。     |
| `relationsDiscovered` | `number`   | 发现或写入的关系数。 |
| `warnings`            | `string[]` | 扫描警告列表。       |
| `durationMs`          | `number`   | 扫描耗时，单位毫秒。 |

### 调用示例

```json
{
  "name": "init_graph",
  "arguments": {
    "rebuild": true,
    "force": true
  }
}
```

返回示例：

```json
{
  "documentsFound": 42,
  "relationsDiscovered": 96,
  "warnings": [],
  "durationMs": 128
}
```

## `sync_docs`

基于单个已变更文档提供只读同步建议，不执行任何文档写入。

### 使用场景

- `analyze_impact` 发现相关文档可能漂移后，AI IDE 需要得到面向执行的建议动作。
- Hook 或 Skill 在保存某个文档后，需要知道下一步应更新、审阅还是仅记录。

### 单文档输入边界

`sync_docs` 只接收一个 `filePath`。如果一次变更涉及多个文档，MCP Host 或 AI IDE 应按文件逐个调用 `sync_docs`，而不是把多个文件塞进一次调用。

### `SyncDocsInput`

| 字段       | 类型     | 必填 | 说明                                         |
| ---------- | -------- | ---- | -------------------------------------------- |
| `filePath` | `string` | 是   | 已变更的单个文档路径。必须位于项目根目录内。 |

### `SyncDocsResult`

| 字段                           | 类型                           | 说明                                             |
| ------------------------------ | ------------------------------ | ------------------------------------------------ |
| `suggestions`                  | `array`                        | 同步建议列表。                                   |
| `suggestions[].targetPath`     | `string`                       | 建议处理的目标文档。                             |
| `suggestions[].action`         | `update \| review \| log_only` | 从 `updateStrategy` 推导出的动作。               |
| `suggestions[].updateStrategy` | `UpdateStrategy`               | 原始更新策略。                                   |
| `suggestions[].reason`         | `string`                       | 建议原因，直接复用影响分析的 `suggestedAction`。 |
| `affectedCount`                | `number`                       | 建议数量。                                       |

### 调用示例

```json
{
  "name": "sync_docs",
  "arguments": {
    "filePath": "docs/getting-started.md"
  }
}
```

返回示例：

```json
{
  "suggestions": [
    {
      "targetPath": "docs/cli-reference.md",
      "action": "review",
      "updateStrategy": "suggest",
      "reason": "审阅是否需要同步"
    }
  ],
  "affectedCount": 1
}
```

## `add_relation`

添加一条手动文档关系。

### 使用场景

- 用户发现自动扫描漏掉一条确定关系，让 AI IDE 手动补图谱。
- 新文档刚创建，还没有被规则识别，但已经能确认它和某个文档存在关系。

### `AddRelationInput`

| 字段           | 类型           | 必填 | 说明                                 |
| -------------- | -------------- | ---- | ------------------------------------ |
| `sourcePath`   | `string`       | 是   | 源文档路径。必须位于项目根目录内。   |
| `targetPath`   | `string`       | 是   | 目标文档路径。必须位于项目根目录内。 |
| `relationType` | `RelationType` | 是   | 关系类型。                           |

### `AddRelationResult`

| 字段           | 类型           | 说明             |
| -------------- | -------------- | ---------------- |
| `relationId`   | `string`       | 新建关系 ID。    |
| `sourcePath`   | `string`       | 源文档路径。     |
| `targetPath`   | `string`       | 目标文档路径。   |
| `relationType` | `RelationType` | 关系类型。       |
| `source`       | `manual`       | 固定为手动来源。 |
| `status`       | `active`       | 固定为活跃状态。 |

### 调用示例

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

返回示例：

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

按 `relationId` 物理删除一条关系。

### 使用场景

- 用户确认某条关系是错误关系，且不需要保留历史状态。
- AI IDE 先调用 `query_relations` 获取 `relationId`，再调用此 Tool 删除。

### `RemoveRelationInput`

| 字段         | 类型     | 必填 | 说明                                           |
| ------------ | -------- | ---- | ---------------------------------------------- |
| `relationId` | `string` | 是   | 要移除关系的 ID，来自 `query_relations` 输出。 |

### `RemoveRelationResult`

| 字段         | 类型     | 说明                  |
| ------------ | -------- | --------------------- |
| `success`    | `true`   | 删除成功标记。        |
| `relationId` | `string` | 已物理删除的关系 ID。 |

### 调用示例

```json
{
  "name": "remove_relation",
  "arguments": {
    "relationId": "rel_01"
  }
}
```

返回示例：

```json
{
  "success": true,
  "relationId": "rel_01"
}
```

## `deprecate_relation`

按 `relationId` 将一条关系标记为 deprecated。

### 使用场景

- 用户认为某条关系已经不再有效，但希望保留历史痕迹。
- AI IDE 需要让普通查询默认不再返回该关系，同时允许 `includeDeprecated` 场景追溯。

### `DeprecateRelationInput`

| 字段         | 类型     | 必填 | 说明                                                         |
| ------------ | -------- | ---- | ------------------------------------------------------------ |
| `relationId` | `string` | 是   | 要标记为 deprecated 的关系 ID，来自 `query_relations` 输出。 |

### `DeprecateRelationResult`

| 字段           | 类型           | 说明                   |
| -------------- | -------------- | ---------------------- |
| `relationId`   | `string`       | 被标记的关系 ID。      |
| `status`       | `deprecated`   | 固定为 deprecated。    |
| `relationType` | `RelationType` | 原始关系类型保持不变。 |

### 调用示例

```json
{
  "name": "deprecate_relation",
  "arguments": {
    "relationId": "rel_01"
  }
}
```

返回示例：

```json
{
  "relationId": "rel_01",
  "status": "deprecated",
  "relationType": "references"
}
```

## 路径与安全边界

所有路径型输入都会归一化为 project-relative POSIX 路径。空路径、项目根外路径、`..` 和 `../...` 会被拒绝。MCP Server 的 stdout 只用于 JSON-RPC 通信，日志和诊断输出走 stderr。
