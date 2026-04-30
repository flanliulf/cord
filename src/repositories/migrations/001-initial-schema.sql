-- CORD v0.1 初始数据库 Schema
-- Migration: 001-initial-schema
-- 所有表名、列名遵循 snake_case 复数命名约定（P1）

-- ── Schema 版本追踪表 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── 文档节点表 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  path         TEXT NOT NULL UNIQUE,
  title        TEXT,
  doc_type     TEXT,
  framework    TEXT,
  content_hash TEXT,
  metadata     TEXT,           -- JSON 字符串
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_path     ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);

-- ── 关系边表 ──────────────────────────────────────────────────────────────
-- source_doc_id / target_doc_id 删除文档时级联删除关联边
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
  metadata        TEXT,           -- JSON 字符串
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_relations_source_doc_id  ON relations(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_target_doc_id  ON relations(target_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_relation_type  ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_status         ON relations(status);

-- 防重复复合唯一索引（同一对文档之间同一类型关系 + 同一来源只能存一条）
-- 含 source 维度：允许 manual + auto_scan 在同一对节点间并存（Story 4.2 manual 保护机制依赖）
CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_unique_pair
  ON relations(source_doc_id, target_doc_id, relation_type, source);

-- ── 文档同步状态表 ────────────────────────────────────────────────────────
-- doc_id 删除文档时级联删除同步状态
CREATE TABLE IF NOT EXISTS sync_states (
  doc_id                  TEXT    PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  last_scanned_at         TEXT    NOT NULL,
  last_observed_mtime_ms  INTEGER,  -- 上次扫描时观测到的文件 mtimeMs（Story 2.6 增量扫描依赖）
  content_hash            TEXT    NOT NULL,
  status                  TEXT    NOT NULL DEFAULT 'synced'
                          CHECK (status IN ('synced', 'modified')),
  updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);
