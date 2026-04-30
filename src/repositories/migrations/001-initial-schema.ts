/**
 * CORD v0.1 初始数据库 Schema（内联 TS 模块）
 *
 * SQL 以字符串常量内联，彻底规避运行时 `readFileSync` + `import.meta.url`
 * 在打包产物（dist）中的路径漂移问题（CR 发现 #2 修复）。
 *
 * 迁移版本号：1
 */
export const INITIAL_SCHEMA_SQL = `
-- CORD v0.1 初始数据库 Schema
-- Migration: 001-initial-schema
-- 所有表名、列名遵循 snake_case 复数命名约定（P1）

-- Schema 版本追踪表
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 文档节点表
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  path         TEXT NOT NULL UNIQUE,
  title        TEXT,
  doc_type     TEXT,
  framework    TEXT,
  content_hash TEXT,
  metadata     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_path     ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);

-- 关系边表
CREATE TABLE IF NOT EXISTS relations (
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

CREATE INDEX IF NOT EXISTS idx_relations_source_doc_id  ON relations(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_target_doc_id  ON relations(target_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_relation_type  ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_status         ON relations(status);

-- 含 source 维度的唯一索引：允许 manual + auto_scan 在同一对节点间并存
CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_unique_pair
  ON relations(source_doc_id, target_doc_id, relation_type, source);

-- 文档同步状态表
CREATE TABLE IF NOT EXISTS sync_states (
  doc_id                  TEXT    PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  last_scanned_at         TEXT    NOT NULL,
  last_observed_mtime_ms  INTEGER,
  content_hash            TEXT    NOT NULL,
  status                  TEXT    NOT NULL DEFAULT 'synced'
                          CHECK (status IN ('synced', 'modified')),
  updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;
