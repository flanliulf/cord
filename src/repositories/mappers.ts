import type { DocumentNode, RelationEdge, RelationSource, RelationType } from '../types/index.js';
import { RELATION_TYPES } from '../types/index.js';
import type { SyncState } from './interfaces.js';

// ── DB 行类型（snake_case，与数据库列一一对应）────────────────────────────────

/** documents 表的数据库行结构。 */
export interface DocumentRow {
  id: string;
  path: string;
  title: string | null;
  doc_type: string | null;
  framework: string | null;
  content_hash: string | null;
  metadata: string | null; // JSON 字符串
  created_at: string;
  updated_at: string;
}

/** relations 表的数据库行结构。 */
export interface RelationRow {
  id: string;
  source_doc_id: string;
  target_doc_id: string;
  relation_type: string;
  confidence: number;
  source: string;
  status: string;
  metadata: string | null; // JSON 字符串
  created_at: string;
  updated_at: string;
}

/** sync_states 表的数据库行结构。 */
export interface SyncStateRow {
  doc_id: string;
  last_scanned_at: string;
  last_observed_mtime_ms: number | null;
  content_hash: string;
  status: string;
  updated_at: string;
}

// ── DocumentNode mappers ──────────────────────────────────────────────────────

// ── 运行时校验辅助函数 ────────────────────────────────────────────────────────

const VALID_RELATION_TYPES: ReadonlySet<string> = new Set(Object.values(RELATION_TYPES));
const VALID_RELATION_SOURCES: ReadonlySet<string> = new Set(['auto_scan', 'manual', 'framework_preset']);
const VALID_RELATION_STATUSES: ReadonlySet<string> = new Set(['active', 'deprecated']);
const VALID_SYNC_STATUSES: ReadonlySet<string> = new Set(['synced', 'modified']);

/**
 * 安全解析 JSON 元数据字段。
 * 解析失败时抛出带上下文信息的错误（而非静默返回 null）。
 */
function parseJsonMetadata(
  raw: string | null,
  context: { table: string; id: string; column: string },
): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `[mappers] Failed to parse JSON in ${context.table}.${context.column} for id="${context.id}": ${String(err)}`,
      { cause: err },
    );
  }
}

/**
 * 白名单校验枚举字段。
 * 值不在合法集合中时抛出带上下文信息的错误。
 */
function assertEnum<T extends string>(
  value: string,
  valid: ReadonlySet<string>,
  context: { table: string; id: string; column: string },
): T {
  if (!valid.has(value)) {
    throw new Error(
      `[mappers] Invalid value "${value}" for ${context.table}.${context.column} (id="${context.id}"). ` +
      `Allowed: [${[...valid].join(', ')}]`,
    );
  }
  return value as T;
}

/**
 * 将 documents 表行（snake_case）映射为 DocumentNode（camelCase）。
 */
export function rowToDocument(row: DocumentRow): DocumentNode {
  return {
    id: row.id,
    path: row.path,
    title: row.title ?? undefined,
    docType: row.doc_type ?? undefined,
    framework: row.framework ?? undefined,
    contentHash: row.content_hash ?? undefined,
    metadata: parseJsonMetadata(row.metadata, { table: 'documents', id: row.id, column: 'metadata' }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 将 DocumentNode（camelCase）转换为可插入数据库的 snake_case 对象。
 *
 * `createdAt` / `updatedAt` 由数据库 DEFAULT 或外部调用方提供，不在此处生成。
 */
export function documentToRow(
  doc: Omit<DocumentNode, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Omit<DocumentRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: doc.id,
    path: doc.path,
    title: doc.title ?? null,
    doc_type: doc.docType ?? null,
    framework: doc.framework ?? null,
    content_hash: doc.contentHash ?? null,
    metadata: doc.metadata != null ? JSON.stringify(doc.metadata) : null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// ── RelationEdge mappers ──────────────────────────────────────────────────────

/**
 * 将 relations 表行（snake_case）映射为 RelationEdge（camelCase）。
 */
export function rowToRelation(row: RelationRow): RelationEdge {
  return {
    id: row.id,
    sourceDocId: row.source_doc_id,
    targetDocId: row.target_doc_id,
    relationType: assertEnum<RelationType>(row.relation_type, VALID_RELATION_TYPES, {
      table: 'relations', id: row.id, column: 'relation_type',
    }),
    confidence: row.confidence,
    source: assertEnum<RelationSource>(row.source, VALID_RELATION_SOURCES, {
      table: 'relations', id: row.id, column: 'source',
    }),
    status: assertEnum<'active' | 'deprecated'>(row.status, VALID_RELATION_STATUSES, {
      table: 'relations', id: row.id, column: 'status',
    }),
    metadata: parseJsonMetadata(row.metadata, { table: 'relations', id: row.id, column: 'metadata' }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 将 RelationEdge（camelCase）转换为可插入数据库的 snake_case 对象。
 */
export function relationToRow(
  rel: Omit<RelationEdge, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Omit<RelationRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: rel.id,
    source_doc_id: rel.sourceDocId,
    target_doc_id: rel.targetDocId,
    relation_type: rel.relationType,
    confidence: rel.confidence,
    source: rel.source,
    status: rel.status,
    metadata: rel.metadata != null ? JSON.stringify(rel.metadata) : null,
    created_at: rel.createdAt,
    updated_at: rel.updatedAt,
  };
}

// ── SyncState mappers ─────────────────────────────────────────────────────────

/**
 * 将 sync_states 表行（snake_case）映射为 SyncState（camelCase）。
 */
export function rowToSyncState(row: SyncStateRow): SyncState {
  return {
    docId: row.doc_id,
    lastScannedAt: row.last_scanned_at,
    lastObservedMtimeMs: row.last_observed_mtime_ms ?? 0,
    contentHash: row.content_hash,
    status: assertEnum<'synced' | 'modified'>(row.status, VALID_SYNC_STATUSES, {
      table: 'sync_states', id: row.doc_id, column: 'status',
    }),
  };
}

/**
 * 将 SyncState（camelCase）转换为可插入数据库的 snake_case 对象。
 */
export function syncStateToRow(state: SyncState): SyncStateRow {
  return {
    doc_id: state.docId,
    last_scanned_at: state.lastScannedAt,
    last_observed_mtime_ms: state.lastObservedMtimeMs,
    content_hash: state.contentHash,
    status: state.status,
    updated_at: new Date().toISOString(),
  };
}
