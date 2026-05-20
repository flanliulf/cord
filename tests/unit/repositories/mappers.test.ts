import { describe, it, expect } from 'vitest';
import type { DocumentNode, RelationEdge } from '../../../src/types/index.js';
import type { SyncState } from '../../../src/repositories/interfaces.js';
import {
  rowToDocument,
  documentToRow,
  rowToRelation,
  relationToRow,
  rowToSyncState,
  syncStateToRow,
  type DocumentRow,
  type RelationRow,
  type SyncStateRow,
} from '../../../src/repositories/mappers.js';

// ── DocumentNode mappers ──────────────────────────────────────────────────────

describe('rowToDocument', () => {
  it('maps all non-null fields correctly', () => {
    const row: DocumentRow = {
      id: 'doc-1',
      path: 'docs/arch.md',
      title: 'Architecture',
      doc_type: 'architecture',
      framework: 'bmad',
      content_hash: 'abc123',
      metadata: '{"key":"value"}',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };

    const doc = rowToDocument(row);

    expect(doc.id).toBe('doc-1');
    expect(doc.path).toBe('docs/arch.md');
    expect(doc.title).toBe('Architecture');
    expect(doc.docType).toBe('architecture');
    expect(doc.framework).toBe('bmad');
    expect(doc.contentHash).toBe('abc123');
    expect(doc.metadata).toEqual({ key: 'value' });
    expect(doc.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(doc.updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  it('maps null optional fields to undefined', () => {
    const row: DocumentRow = {
      id: 'doc-2',
      path: 'README.md',
      title: null,
      doc_type: null,
      framework: null,
      content_hash: null,
      metadata: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    const doc = rowToDocument(row);

    expect(doc.title).toBeUndefined();
    expect(doc.docType).toBeUndefined();
    expect(doc.framework).toBeUndefined();
    expect(doc.contentHash).toBeUndefined();
    expect(doc.metadata).toBeUndefined();
  });
});

describe('documentToRow', () => {
  it('maps all fields to snake_case correctly', () => {
    const doc: DocumentNode = {
      id: 'doc-1',
      path: 'docs/arch.md',
      title: 'Architecture',
      docType: 'architecture',
      framework: 'bmad',
      contentHash: 'abc123',
      metadata: { key: 'value' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    const row = documentToRow(doc);

    expect(row.id).toBe('doc-1');
    expect(row.path).toBe('docs/arch.md');
    expect(row.title).toBe('Architecture');
    expect(row.doc_type).toBe('architecture');
    expect(row.framework).toBe('bmad');
    expect(row.content_hash).toBe('abc123');
    expect(row.metadata).toBe('{"key":"value"}');
    expect(row.created_at).toBe('2024-01-01T00:00:00.000Z');
    expect(row.updated_at).toBe('2024-01-02T00:00:00.000Z');
  });

  it('maps undefined optional fields to null', () => {
    const doc: DocumentNode = {
      id: 'doc-2',
      path: 'README.md',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const row = documentToRow(doc);

    expect(row.title).toBeNull();
    expect(row.doc_type).toBeNull();
    expect(row.framework).toBeNull();
    expect(row.content_hash).toBeNull();
    expect(row.metadata).toBeNull();
  });

  it('rejects top-level array metadata before writing', () => {
    const doc: DocumentNode = {
      id: 'doc-array-metadata',
      path: 'array.md',
      metadata: [] as unknown as Record<string, unknown>,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(() => documentToRow(doc)).toThrow(/metadata.*doc-array-metadata/i);
  });

  it('serializes metadata object to JSON string', () => {
    const doc: DocumentNode = {
      id: 'doc-3',
      path: 'a.md',
      metadata: { nested: { deep: true }, arr: [1, 2] },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const row = documentToRow(doc);
    expect(JSON.parse(row.metadata!)).toEqual({ nested: { deep: true }, arr: [1, 2] });
  });
});

describe('DocumentNode roundtrip', () => {
  it('rowToDocument → documentToRow is lossless', () => {
    const row: DocumentRow = {
      id: 'doc-rt',
      path: 'rt.md',
      title: 'RT',
      doc_type: 'prd',
      framework: 'bmad',
      content_hash: 'hash',
      metadata: '{"x":1}',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };

    const back = documentToRow(rowToDocument(row));
    expect(back.id).toBe(row.id);
    expect(back.path).toBe(row.path);
    expect(back.title).toBe(row.title);
    expect(back.doc_type).toBe(row.doc_type);
    expect(back.framework).toBe(row.framework);
    expect(back.content_hash).toBe(row.content_hash);
    expect(JSON.parse(back.metadata!)).toEqual(JSON.parse(row.metadata!));
  });
});

// ── RelationEdge mappers ──────────────────────────────────────────────────────

describe('rowToRelation', () => {
  it('maps all non-null fields correctly', () => {
    const row: RelationRow = {
      id: 'rel-1',
      source_doc_id: 'src-id',
      target_doc_id: 'tgt-id',
      relation_type: 'sync_required',
      confidence: 0.9,
      source: 'auto_scan',
      status: 'active',
      metadata: '{"note":"test"}',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };

    const rel = rowToRelation(row);

    expect(rel.id).toBe('rel-1');
    expect(rel.sourceDocId).toBe('src-id');
    expect(rel.targetDocId).toBe('tgt-id');
    expect(rel.relationType).toBe('sync_required');
    expect(rel.confidence).toBe(0.9);
    expect(rel.source).toBe('auto_scan');
    expect(rel.status).toBe('active');
    expect(rel.metadata).toEqual({ note: 'test' });
    expect(rel.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(rel.updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  it('maps null metadata to undefined', () => {
    const row: RelationRow = {
      id: 'rel-2',
      source_doc_id: 's',
      target_doc_id: 't',
      relation_type: 'references',
      confidence: 0.5,
      source: 'manual',
      status: 'deprecated',
      metadata: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    expect(rowToRelation(row).metadata).toBeUndefined();
  });
});

describe('relationToRow', () => {
  it('maps camelCase to snake_case correctly', () => {
    const rel: RelationEdge = {
      id: 'rel-1',
      sourceDocId: 'src-id',
      targetDocId: 'tgt-id',
      relationType: 'sync_required',
      confidence: 0.8,
      source: 'framework_preset',
      status: 'active',
      metadata: { x: 1 },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    const row = relationToRow(rel);

    expect(row.source_doc_id).toBe('src-id');
    expect(row.target_doc_id).toBe('tgt-id');
    expect(row.relation_type).toBe('sync_required');
    expect(row.confidence).toBe(0.8);
    expect(row.source).toBe('framework_preset');
    expect(row.status).toBe('active');
    expect(JSON.parse(row.metadata!)).toEqual({ x: 1 });
  });

  it('maps undefined metadata to null', () => {
    const rel: RelationEdge = {
      id: 'rel-2',
      sourceDocId: 's',
      targetDocId: 't',
      relationType: 'references',
      confidence: 0.5,
      source: 'manual',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(relationToRow(rel).metadata).toBeNull();
  });
});

describe('RelationEdge roundtrip', () => {
  it('rowToRelation → relationToRow is lossless', () => {
    const row: RelationRow = {
      id: 'rel-rt',
      source_doc_id: 'a',
      target_doc_id: 'b',
      relation_type: 'context_for',
      confidence: 0.75,
      source: 'auto_scan',
      status: 'active',
      metadata: '{"tag":"rt"}',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };

    const back = relationToRow(rowToRelation(row));
    expect(back.id).toBe(row.id);
    expect(back.source_doc_id).toBe(row.source_doc_id);
    expect(back.target_doc_id).toBe(row.target_doc_id);
    expect(back.relation_type).toBe(row.relation_type);
    expect(back.confidence).toBe(row.confidence);
    expect(back.source).toBe(row.source);
    expect(back.status).toBe(row.status);
    expect(JSON.parse(back.metadata!)).toEqual(JSON.parse(row.metadata!));
  });
});

// ── SyncState mappers ─────────────────────────────────────────────────────────

describe('rowToSyncState', () => {
  it('maps row fields to SyncState correctly', () => {
    const row: SyncStateRow = {
      doc_id: 'doc-1',
      last_scanned_at: '2024-01-01T00:00:00.000Z',
      last_observed_mtime_ms: 1234567890,
      content_hash: 'hash123',
      status: 'synced',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    const state = rowToSyncState(row);

    expect(state.docId).toBe('doc-1');
    expect(state.lastScannedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(state.lastObservedMtimeMs).toBe(1234567890);
    expect(state.contentHash).toBe('hash123');
    expect(state.status).toBe('synced');
  });

  it('maps null mtime to 0', () => {
    const row: SyncStateRow = {
      doc_id: 'd',
      last_scanned_at: '2024-01-01T00:00:00.000Z',
      last_observed_mtime_ms: null,
      content_hash: 'h',
      status: 'modified',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    expect(rowToSyncState(row).lastObservedMtimeMs).toBe(0);
  });
});

describe('syncStateToRow', () => {
  it('maps SyncState to snake_case row correctly', () => {
    const state: SyncState = {
      docId: 'doc-1',
      lastScannedAt: '2024-01-01T00:00:00.000Z',
      lastObservedMtimeMs: 999,
      contentHash: 'hash',
      status: 'modified',
    };

    const row = syncStateToRow(state);

    expect(row.doc_id).toBe('doc-1');
    expect(row.last_scanned_at).toBe('2024-01-01T00:00:00.000Z');
    expect(row.last_observed_mtime_ms).toBe(999);
    expect(row.content_hash).toBe('hash');
    expect(row.status).toBe('modified');
    expect(typeof row.updated_at).toBe('string'); // 自动生成时间
  });
});

describe('SyncState roundtrip', () => {
  it('rowToSyncState → syncStateToRow preserves key fields', () => {
    const row: SyncStateRow = {
      doc_id: 'doc-rt',
      last_scanned_at: '2024-01-05T00:00:00.000Z',
      last_observed_mtime_ms: 500,
      content_hash: 'abc',
      status: 'synced',
      updated_at: '2024-01-05T00:00:00.000Z',
    };

    const back = syncStateToRow(rowToSyncState(row));
    expect(back.doc_id).toBe(row.doc_id);
    expect(back.last_scanned_at).toBe(row.last_scanned_at);
    expect(back.last_observed_mtime_ms).toBe(row.last_observed_mtime_ms);
    expect(back.content_hash).toBe(row.content_hash);
    expect(back.status).toBe(row.status);
  });
});

// ── F4 运行时防御性验证 ───────────────────────────────────────────────────────

describe('rowToDocument — 损坏数据防御（F4）', () => {
  it('metadata 为非法 JSON 字符串时抛出含上下文的错误', () => {
    const row: DocumentRow = {
      id: 'doc-bad',
      path: 'bad.md',
      title: null,
      doc_type: null,
      framework: null,
      content_hash: null,
      metadata: '{not valid json',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    expect(() => rowToDocument(row)).toThrow(/metadata.*doc-bad/i);
  });

  it.each(['null', '[]', '123', '"text"'])('metadata 为非对象 JSON %s 时抛出含上下文的错误', (metadata) => {
    const row: DocumentRow = {
      id: `doc-shape-${metadata}`,
      path: 'bad-shape.md',
      title: null,
      doc_type: null,
      framework: null,
      content_hash: null,
      metadata,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    expect(() => rowToDocument(row)).toThrow(/metadata.*doc-shape/i);
  });
});

describe('rowToRelation — 枚举校验防御（F4）', () => {
  const baseRow: RelationRow = {
    id: 'rel-bad',
    source_doc_id: 'a',
    target_doc_id: 'b',
    relation_type: 'references',
    confidence: 0.5,
    source: 'auto_scan',
    status: 'active',
    metadata: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  it('relation_type 值非法时抛出含上下文的错误', () => {
    expect(() => rowToRelation({ ...baseRow, relation_type: 'hacked_type' })).toThrow(/relation_type.*rel-bad/i);
  });

  it('source 值非法时抛出含上下文的错误', () => {
    expect(() => rowToRelation({ ...baseRow, source: 'unknown_source' })).toThrow(/source.*rel-bad/i);
  });

  it('status 值非法时抛出含上下文的错误', () => {
    expect(() => rowToRelation({ ...baseRow, status: 'deleted' })).toThrow(/status.*rel-bad/i);
  });

  it('metadata 为非法 JSON 时抛出含上下文的错误', () => {
    expect(() => rowToRelation({ ...baseRow, metadata: '{{bad' })).toThrow(/metadata.*rel-bad/i);
  });

  it('metadata 为非对象 JSON 时抛出含上下文的错误', () => {
    expect(() => rowToRelation({ ...baseRow, metadata: '[]' })).toThrow(/metadata.*rel-bad/i);
  });
});

describe('rowToSyncState — 枚举校验防御（F4）', () => {
  it('status 值非法时抛出含上下文的错误', () => {
    const row: SyncStateRow = {
      doc_id: 'sync-bad',
      last_scanned_at: '2024-01-01T00:00:00.000Z',
      last_observed_mtime_ms: null,
      content_hash: 'h',
      status: 'corrupted',
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    expect(() => rowToSyncState(row)).toThrow(/status.*sync-bad/i);
  });
});
