import type { Database } from 'better-sqlite3';
import { INITIAL_SCHEMA_SQL } from './001-initial-schema.js';
import { applyAddRelationStatusMigration } from './002-add-relation-status.js';
import { applyFixV1BaselineMigration } from './003-fix-v1-baseline.js';

/**
 * 迁移描述符，包含版本号和 SQL 内容。
 */
interface Migration {
  version: number;
  apply: (db: Database) => void;
}

/**
 * 按版本号升序返回所有内置迁移。
 *
 * SQL 以 TS 模块常量内联，彻底规避运行时路径漂移问题（CR 发现 #2 修复）。
 */
function loadMigrations(): Migration[] {
  return [
    { version: 1, apply: (db) => { db.exec(INITIAL_SCHEMA_SQL); } },
    { version: 2, apply: applyAddRelationStatusMigration },
    { version: 3, apply: applyFixV1BaselineMigration },
  ];
}

/**
 * 确保 `schema_migrations` 追踪表存在。
 *
 * 该表本身不在迁移脚本中创建，而是在 runner 中提前确保其存在，
 * 以便后续迁移可以幂等地记录已执行版本。
 */
function ensureMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * 查询已执行过的迁移版本号集合。
 */
function getAppliedVersions(db: Database): Set<number> {
  const rows = db
    .prepare<[], { version: number }>('SELECT version FROM schema_migrations ORDER BY version')
    .all();
  return new Set(rows.map((r) => r.version));
}

/**
 * 执行单条迁移，在事务中运行 SQL 并记录版本号。
 * 失败时事务自动回滚（AC#6）。
 */
function applyMigration(db: Database, migration: Migration): void {
  const runInTransaction = db.transaction(() => {
    migration.apply(db);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
  });
  runInTransaction();
}

/**
 * 运行所有未执行的迁移脚本。
 *
 * 设计要点：
 * - 幂等：已执行的迁移不重复执行（AC#5）
 * - 有序：按版本号升序执行（AC#5）
 * - 事务保护：每条迁移独立事务，失败可回滚（AC#6）
 *
 * @param db better-sqlite3 数据库实例
 */
export function runMigrations(db: Database): void {
  ensureMigrationsTable(db);
  const applied = getAppliedVersions(db);
  const migrations = loadMigrations().filter((m) => !applied.has(m.version));

  for (const migration of migrations) {
    applyMigration(db, migration);
  }
}
