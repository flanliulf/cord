# Story 3.5: StatusService 健康检查

Status: done

## Story

As a 用户，
I want 通过 `cord status` 查看当前项目的 CORD 配置状态和图谱健康信息，
So that 我可以了解图谱的整体状况。

## Acceptance Criteria (AC)

1. **Given** 已有配置和图谱 **When** 健康检查 **Then** `src/services/status-service.ts` 实现（FR5）
2. **Given** 输出 **When** 检查 **Then** 包含图谱健康指标（文档总数、关系总数、按类型分布、最后扫描时间）**和** CORD 配置状态（配置文件路径、framework、scanPaths、excludePaths、confidenceThreshold）（FR5）
3. **Given** 过时关系 **When** 检测 **Then** 报告关联文档的 `lastObservedMtimeMs`（最近一次扫描观测值）新于该关系的 `createdAt` 时报告为过时（v0.1 近似方案，避免文件系统耦合）；对比时必须先将 `createdAt`（SQLite datetime，TEXT）通过 `Date.parse(relation.createdAt)` 归一到 UTC 毫秒再与 `lastObservedMtimeMs` 比较
4. **Given** 不一致 **When** 检测 **Then** 报告孤立节点、悬空关系边
5. **Given** 数据库迁移版本 **When** 显示 **Then** 显示当前数据库已执行的迁移版本数（`migrationVersion`），来自 `schema_migrations` 表，类型为 INTEGER
6. **Given** CLI **When** 实现 **Then** `src/cli/commands/status.ts` 仪表盘式摘要
7. **Given** --json **When** 传入 **Then** JSON 输出
8. **Given** 实现完毕 **When** 测试 **Then** 正常检查 + 有过时关系 + 空图谱

## Tasks / Subtasks

- [x] Task 1: 实现 StatusService (AC: #1, #2, #3, #4, #5)，必须覆盖图谱健康指标和 CORD 配置状态两大能力块
- [x] Task 2: 实现 CLI 命令 (AC: #6, #7)
- [x] Task 3: 编写测试 (AC: #8)

## Dev Notes

### StatusService 输出

```typescript
interface StatusResult {
  // === 图谱健康指标 ===
  documentCount: number;
  relationCount: number;
  relationsByType: Record<string, number>;
  lastScanTime: string | null;
  /**
   * 数据库迁移版本数，来自 schema_migrations 表，类型 INTEGER。
   * 注意：这与导出快照中的 schemaVersion: "1.0" 是两个不同概念：
   * - migrationVersion: 数据库已执行的 DDL 迁移版本数（INTEGER）
   * - schemaVersion: 导出 JSON 快照的格式版本（STRING，仅用于导出）
   */
  migrationVersion: number;
  staleRelations: number;
  orphanedNodes: number;
  danglingEdges: number;  // 防御性完整性检查，正常分支预期返回 0

  // === CORD 配置状态（FR5 配置展示能力）===
  configFilePath: string | null;   // 配置文件的绝对路径或 null（未初始化）
  framework: string | null;        // 框架适配器（D6: framework）
  scanPaths: string[];             // 扫描路径列表（D6: scanPaths）
  excludePaths: string[];          // 排除路径列表（D6: excludePaths）
  confidenceThreshold: number;     // 置信度阈值（D6: confidenceThreshold，默认 0.50）
}
```

### 过时关系判定口径（v0.1 裁决）

**v0.1 使用 `lastObservedMtimeMs` 与 `relation.createdAt` 比较（近似方案）。**

- 数据来源：`SyncState.lastObservedMtimeMs`（上次扫描时观测，ms number）vs `RelationEdge.createdAt`（经 mapper 转换后的 camelCase 字段，类型为 SQLite datetime 字符串）
- **时间归一算法**：`Date.parse(relation.createdAt)` 得到 UTC 毫秒数，再与 `lastObservedMtimeMs` 比较；注意 SQLite datetime 默认无时区，需确保写入时均以 UTC 存储
- 字段命名规范：Service 层应使用 `createdAt`（camelCase，经 Story 1.4 mappers.ts 转换），禁止泳露 snake_case `created_at` 到 Service 层
- 优点：无需文件系统耦合，StatusService 可保持纯数据库查询设计
- 限制：反映的是上次扫描时的状态而非实时文件系统状态，AC 中应标注此为近似方案
- 后续版本如需实时，可推入 `IFileSystem.statFile()` 读取当前文件系统时间戳

### deprecated 关系健康统计口径（v0.1 裁决）

`StatusService` 是持久化图谱库存与健康快照，不是 Impact / Query 的可传播边集合。因此状态统计使用全量持久化关系口径：`relationCount`、`relationsByType`、`staleRelations`、`orphanedNodes` 和 `danglingEdges` 均基于 `active + deprecated` 关系数组计算。

- `status='deprecated'` 是关系状态位，不重写 `relationType`；按类型分布仍按原始 `relationType` 归类。
- `QueryService` / `ImpactService` 的读侧遍历仍可按路径语义默认排除 `status='deprecated'`；这不改变 `StatusService` 的库存统计口径。
- Export 快照继续保留完整图谱，便于审计关系从 active 变为 deprecated 后的持久化状态。

### Project Structure Notes

- `src/services/status-service.ts`
- `src/cli/commands/status.ts`

### References

- [Source: prd.md#FR5] — 健康检查需求
- [Source: epics.md#Story 3.5] — 验收标准

## Dev Agent Record

### Agent Model Used
- GPT-5.4

### Debug Log References
- `./node_modules/.bin/vitest run tests/unit/services/status-service.test.ts`
- `./node_modules/.bin/vitest run tests/unit/cli/commands/status.test.ts tests/unit/cli/index.test.ts`
- `./node_modules/.bin/vitest run tests/unit/services/status-service.test.ts tests/unit/cli/commands/status.test.ts tests/integration/cli/status.test.ts tests/unit/cli/index.test.ts`
- `npm test`
- `npm run type-check`
- `npm run lint`

### Implementation Plan
- 基于仓储快照计算图谱健康指标、按类型分布、最近扫描时间、过时关系、孤立节点与悬空关系边。
- 通过 `schema_migrations` 计数补充 `migrationVersion`，并在 Service 层统一返回配置文件路径、framework、scanPaths、excludePaths 与 `confidenceThreshold`。
- 为 `cord status` 增加仪表盘式摘要与 `--json` 输出，并注册到 CLI 入口。

### Completion Notes List
- 已实现 `StatusService`，覆盖图谱健康指标、配置状态、`Date.parse(relation.createdAt)` 的过时关系判定，以及迁移版本统计。
- 已实现 `cord status` 命令，支持人类可读摘要与 `--json` 输出。
- 已补充单元测试和 CLI 集成测试，覆盖正常检查、过时关系、空图谱与命令注册。

### File List
- src/cli/commands/index.ts
- src/cli/commands/status.ts
- src/cli/index.ts
- src/repositories/sqlite-graph-repository.ts
- src/schemas/index.ts
- src/schemas/status-input.ts
- src/services/index.ts
- src/services/status-service.ts
- tests/integration/cli/status.test.ts
- tests/unit/cli/commands/status.test.ts
- tests/unit/cli/index.test.ts
- tests/unit/services/status-service.test.ts

## Change Log

- 2026-05-14: 实现 Story 3.5 的状态服务、`cord status` CLI 命令，以及对应的单元/集成测试。
