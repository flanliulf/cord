import { describe, expect, it } from 'vitest';
import {
  detectLifecycle,
  type CurrentFileSnapshot,
  type StoredDocRecord,
} from '../../../src/scanner/lifecycle-detector.js';

describe('detectLifecycle', () => {
  it('should classify unchanged, modified, added, and deleted documents by comparing snapshots', () => {
    const currentFiles: CurrentFileSnapshot[] = [
      {
        path: 'docs/prd.md',
        mtimeMs: 100,
        contentHash: 'hash-prd',
      },
      {
        path: 'docs/architecture.md',
        mtimeMs: 250,
        contentHash: 'hash-architecture',
      },
      {
        path: 'docs/new.md',
        mtimeMs: 300,
        contentHash: 'hash-new',
      },
    ];

    const storedDocs: StoredDocRecord[] = [
      {
        docId: 'doc-1',
        path: 'docs/prd.md',
        contentHash: 'hash-prd',
        lastObservedMtimeMs: 100,
        status: 'synced',
      },
      {
        docId: 'doc-2',
        path: 'docs/architecture.md',
        contentHash: 'hash-architecture',
        lastObservedMtimeMs: 200,
        status: 'modified',
      },
      {
        docId: 'doc-3',
        path: 'docs/deleted.md',
        contentHash: 'hash-deleted',
        lastObservedMtimeMs: 180,
        status: 'synced',
      },
    ];

    const result = detectLifecycle(currentFiles, storedDocs);

    expect(result.unchanged).toEqual(['docs/prd.md']);
    expect(result.modified).toEqual([
      {
        path: 'docs/architecture.md',
        mtimeMs: 250,
        contentHash: 'hash-architecture',
      },
    ]);
    expect(result.added).toEqual([
      {
        path: 'docs/new.md',
        mtimeMs: 300,
        contentHash: 'hash-new',
      },
    ]);
    expect(result.deleted).toEqual([
      {
        path: 'docs/deleted.md',
        docId: 'doc-3',
      },
    ]);
    expect(result.renamed).toEqual([]);
    expect(result.moved).toEqual([]);
  });

  it('should detect renamed documents when content hash matches and only the basename changes', () => {
    const currentFiles: CurrentFileSnapshot[] = [
      {
        path: 'docs/new-name.md',
        mtimeMs: 220,
        contentHash: 'hash-shared',
      },
    ];
    const storedDocs: StoredDocRecord[] = [
      {
        docId: 'doc-rename',
        path: 'docs/old-name.md',
        contentHash: 'hash-shared',
        lastObservedMtimeMs: 100,
        status: 'synced',
      },
    ];

    const result = detectLifecycle(currentFiles, storedDocs);

    expect(result.renamed).toEqual([
      {
        oldPath: 'docs/old-name.md',
        newPath: 'docs/new-name.md',
        docId: 'doc-rename',
        currentMtimeMs: 220,
      },
    ]);
    expect(result.moved).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.unchanged).toEqual([]);
  });

  it('should detect moved documents when content hash matches and only the directory changes', () => {
    const currentFiles: CurrentFileSnapshot[] = [
      {
        path: 'archive/prd.md',
        mtimeMs: 340,
        contentHash: 'hash-shared',
      },
    ];
    const storedDocs: StoredDocRecord[] = [
      {
        docId: 'doc-move',
        path: 'docs/prd.md',
        contentHash: 'hash-shared',
        lastObservedMtimeMs: 100,
        status: 'synced',
      },
    ];

    const result = detectLifecycle(currentFiles, storedDocs);

    expect(result.renamed).toEqual([]);
    expect(result.moved).toEqual([
      {
        oldPath: 'docs/prd.md',
        newPath: 'archive/prd.md',
        docId: 'doc-move',
        currentMtimeMs: 340,
      },
    ]);
    expect(result.added).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.unchanged).toEqual([]);
  });

  it('should disambiguate multiple same-hash matches using stable path signals', () => {
    const currentFiles: CurrentFileSnapshot[] = [
      {
        path: 'archive/prd.md',
        mtimeMs: 340,
        contentHash: 'hash-shared',
      },
      {
        path: 'docs/architecture-renamed.md',
        mtimeMs: 360,
        contentHash: 'hash-shared',
      },
    ];
    const storedDocs: StoredDocRecord[] = [
      {
        docId: 'doc-prd',
        path: 'docs/prd.md',
        contentHash: 'hash-shared',
        lastObservedMtimeMs: 100,
        status: 'synced',
      },
      {
        docId: 'doc-arch',
        path: 'docs/architecture.md',
        contentHash: 'hash-shared',
        lastObservedMtimeMs: 120,
        status: 'synced',
      },
    ];

    const result = detectLifecycle(currentFiles, storedDocs);

    expect(result.renamed).toEqual([
      {
        oldPath: 'docs/architecture.md',
        newPath: 'docs/architecture-renamed.md',
        docId: 'doc-arch',
        currentMtimeMs: 360,
      },
    ]);
    expect(result.moved).toEqual([
      {
        oldPath: 'docs/prd.md',
        newPath: 'archive/prd.md',
        docId: 'doc-prd',
        currentMtimeMs: 340,
      },
    ]);
    expect(result.added).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('should degrade ambiguous same-hash path changes into delete-and-add outcomes', () => {
    const currentFiles: CurrentFileSnapshot[] = [
      {
        path: 'docs/c.md',
        mtimeMs: 340,
        contentHash: 'hash-shared',
      },
      {
        path: 'docs/d.md',
        mtimeMs: 360,
        contentHash: 'hash-shared',
      },
    ];
    const storedDocs: StoredDocRecord[] = [
      {
        docId: 'doc-a',
        path: 'docs/a.md',
        contentHash: 'hash-shared',
        lastObservedMtimeMs: 100,
        status: 'synced',
      },
      {
        docId: 'doc-b',
        path: 'docs/b.md',
        contentHash: 'hash-shared',
        lastObservedMtimeMs: 120,
        status: 'synced',
      },
    ];

    const result = detectLifecycle(currentFiles, storedDocs);

    expect(result.renamed).toEqual([]);
    expect(result.moved).toEqual([]);
    expect(result.deleted).toEqual([
      {
        path: 'docs/a.md',
        docId: 'doc-a',
      },
      {
        path: 'docs/b.md',
        docId: 'doc-b',
      },
    ]);
    expect(result.added).toEqual([
      {
        path: 'docs/c.md',
        mtimeMs: 340,
        contentHash: 'hash-shared',
      },
      {
        path: 'docs/d.md',
        mtimeMs: 360,
        contentHash: 'hash-shared',
      },
    ]);
  });
});