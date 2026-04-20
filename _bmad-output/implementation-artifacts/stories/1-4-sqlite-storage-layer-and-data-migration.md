# Story 1.4: SQLite 存储层与数据迁移机制

Status: ready-for-dev

## Story

As a 开发者，
I want IGraphRepository 接口、SQLite 实现和自动数据迁移机制，
So that Service 层可以通过抽象接口进行图谱数据的 CRUD 操作。

## Acceptance Criteria (AC)

1. **Given** Story 1.3 的类型系统已就绪 **When** 定义存储接口 **Then** `src/repositories/interfaces.ts` 定义 IGraphRepository 接口（含文档节点和关系边的 CRUD 方法签名）
2. **Given** 接口已定义 **When** 实现 SQLite 存储 **Then** `src/repositories/sqlite-graph-repository.ts` 实现 IGraphRepository，使用 better-sqlite3 同步 API
3. **Given** 实现需要命名转换 **When** 数据进出 Repository **Then** `src/repositories/mappers.ts` 实现 snake_case ↔ camelCase 双向转换
4. **Given** 数据库需要初始化 **When** 创建初始 schema **Then** `src/repositories/migrations/001-initial-schema.sql` 创建 documents、relations、sync_states 三张核心表
5. **Given** 需要自动迁移 **When** 应用启动 **Then** `src/repositories/migrations/runner.ts` 实现迁移执行器——查询 `schema_migrations` 历史表已执行版本，按序执行未执行的迁移脚本
6. **Given** 迁移执行中 **When** 发生错误 **Then** 迁移在事务中执行，失败可回滚，数据库一致性保证（NFR15）
7. **Given** 数据库初始化 **When** 配置 SQLite **Then** 启用 WAL 模式
8. **Given** 存储层实现完毕 **When** 运行测试 **Then** 单元测试覆盖率 ≥ 85%：CRUD 正常路径 + 迁移执行 + 事务回滚 + mapper 转换

## Tasks / Subtasks

- [ ] Task 1: 定义 IGraphRepository 接口 (AC: #1)
  - [ ] 1.1 `src/repositories/interfaces.ts` — 文档节点 CRUD 方法签名
  - [ ] 1.2 关系边 CRUD 方法签名
  - [ ] 1.3 同步状态查询/更新方法签名
  - [ ] 1.4 事务支持方法签名
- [ ] Task 2: 实现数据迁移机制 (AC: #4, #5, #6)
  - [ ] 2.1 创建 `src/repositories/migrations/001-initial-schema.sql`
  - [ ] 2.2 实现 `src/repositories/migrations/runner.ts` 迁移执行器，暴露 `runMigrations(db: Database): void` 公共方法
  - [ ] 2.3 迁移使用事务保护，失败回滚
  - [ ] 2.4 在 `SqliteGraphRepository` 构造函数（Task 4.1）中调用 `runMigrations(db)` 实现启动即迁移；确保首次连接和后续连接均可安全调用（幂等）
- [ ] Task 3: 实现 mappers (AC: #3)
  - [ ] 3.1 `src/repositories/mappers.ts` — snake_case → camelCase 转换
  - [ ] 3.2 camelCase → snake_case 转换
  - [ ] 3.3 文档行映射和关系行映射
- [ ] Task 4: 实现 SqliteGraphRepository (AC: #2, #7)
  - [ ] 4.1 `src/repositories/sqlite-graph-repository.ts` — 构造函数（接收 db 路径，启用 WAL）
  - [ ] 4.2 实现文档节点 CRUD
  - [ ] 4.3 实现关系边 CRUD
  - [ ] 4.4 实现同步状态操作
  - [ ] 4.5 实现事务支持（`transaction()` 包装）
- [ ] Task 5: 更新门面导出 (AC: #1)
  - [ ] 5.1 更新 `src/repositories/index.ts`
- [ ] Task 6: 编写测试 (AC: #8)
  - [ ] 6.1 `tests/unit/repositories/sqlite-graph-repository.test.ts`
  - [ ] 6.2 `tests/unit/repositories/mappers.test.ts`
  - [ ] 6.3 迁移执行器测试（正常路径 + 回滚）

## Dev Notes

### IGraphRepository 接口设计

```typescript
// src/repositories/interfaces.ts
import type { DocumentNode, RelationEdge, RelationSource, RelationType } from '../types/index.js';

export interface SyncState {
  docId: string;
  lastScannedAt: string;     // ISO 8601
  lastObservedMtimeMs: number; // 上次扫描时观测到的文件 mtimeMs（用于增量扫描变更检测，Story 2.6 依赖）
  contentHash: string;
  status: 'synced' | 'modified';  // v0.1 硬删除 + CASCADE，deleted 无需持久化
}

export interface IGraphRepository {
  // 文档节点操作
  addDocument(doc: Omit<DocumentNode, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode;
  getDocumentById(id: string): DocumentNode | null;
  getDocumentByPath(path: string): DocumentNode | null;
  getAllDocuments(): DocumentNode[];
  updateDocument(id: string, updates: Partial<DocumentNode>): DocumentNode;
  deleteDocument(id: string): void;
  deleteAllDocuments(): void;

  // 关系边操作
  addRelation(rel: Omit<RelationEdge, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge;
  getRelationById(id: string): RelationEdge | null;
  getRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): RelationEdge[];
  getRelationsByType(relationType: RelationType): RelationEdge[];
  updateRelation(id: string, updates: Partial<RelationEdge>): RelationEdge;
  deleteRelation(id: string): void;
  deleteRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): void;
  // direction 默认 'both'；增量扫描重建 modified 文档关系时使用 'source'，仅删除 outgoing 边，
  // 避免删除其他未扫描文档指向本文档的 inbound 边

  // 同步状态
  getSyncState(docId: string): SyncState | null;
  upsertSyncState(state: SyncState): void;
  getAllSyncStates(): SyncState[];

  // 事务
  transaction<T>(fn: () => T): T;

  // 统计
  getDocumentCount(): number;
  getRelationCount(): number;

  // 生命周期
  close(): void;
}
```

### 001-initial-schema.sql 核心表

```sql
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 文档节点表
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  title TEXT,
  doc_type TEXT,
  framework TEXT,
  content_hash TEXT,
  metadata TEXT,          -- JSON 字符串
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);

-- 关系边表
CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  source_doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL DEFAULT 'auto_scan',  -- auto_scan | manual | framework_preset
  metadata TEXT,          -- JSON 字符串
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_relations_source_doc_id ON relations(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_target_doc_id ON relations(target_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_relation_type ON relations(relation_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_unique_pair ON relations(source_doc_id, target_doc_id, relation_type);

-- 文档同步状态表
CREATE TABLE IF NOT EXISTS sync_states (
  doc_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  last_scanned_at TEXT NOT NULL,
  last_observed_mtime_ms INTEGER,  -- 上次扫描时观测到的文件 mtimeMs（Story 2.6 增量扫描依赖）
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'synced',  -- synced | modified（v0.1 硬删除 + CASCADE，deleted 无需持久化）
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### P1 数据库命名约定

| 维度 | 规则 | 示例 |
|------|------|------|
| 表名 | snake_case 复数 | documents、relations、sync_states |
| 列名 | snake_case | doc_id、source_path、relation_type |
| 外键 | {referenced_table}_id | source_doc_id、target_doc_id |
| 索引 | idx_{table}_{columns} | idx_relations_source_doc_id |
| 主键 | id（每表统一） | documents.id |

### Mapper 实现要点

- Repository 层内部使用 snake_case（与 DB 列一致）
- 返回给 Service 层之前转换为 camelCase
- 接收 Service 层传入时从 camelCase 转换为 snake_case
- metadata 字段使用 `JSON.stringify` / `JSON.parse` 处理

### better-sqlite3 使用要点

- 使用**同步 API**（P13：Repository 层为同步模式）
- WAL 模式启用：`db.pragma('journal_mode = WAL')`
- 外键约束启用：`db.pragma('foreign_keys = ON')`
- ID 生成：使用 `crypto.randomUUID()`
- 事务封装：使用 `db.transaction(fn)` 方法

### 架构约束提醒

- **P7**: Service 层通过构造函数注入 IGraphRepository，不直接引用 SqliteGraphRepository
- **P8**: Repository 层负责 snake_case ↔ camelCase 转换边界
- **P13**: Repository 层使用同步模式

### Project Structure Notes

- `src/repositories/interfaces.ts` — IGraphRepository 接口
- `src/repositories/sqlite-graph-repository.ts` — SQLite 实现
- `src/repositories/mappers.ts` — 命名转换
- `src/repositories/migrations/001-initial-schema.sql` — 初始 schema
- `src/repositories/migrations/runner.ts` — 迁移执行器
- `src/repositories/index.ts` — 门面导出

### References

- [Source: architecture/core-architectural-decisions.md#D2] — 版本号 + 增量 SQL 迁移
- [Source: architecture/core-architectural-decisions.md#D5] — 目录结构
- [Source: architecture/implementation-patterns-consistency-rules.md#P1] — 数据库命名约定
- [Source: architecture/implementation-patterns-consistency-rules.md#P7] — 依赖注入模式
- [Source: architecture/implementation-patterns-consistency-rules.md#P8] — 内部数据传递格式
- [Source: architecture/implementation-patterns-consistency-rules.md#P13] — 异步 vs 同步模式
- [Source: architecture/project-structure-boundaries.md#Architectural-Boundaries] — 层间通信边界
- [Source: prd.md#FR24-FR27] — 数据存储需求
- [Source: planning-artifacts/epics/epic-1工程就绪开发者可开始编写功能代码.md#Story 1.4] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
