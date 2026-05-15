import type { Database } from 'better-sqlite3';

export const ADD_RELATION_STATUS_SQL = `
ALTER TABLE relations
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'deprecated'));

CREATE INDEX IF NOT EXISTS idx_relations_status ON relations(status);
`;

export const CREATE_RELATION_STATUS_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS idx_relations_status ON relations(status);';

function hasStatusColumn(db: Database): boolean {
  const columns = db
    .prepare<[], { name: string }>("PRAGMA table_info('relations')")
    .all();

  return columns.some((column) => column.name === 'status');
}

export function applyAddRelationStatusMigration(db: Database): void {
  if (hasStatusColumn(db)) {
    db.exec(CREATE_RELATION_STATUS_INDEX_SQL);
    return;
  }

  db.exec(ADD_RELATION_STATUS_SQL);
}