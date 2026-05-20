import type { Database } from 'better-sqlite3';

export const CREATE_RELATIONS_TABLE_SQL = `
CREATE TABLE relations (
  id              TEXT    PRIMARY KEY,
  source_doc_id   TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_doc_id   TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relation_type   TEXT    NOT NULL
                          CHECK (relation_type IN ('sync_required', 'context_for', 'lifecycle_bound', 'contains', 'must_consistent', 'sync_suggested', 'derived_from', 'deprecated', 'references')),
  confidence      REAL    NOT NULL DEFAULT 0.5,
  source          TEXT    NOT NULL DEFAULT 'auto_scan'
                          CHECK (source IN ('auto_scan', 'manual', 'framework_preset')),
  status          TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'deprecated')),
  metadata        TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

export const CREATE_SYNC_STATES_TABLE_SQL = `
CREATE TABLE sync_states (
  doc_id                  TEXT    PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  last_scanned_at         TEXT    NOT NULL,
  last_observed_mtime_ms  INTEGER,
  content_hash            TEXT    NOT NULL,
  status                  TEXT    NOT NULL DEFAULT 'synced'
                          CHECK (status IN ('synced', 'modified')),
  updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

export const CREATE_RELATIONS_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_relations_source_doc_id  ON relations(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_target_doc_id  ON relations(target_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_relation_type  ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_status         ON relations(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_unique_pair
  ON relations(source_doc_id, target_doc_id, relation_type, source);
`;

const RELATIONS_BACKUP_TABLE = 'relations__cord_v1_baseline_backup';
const SYNC_STATES_BACKUP_TABLE = 'sync_states__cord_v1_baseline_backup';

export function applyFixV1BaselineMigration(db: Database): void {
  if (needsRelationsTableRebuild(db)) {
    rebuildRelationsTable(db);
  }

  ensureRelationsIndexes(db);

  if (needsSyncStatesTableRebuild(db)) {
    rebuildSyncStatesTable(db);
  }
}

function needsRelationsTableRebuild(db: Database): boolean {
  const tableSql = getTableSql(db, 'relations');

  return !tableSql.includes("relation_type IN ('sync_required'")
    || !tableSql.includes("source IN ('auto_scan'")
    || !tableSql.includes("status IN ('active'");
}

function needsSyncStatesTableRebuild(db: Database): boolean {
  const tableSql = getTableSql(db, 'sync_states');
  return !tableSql.includes("status IN ('synced'");
}

function rebuildRelationsTable(db: Database): void {
  db.exec(`
    DROP TABLE IF EXISTS ${RELATIONS_BACKUP_TABLE};
    ALTER TABLE relations RENAME TO ${RELATIONS_BACKUP_TABLE};
    ${CREATE_RELATIONS_TABLE_SQL}
    INSERT INTO relations (
      id, source_doc_id, target_doc_id, relation_type, confidence, source, status, metadata, created_at, updated_at
    )
    SELECT
      id, source_doc_id, target_doc_id, relation_type, confidence, source, status, metadata, created_at, updated_at
    FROM ${RELATIONS_BACKUP_TABLE};
    DROP TABLE ${RELATIONS_BACKUP_TABLE};
  `);
}

function rebuildSyncStatesTable(db: Database): void {
  db.exec(`
    DROP TABLE IF EXISTS ${SYNC_STATES_BACKUP_TABLE};
    ALTER TABLE sync_states RENAME TO ${SYNC_STATES_BACKUP_TABLE};
    ${CREATE_SYNC_STATES_TABLE_SQL}
    INSERT INTO sync_states (
      doc_id, last_scanned_at, last_observed_mtime_ms, content_hash, status, updated_at
    )
    SELECT
      doc_id, last_scanned_at, last_observed_mtime_ms, content_hash, status, updated_at
    FROM ${SYNC_STATES_BACKUP_TABLE};
    DROP TABLE ${SYNC_STATES_BACKUP_TABLE};
  `);
}

function ensureRelationsIndexes(db: Database): void {
  if (!uniquePairIndexIncludesSource(db)) {
    db.exec('DROP INDEX IF EXISTS idx_relations_unique_pair;');
  }

  db.exec(CREATE_RELATIONS_INDEXES_SQL);
}

function uniquePairIndexIncludesSource(db: Database): boolean {
  const columns = db
    .prepare<[], { name: string }>("PRAGMA index_info('idx_relations_unique_pair')")
    .all()
    .map((column) => column.name);

  return columns.join(',') === 'source_doc_id,target_doc_id,relation_type,source';
}

function getTableSql(db: Database, tableName: string): string {
  const row = db
    .prepare<[string], { sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  if (!row) {
    throw new Error(`Missing required table during migration: ${tableName}`);
  }

  return row.sql;
}