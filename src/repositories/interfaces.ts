import type {
  DocumentNode,
  RelationEdge,
  RelationSource,
  RelationType,
} from '../types/index.js';

/**
 * SyncState 记录文档与磁盘文件的同步状态。
 *
 * v0.1 采用硬删除 + CASCADE，`deleted` 无需持久化。
 */
export interface SyncState {
  /** 关联的文档节点 ID。 */
  docId: string;
  /** 最近一次扫描时间（ISO 8601）。 */
  lastScannedAt: string;
  /**
   * 上次扫描时观测到的文件 mtimeMs。
   * Story 2.6 增量扫描依赖此字段进行变更检测。
   */
  lastObservedMtimeMs: number;
  /** 文件内容哈希，用于比对变更。 */
  contentHash: string;
  /** 同步状态：synced（已同步）| modified（已变更）。 */
  status: 'synced' | 'modified';
}

/**
 * IGraphRepository 定义图谱数据访问层的抽象接口。
 *
 * Service 层通过构造函数注入本接口（P7），不直接依赖 SQLite 实现。
 * Repository 层负责 snake_case ↔ camelCase 转换边界（P8）。
 * 所有操作均为同步模式（P13）。
 */
export interface IGraphRepository {
  // ── 文档节点操作 ─────────────────────────────────────────────────────────

  /** 新增文档节点；id、createdAt、updatedAt 由实现层自动生成。 */
  addDocument(doc: Omit<DocumentNode, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode;

  /** 按 ID 查询文档节点，不存在时返回 null。 */
  getDocumentById(id: string): DocumentNode | null;

  /** 按文件路径查询文档节点，不存在时返回 null。 */
  getDocumentByPath(path: string): DocumentNode | null;

  /** 获取全部文档节点。 */
  getAllDocuments(): DocumentNode[];

  /** 按 ID 更新文档节点字段；返回更新后的完整记录。
   * `id`、`createdAt`、`updatedAt` 为不可变字段，传入将被忽略。
   */
  updateDocument(id: string, updates: Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode;

  /** 按 ID 删除文档节点（级联删除关联边和同步状态）。 */
  deleteDocument(id: string): void;

  /** 删除所有文档节点（级联清空关联数据）。 */
  deleteAllDocuments(): void;

  // ── 关系边操作 ────────────────────────────────────────────────────────────

  /** 新增关系边；id、createdAt、updatedAt 由实现层自动生成。 */
  addRelation(rel: Omit<RelationEdge, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge;

  /** 按 ID 查询关系边，不存在时返回 null。 */
  getRelationById(id: string): RelationEdge | null;

  /**
   * 按文档 ID 查询关系边。
   * @param docId 文档节点 ID
   * @param direction 查询方向：`source`（出边）| `target`（入边）| `both`（默认，双向）
   */
  getRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): RelationEdge[];

  /** 按关系类型查询所有关系边。 */
  getRelationsByType(relationType: RelationType): RelationEdge[];

  /** 按 ID 更新关系边字段；返回更新后的完整记录。
   * `id`、`createdAt`、`updatedAt` 为不可变字段，传入将被忽略。
   */
  updateRelation(id: string, updates: Omit<Partial<RelationEdge>, 'id' | 'createdAt' | 'updatedAt'>): RelationEdge;

  /** 按 ID 删除关系边。 */
  deleteRelation(id: string): void;

  /**
   * 按文档 ID 批量删除关系边。
   *
   * @param docId 文档节点 ID
   * @param direction `'source'`（删出边）| `'target'`（删入边）| `'both'`（默认，双向）
   * @param options.excludeSources 跳过指定来源的边（例如 `['manual']`）；
   *   Story 4.2 manual 保护机制依赖此参数。
   */
  deleteRelationsByDocId(
    docId: string,
    direction?: 'source' | 'target' | 'both',
    options?: { excludeSources?: RelationSource[] },
  ): void;

  /** 全量读取所有关系边。供 Story 3.4 导出功能依赖。 */
  getAllRelations(): RelationEdge[];

  // ── 同步状态操作 ──────────────────────────────────────────────────────────

  /** 查询文档同步状态，不存在时返回 null。 */
  getSyncState(docId: string): SyncState | null;

  /** 插入或更新文档同步状态（upsert）。 */
  upsertSyncState(state: SyncState): void;

  /** 获取所有文档的同步状态。 */
  getAllSyncStates(): SyncState[];

  // ── 事务支持 ──────────────────────────────────────────────────────────────

  /**
   * 在数据库事务中执行函数。
   * 函数抛出异常时自动回滚；函数正常返回时自动提交。
   */
  transaction<T>(fn: () => T): T;

  // ── 统计 ─────────────────────────────────────────────────────────────────

  /** 返回文档节点总数。 */
  getDocumentCount(): number;

  /** 返回关系边总数。 */
  getRelationCount(): number;

  // ── 生命周期 ──────────────────────────────────────────────────────────────

  /** 关闭数据库连接。 */
  close(): void;
}
