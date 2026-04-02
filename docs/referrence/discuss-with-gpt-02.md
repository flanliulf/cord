下面给你一套可以直接落地的“Doc Graph（文档关系图）”规范：**relation_type 字典 + 元数据约束 + SQLite/JSON 设计 + hooks 流程 + CLAUDE.md 规则片段 + 2.1/2.2 示例**。你可以先用 *skill + SQLite/JSON* 跑通，再升级成 MCP 服务。

---

## 0. 统一约定（强烈建议先定死）

### 文档唯一标识

* `doc_id`：稳定唯一（推荐：`DOC.<domain>.<module>.<name>`）
* `path`：相对仓库路径（可变，但要记录历史）
* `kind`：文档类型枚举（API_OVERVIEW / API_MODULE / ADR / TSD / README / GLOSSARY / SCHEMA / RUNBOOK …）
* `module`：业务模块（可空）
* `hash`：文档内容 hash（用于变更检测）
* `anchors`：章节/块级定位点（用于“章节同步”）

### Anchor 建议

* 不要只依赖 Markdown heading slug（易漂移）
* 推荐在需要稳定定位的章节前加显式 anchor：
  `<!-- anchor: api-list:module-x -->`
* 关系边可以引用 `src_anchor` / `dst_anchor`

### “可控同步块”（让自动补丁安全）

对“总览/索引/清单”类文档，建议用托管块包起来（工具只改块内）：

```md
<!-- docgraph:begin id=api-inventory module=payments -->
... 这里由工具维护 ...
<!-- docgraph:end id=api-inventory -->
```

---

## 1) relation_type 字典（含方向、语义、同步策略、触发器）

> 你可以把它当成“关系 DSL”。关键是每个 relation_type 要定义：**方向语义**与**传播/同步规则**。

下面按 6 大类给出推荐最小全集（够覆盖绝大多数场景）。

### A. 结构/渐进披露（Composition / Progressive Disclosure）

| type                   | 推荐方向              | 语义                 | 同步策略                              | 常见触发器           |
| ---------------------- | ----------------- | ------------------ | --------------------------------- | --------------- |
| `section_expands_to`   | A -> B            | A 的某章节展开为 B（渐进披露）  | 通常 `mark_stale` 或 `propose_patch` | B 变更、B 新增章节     |
| `overview_of`          | A -> B            | A 为 B 的概览（更偏解释/导读） | `mark_stale`                      | B 大改            |
| `index_of`             | A -> B            | A 是 B 集合的目录/索引入口   | 常配合 `aggregates_from`             | 新增/删除成员文档       |
| `contains` / `part_of` | A -> B            | 结构包含/归属            | 无自动同步（结构关系）                       | 创建/移动文档         |
| `owned_by_module`      | Doc -> Module(虚拟) | 文档归属模块（便于发现/聚合）    | 无                                 | front matter 更新 |

### B. 引用/证据（Reference / Citation）

| type              | 推荐方向   | 语义                    | 同步策略             | 触发器    |
| ----------------- | ------ | --------------------- | ---------------- | ------ |
| `cites`           | A -> B | A 引用 B 作为依据           | `mark_stale`（可选） | B 结论变化 |
| `defines_term_in` | A -> B | A 使用的术语定义在 B          | 无                | 术语定义更新 |
| `source_for`      | B -> A | B 是 A 某段的来源（反向更好做影响面） | `mark_stale`     | B 变更   |
| `example_in`      | A -> B | A 的示例在 B              | `mark_stale`     | 示例变更   |

### C. 权威/派生（Authority / Derivation）

| type                | 推荐方向           | 语义              | 同步策略                      | 触发器      |
| ------------------- | -------------- | --------------- | ------------------------- | -------- |
| `authoritative_for` | B -> Topic(虚拟) | B 是某主题 SSOT     | 强规则：其他文档不得覆盖细节            | 写入/合并时校验 |
| `derived_from`      | A -> B         | A 由 B 派生（人工/自动） | `propose_patch` 或可重建      | B 变更     |
| `generated_from`    | A -> B         | A 由工具从 B 生成     | `autopatch`（重生成）          | B 变更     |
| `summarizes`        | A -> B         | A 是 B 摘要        | `mark_stale`（允许滞后）        | B 变更     |
| `extracts`          | A -> B         | A 抽取了 B 的字段/片段  | `autopatch/propose_patch` | B 变更     |

### D. 一致性/冲突（Consistency / Lifecycle）

| type                      | 推荐方向   | 语义              | 同步策略                    | 触发器      |
| ------------------------- | ------ | --------------- | ----------------------- | -------- |
| `must_be_consistent_with` | A -> B | A 必须与 B 一致（强约束） | `propose_patch` + CI 校验 | A/B 任一变更 |
| `conflicts_with`          | A -> B | 发现冲突（待处理）       | 无自动同步（建工单）              | LLM/规则检测 |
| `duplicates`              | A -> B | 内容重叠/重复         | 无                       | 新文档生成    |
| `supersedes`              | A -> B | A 取代 B          | 建议标记 B deprecated       | 发布/重构    |
| `deprecated_by`           | B -> A | B 被 A 废弃        | 同上                      | 发布/重构    |

### E. 需求到实现追踪（Traceability）

| type                | 推荐方向                    | 语义         | 同步策略                          | 触发器          |
| ------------------- | ----------------------- | ---------- | ----------------------------- | ------------ |
| `requires`          | PRD -> Capability/Doc   | 需求依赖某能力/约束 | 无                             | PRD 更新       |
| `implemented_by`    | PRD/Spec -> TSD/CodeRef | 被实现        | 可做覆盖率报表                       | 合并/发布        |
| `specifies`         | Spec -> ImplDoc         | Spec 约束实现  | `must_be_consistent_with` 常搭配 | Spec/Impl 变更 |
| `validated_by`      | Spec -> Test/Runbook    | 被验证        | 无                             | 测试新增         |
| `api_defined_in`    | Overview -> API_MODULE  | API 权威定义所在 | 常用 `enumerates_items_from`    | API 变更       |
| `schema_defined_in` | Doc -> SCHEMA           | 数据模型权威     | 同上                            | Schema 变更    |

### F. 聚合/同步（你的 2.1/2.2 核心）

| type                    | 推荐方向           | 语义                    | 同步策略                              | 触发器        |
| ----------------------- | -------------- | --------------------- | --------------------------------- | ---------- |
| `enumerates_items_from` | A -> B         | A 枚举 B 的条目（API/事件/表…） | **强建议 `propose_patch` 起步**        | B 新增/删除条目  |
| `aggregates_from`       | A -> Query(虚拟) | A 按规则聚合文档集合           | `autopatch/propose_patch`         | 新增成员/元数据变化 |
| `member_of_aggregate`   | B -> A         | B 属于 A 的聚合视图          | 通常自动维护                            | B 创建/移动    |
| `sync_required_from`    | A -> B         | A 某段必须与 B 同步（强一致）     | `autopatch/propose_patch` + CI 校验 | A/B 变更     |
| `sync_suggested_from`   | A -> B         | 建议同步（弱一致）             | `mark_stale`                      | B 变更       |
| `discovered_by_rule`    | B -> A         | B 由规则发现并挂到 A          | 无（审计用）                            | 扫描/索引      |

---

## 2) 关系边元数据（让 relation_type “可执行”）

**Edge 最小字段：**

* `src_doc_id`, `dst_doc_id`, `type`
* `src_anchor?`, `dst_anchor?`
* `status`: `PROPOSED | CONFIRMED | REJECTED | AUTO_CONFIRMED`
* `confidence`（0~1）
* `evidence`（数组：规则命中/显式链接/LLM 推断的依据摘要）
* `sync`（仅同步类需要）：

  * `sync_mode`: `autopatch | propose_patch | mark_stale`
  * `item_kind`: `api_endpoint | event | table | field | glossary_term | ...`
  * `projection`: 需要同步的字段集合（如 API 的 method/path/summary）
  * `target_block_id`：写入 A 的托管块 id
  * `last_synced_hash`, `last_synced_at`, `stale:boolean`

---

## 3) SQLite 设计（推荐长期主存储）

> 这是“够用且不臃肿”的版本：文档、anchor、关系、审计、同步状态。

```sql
PRAGMA foreign_keys = ON;

-- 1) 文档节点
CREATE TABLE IF NOT EXISTS documents (
  doc_id        TEXT PRIMARY KEY,
  path          TEXT NOT NULL,
  title         TEXT,
  kind          TEXT NOT NULL,
  module        TEXT,
  domain        TEXT,
  content_hash  TEXT NOT NULL,
  meta_json     TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_kind   ON documents(kind);
CREATE INDEX IF NOT EXISTS idx_documents_module ON documents(module);
CREATE INDEX IF NOT EXISTS idx_documents_path   ON documents(path);

-- 2) Anchor（可选但强烈建议）
CREATE TABLE IF NOT EXISTS anchors (
  anchor_id     TEXT PRIMARY KEY,         -- 例如 "api-list:module-x"
  doc_id        TEXT NOT NULL,
  anchor_type   TEXT NOT NULL,            -- heading | block | explicit
  title         TEXT,
  position_hint TEXT,                     -- 行号/范围/slug（辅助）
  hash          TEXT,                     -- 该段内容 hash（可做细粒度 stale）
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_anchors_doc ON anchors(doc_id);

-- 3) 关系边
CREATE TABLE IF NOT EXISTS relations (
  relation_id   TEXT PRIMARY KEY,         -- UUID
  src_doc_id    TEXT NOT NULL,
  dst_doc_id    TEXT NOT NULL,
  type          TEXT NOT NULL,
  src_anchor_id TEXT,
  dst_anchor_id TEXT,
  status        TEXT NOT NULL,            -- PROPOSED/CONFIRMED/REJECTED/AUTO_CONFIRMED
  confidence    REAL NOT NULL DEFAULT 0.5,
  meta_json     TEXT NOT NULL DEFAULT '{}',
  created_by    TEXT NOT NULL,            -- ai|human|hook|ci
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(src_doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE,
  FOREIGN KEY(dst_doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE,
  FOREIGN KEY(src_anchor_id) REFERENCES anchors(anchor_id) ON DELETE SET NULL,
  FOREIGN KEY(dst_anchor_id) REFERENCES anchors(anchor_id) ON DELETE SET NULL
);

-- 防重复：同一对文档+类型+anchor 组合唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_relation_tuple
ON relations(src_doc_id, dst_doc_id, type, IFNULL(src_anchor_id,''), IFNULL(dst_anchor_id,''));

CREATE INDEX IF NOT EXISTS idx_rel_src  ON relations(src_doc_id);
CREATE INDEX IF NOT EXISTS idx_rel_dst  ON relations(dst_doc_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relations(type);
CREATE INDEX IF NOT EXISTS idx_rel_status ON relations(status);

-- 4) 关系证据（可解释性/审计）
CREATE TABLE IF NOT EXISTS relation_evidence (
  evidence_id   TEXT PRIMARY KEY,
  relation_id   TEXT NOT NULL,
  evidence_type TEXT NOT NULL,            -- explicit_link|front_matter|rule|llm
  detail_json   TEXT NOT NULL,            -- 摘要、命中规则、引用片段hash等（避免存原文）
  created_at    TEXT NOT NULL,
  FOREIGN KEY(relation_id) REFERENCES relations(relation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_rel ON relation_evidence(relation_id);

-- 5) 同步状态（只对需要同步的关系/块）
CREATE TABLE IF NOT EXISTS sync_state (
  relation_id      TEXT PRIMARY KEY,
  target_block_id  TEXT,
  item_kind        TEXT,
  projection_json  TEXT NOT NULL DEFAULT '[]',
  sync_mode        TEXT NOT NULL,         -- autopatch|propose_patch|mark_stale
  last_synced_hash TEXT,
  last_synced_at   TEXT,
  stale            INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(relation_id) REFERENCES relations(relation_id) ON DELETE CASCADE
);
```

> 如果你一定要最小化：`anchors / relation_evidence / sync_state` 都可后加，但 **2.1/2.2 真正想“自动同步”**，`sync_state` 基本不可少。

---

## 4) JSON 设计（适合入库快照 / 轻量模式）

建议一个文件就够（也可拆分）：

```json
{
  "version": 1,
  "generated_at": "2026-03-01T12:00:00Z",
  "nodes": [
    {
      "doc_id": "DOC.api.overview",
      "path": "docs/api/overview.md",
      "kind": "API_OVERVIEW",
      "module": null,
      "title": "API 总览",
      "content_hash": "sha256:...",
      "meta": { "domain": "api" },
      "anchors": [
        { "anchor_id": "api-inventory", "type": "block", "hash": "sha256:..." }
      ]
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "src": "DOC.api.overview",
      "dst": "DOC.api.module.payments",
      "type": "enumerates_items_from",
      "src_anchor": "api-inventory",
      "dst_anchor": null,
      "status": "CONFIRMED",
      "confidence": 1.0,
      "meta": {
        "item_kind": "api_endpoint",
        "projection": ["method","path","summary"],
        "target_block_id": "api-inventory",
        "sync_mode": "propose_patch"
      },
      "evidence": [
        { "type": "front_matter", "detail": { "rule": "kind=API_MODULE" } }
      ]
    }
  ]
}
```

### JSON vs SQLite 的推荐用法

* **运行时写入**：SQLite（事务/索引/并发）
* **仓库可审阅**：导出 JSON snapshot（可 diff / 可回滚 / 可 code review）

---

## 5) hooks 流程（文档生成/修改后自动触发）

你可以把它抽象成一个固定流水线（hook 触发后统一跑）：

1. `scan_document`

* 读取 front matter：`doc_id/kind/module/domain/tags`
* 解析 anchors（显式 anchor、托管块）
* 计算 `content_hash` +（可选）anchor hash

2. `upsert_document + upsert_anchors`

3. `extract_deterministic_relations`（可 AUTO_CONFIRMED）

* 显式链接：`[xxx](path#anchor)` / `doc_id:` 引用
* front matter 声明：`references: [...]`
* 目录约定：例如 `docs/api/modules/*.md => kind=API_MODULE`

4. `suggest_semantic_relations`（LLM 推断，默认 PROPOSED）

* 比如：识别“概览-详情”“总结-来源”“一致性约束”等

5. `impact_analysis(changed_doc_id)`

* 找出：

  * 以 changed_doc 为 `dst` 的同步边（需要更新上游 A）
  * `must_be_consistent_with` 的校验集合
  * `aggregates_from` 受影响的聚合视图

6. `sync_or_propose`

* 对 `autopatch`：只改托管块并写审计
* 对 `propose_patch`：生成 diff（或 patch 文件）供确认
* 对 `mark_stale`：写入 stale 标记/任务条目（也可进 TECH_DEBT/Doc TODO）

7. `audit_log`

* 记录谁触发、做了什么、改了哪些关系/哪些块、confidence/evidence

---

## 6) CLAUDE.md 规则片段（你可以直接粘贴改）

```md
## Doc Graph 关系维护规则（强制）

1. 每次创建/修改 docs/ 下的文档后：
   - 必须调用工具：doc_graph.upsert_document
   - 必须调用工具：doc_graph.extract_relations（确定性关系自动确认）
   - 必须调用工具：doc_graph.impact_analysis（输出受影响文档列表）

2. 对于以下文档类型，必须使用“托管块”：
   - API 总览/索引/清单类（API_OVERVIEW, INDEX）
   - 数据字典总览（SCHEMA_OVERVIEW）
   工具仅允许改动托管块内部内容。

3. 同步策略默认：
   - enumerate/aggregate 类关系：sync_mode = propose_patch
   - generated_from / extracts：可选 autopatch（必须可审计）
   - must_be_consistent_with：CI 校验失败必须修复或显式标记 conflicts_with

4. 关系写入分层：
   - 显式链接/元数据/目录规则 => AUTO_CONFIRMED
   - LLM 推断 => PROPOSED（需要人工确认或二次规则确认）

5. 任何自动修改必须写入审计：
   - created_by, evidence, last_synced_hash, git_commit（如可获得）
```

---

## 7) 针对你 2.1 / 2.2 的“标准建模”示例

### 2.1：A 枚举 B 的 API 列表，B 新增 endpoint => A 同步

建立关系：

* `A --enumerates_items_from--> B`
* meta：

  * `item_kind=api_endpoint`
  * `projection=[method,path,summary]`
  * `target_block_id=api-inventory:payments`
  * `sync_mode=propose_patch`

同步时工具做：

* 从 B 提取 endpoints（来源可以是 OpenAPI/Markdown 表格/DSL）
* 生成 A 托管块内的条目表（按 projection 渲染）
* 比对 `last_synced_hash`，变更则产出 patch 或自动写入

### 2.2：新增模块文档 C 自动被 A 收录（无需人工手连）

A 建一个聚合规则（虚拟节点 Query）：

* `A --aggregates_from--> QUERY(api_modules where domain=api)`
* 当扫描到 C（kind=API_MODULE）：

  * 写入 `C --member_of_aggregate--> A`（AUTO_CONFIRMED）
  * 触发 A 的聚合块重生成（包含 C）

---

## 8) 实施优先级（建议你按这个顺序做，风险最低）

1. **先把 doc_id/kind/module/front matter 规范落地**（不然发现/聚合做不起来）
2. 做 `upsert_document + get_related(depth=1)`（先能查双链）
3. 做 `enumerates_items_from + 托管块`（先解决 2.1）
4. 做 `aggregates_from + member_of_aggregate`（再解决 2.2）
5. 再上 `must_be_consistent_with / conflicts_with` 做治理闭环
6. 最后再决定是否升级 MCP（当你要跨 IDE/多人/CI 复用时）

---

如果你下一步想直接开工，我可以再补两份“可复制粘贴”的内容：

1. **relation_type 的 machine-readable 字典（YAML）**：每个 type 的 allowed meta 字段、默认 sync_mode、可否 AUTO_CONFIRMED、建议方向
2. **API 提取器约定**：从 API_MODULE 文档里如何稳定抽取 endpoints（Markdown 表格 / OpenAPI 片段 / DSL 三选一，并给出解析规则与示例）
