import type { DocumentNode, RelationEdge, RelationSource, RelationType } from '../types/index.js';
import { RELATION_TYPES } from '../types/index.js';
import { StorageError } from '../utils/errors.js';
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

type MapperContext = { table: string; id: string; column: string };

const STORAGE_METADATA_ERROR_CODE = 'CORD_STORAGE_001';
const STORAGE_ENUM_ERROR_CODE = 'CORD_STORAGE_002';

/**
 * 安全解析 JSON 元数据字段。
 * 解析失败时抛出带上下文信息的错误（而非静默返回 null）。
 */
function parseJsonMetadata(
  raw: string | null,
  context: MapperContext,
): Record<string, unknown> | undefined {
  if (raw == null) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new StorageError({
      message: `[mappers] Failed to parse JSON in ${context.table}.${context.column} for id="${context.id}": ${String(err)}`,
      code: STORAGE_METADATA_ERROR_CODE,
      suggestion: '请检查数据库 metadata 字段是否为合法 JSON object',
      context: { ...context, reason: 'invalid_json' },
      cause: err instanceof Error ? err : undefined,
    });
  }

  return assertMetadataObject(parsed, context);
}

function assertMetadataObject(
  value: unknown,
  context: MapperContext,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new StorageError({
      message: `[mappers] Invalid JSON object in ${context.table}.${context.column} for id="${context.id}"`,
      code: STORAGE_METADATA_ERROR_CODE,
      suggestion: '请确认 metadata 字段是 JSON object，而不是 null、数组或原始值',
      context: { ...context, reason: 'invalid_shape', valueType: Array.isArray(value) ? 'array' : typeof value },
    });
  }

  return value as Record<string, unknown>;
}

function serializeMetadata(
  value: Record<string, unknown> | undefined,
  context: MapperContext,
): string | null {
  return value != null ? JSON.stringify(assertMetadataObject(value, context)) : null;
}

/**
 * 白名单校验枚举字段。
 * 值不在合法集合中时抛出带上下文信息的错误。
 */
function assertEnum<T extends string>(
  value: string,
  valid: ReadonlySet<string>,
  context: MapperContext,
): T {
  if (!valid.has(value)) {
    const allowedValues = [...valid];
    throw new StorageError({
      message: `[mappers] Invalid value "${value}" for ${context.table}.${context.column} (id="${context.id}"). ` +
        `Allowed: [${allowedValues.join(', ')}]`,
      code: STORAGE_ENUM_ERROR_CODE,
      suggestion: '请检查数据库枚举字段是否来自受支持的 CORD schema 版本',
      context: { ...context, value, allowedValues },
    });
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
    metadata: serializeMetadata(doc.metadata, { table: 'documents', id: doc.id, column: 'metadata' }),
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
    metadata: serializeMetadata(rel.metadata, { table: 'relations', id: rel.id, column: 'metadata' }),
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
