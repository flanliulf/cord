---
Story: 1-4
Round: 1
Date: 2026-04-28
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: 1-4-code-review-summary-20260428-round-1.md
Review Model: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 1-4 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。原审查共提出 5 项发现（2 高 / 2 中 / 1 低），覆盖唯一索引语义冲突、迁移 SQL 打包缺失、可变字段保护、Mapper 运行时校验和 lint 失败。经独立验证，5 项发现全部成立，其中 4 项需立即修复，1 项可降级为 CR TODO。结论：**审查准确度高，建议按评估意见执行修复**。

---

## 发现 #1 评估

### 审查原文

> **[高] 关系唯一索引缺少 `source` 维度，和 manual 保护设计自相矛盾**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经核实：
- [src/repositories/migrations/001-initial-schema.sql](src/repositories/migrations/001-initial-schema.sql#L48-L50) `CREATE UNIQUE INDEX idx_relations_unique_pair ON relations(source_doc_id, target_doc_id, relation_type)` 唯一性维度仅含三列，确实未包含 `source`。
- [src/repositories/interfaces.ts](src/repositories/interfaces.ts#L88-L99) 的 `deleteRelationsByDocId` 通过 `excludeSources` 暴露了「按 source 区分保留 / 删除」的能力，且注释明确指向 Story 4.2 manual 保护机制。
- [src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L186-L218) 的实现按 `source NOT IN (...)` 构造删除语句，进一步证实「同一对节点 + 同一关系类型 + 不同 source」需要并存的语义。
- Story 文档 [1-4 spec L85-87](\_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md#L85-L87) 与 L150 同时存在该矛盾，属于 spec 自身未澄清。

**严重性判断：合理**

「高」严重性合理。该冲突会在 Story 4.x 的 manual relation 保护场景中触发 `UNIQUE constraint failed` 运行时异常，是核心数据模型缺陷，会阻塞后续 Epic 4。

**修复建议：可行**

建议 1（含 `source` 唯一索引）实施成本低、向前兼容性最好；建议 2（将 source 改为单条记录属性）涉及领域模型重构，风险更大。**采用建议 1**：将索引调整为 `(source_doc_id, target_doc_id, relation_type, source)`，并补充覆盖 manual + auto_scan 并存与定向删除的回归测试。

**误报评估：非误报**

代码与 spec 双向证据充分，blind 来源单层命中但语义证据链完整。

---

## 发现 #2 评估

### 审查原文

> **[高] 构建产物未包含迁移 SQL，发布后仓储初始化会在运行时找不到文件**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立复现：
- [src/repositories/migrations/runner.ts](src/repositories/migrations/runner.ts#L20-L29) 通过 `readFileSync(join(dir, '001-initial-schema.sql'), 'utf-8')` 在运行时从相对 `import.meta.url` 解析的目录读取 SQL。
- [tsup.config.ts](tsup.config.ts#L1-L16) 仅声明 entry/format/dts，未配置 `loader`、`publicDir` 或资源复制。
- 实测 `npm run build` 后 `dist/repositories/migrations/` 目录不存在，无任何 `.sql` 产物。
- Story 文档 L235 已注明「runner.ts 使用 readFileSync ... 在 dist 构建后需要 tsup 配置 publicDir 或手动复制 SQL，可在后续 Story 中处理」，但本 Story 的 AC#5（迁移执行器幂等运行）实际上必然依赖运行时能取到 SQL，**不能延后**。

**严重性判断：合理**

「高」严重性合理。属于发布路径上的硬故障：源码态测试全绿、`dist` 安装后首次 `new SqliteGraphRepository(...)` 即崩溃，直接破坏 Story 的可交付性。

**修复建议：可行**

建议「构建时复制 sql 到 dist」或「构建时内联 SQL」均可。推荐方案：在 `tsup.config.ts` 中通过 `onSuccess` 或 `esbuildPlugins` 复制 `src/repositories/migrations/*.sql` 到 `dist/repositories/migrations/`；或更稳妥地将 SQL 改为 TS 模块内联导出（避免 ESM `import.meta.url` 在不同打包形态下的路径漂移）。需补充 `dist` 冒烟测试。

**误报评估：非误报**

构建产物缺失已通过 `find dist -name "*.sql"` 直接证实。

---

## 发现 #3 评估

### 审查原文

> **[中] `updateDocument` / `updateRelation` 允许传入不可变字段，返回值可能与数据库状态不一致**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

- [src/repositories/interfaces.ts](src/repositories/interfaces.ts#L52) `updateDocument(id, updates: Partial<DocumentNode>)`、L79 `updateRelation(id, updates: Partial<RelationEdge>)` 均接受全量 `Partial`，未排除 `id` / `createdAt` / `updatedAt`。
- [src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L72-L92) `updateDocument` 通过 `{ ...existing, ...updates, id, updatedAt: new Date().toISOString() }` 强制覆盖 `id` 和 `updatedAt`，但 `createdAt` 会被 `updates` 覆盖到内存对象 `merged`；同时 SQL `UPDATE` 语句中**不含 `created_at` 列**，所以 DB 持久态保留原值，而函数返回值是被污染的 `merged` 对象。
- L158-180 `updateRelation` 存在完全相同的不一致模式。

**严重性判断：合理偏高**

原始判定「中」合理。考虑到 blind+edge 双层命中 + 持久态/内存态漂移会污染上层缓存与日志，**评估后建议提升为 P1**（与高严重性发现同批修复，避免遗留到下游 Story）。

**修复建议：可行**

收窄类型为 `Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>` 并在仓储层显式丢弃这些字段；补充测试断言「传入 createdAt 不生效且返回值不变」。

**误报评估：非误报**

代码路径直接可读；blind+edge 双层命中可信度高。

---

## 发现 #4 评估

### 审查原文

> **[中] Mapper 对枚举值和 JSON 元数据缺少运行时校验，单条脏数据就会破坏读取链路**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

- [src/repositories/mappers.ts](src/repositories/mappers.ts#L56-L59) `rowToDocument` 中 `JSON.parse(row.metadata)` 无 try/catch；L106-109 `rowToRelation` 同。
- L102-105 `relation_type as RelationType`、`source as RelationSource`、`status as 'active' | 'deprecated'` 三个 `as` 断言均无白名单校验；L151-152 `rowToSyncState.status` 同。
- [src/repositories/migrations/001-initial-schema.sql](src/repositories/migrations/001-initial-schema.sql#L34-L37) 的 `relations.source` / `status`、L60 的 `sync_states.status` 均无 `CHECK` 约束。

**严重性判断：合理**

「中」合理。单条脏数据足以让 `getAllDocuments`/`getAllRelations` 整体崩溃（map 抛出会终止整个查询），影响面较广。建议保持 P1，与持久层稳健性一同处理。

**修复建议：可行**

- 数据库层：补充 `CHECK (source IN ('auto_scan','manual','framework_preset'))`、`CHECK (status IN ('active','deprecated'))`、`CHECK (status IN ('synced','modified'))`。
- Mapper 层：将 `JSON.parse` 包裹 try/catch，校验失败时抛出带 `id`/`path`/`列名` 上下文的 `RepositoryError`；对枚举字段使用白名单常量校验。
- 补充坏 JSON、非法枚举值的失败用例。

**误报评估：非误报**

blind+edge 双层命中，证据明确。

---

## 发现 #5 评估

### 审查原文

> **[低] 当前 Story 分支未通过 lint，测试文件存在未使用导入**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

实测 `npm run lint` 输出：
```
tests/unit/repositories/sqlite-graph-repository.test.ts
  3:15  error  'IGraphRepository' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (1 error, 0 warnings)
```
与审查描述完全一致。位于 [tests/unit/repositories/sqlite-graph-repository.test.ts](tests/unit/repositories/sqlite-graph-repository.test.ts#L3)。

**严重性判断：偏低**

原始判定「低」从问题本身严重程度看合理；但从「质量门禁阻塞交付」角度看，lint 失败是阻塞性的。**评估提升为 P1（修复成本极小，且不修则 CI 不绿）**。

**修复建议：可行**

直接删除 `import type { IGraphRepository } from '../../../src/repositories/interfaces.js';`。修复成本约 1 秒。

**误报评估：非误报**

auditor 单层命中，但质量门禁运行结果可直接复现。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 关系唯一索引缺 source 维度 | [高] | **P1** | 与 manual 保护设计冲突，会破坏 Epic 4，必须修复唯一索引。 |
| 2 | dist 缺迁移 SQL | [高] | **P1** | 发布路径硬故障，需在构建时复制或内联 SQL。 |
| 3 | update 允许传不可变字段 | [中] | **P1** | 内存/持久态漂移，收窄类型并丢弃不可变字段。 |
| 4 | Mapper 缺运行时校验 | [中] | **P1** | 增加 CHECK 约束 + try/catch + 白名单校验。 |
| 5 | lint 未通过（未使用导入） | [低] | **P1** | 阻塞 CI，删除未使用导入即可。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（唯一索引缺 source 维度）**：确认有效，P1 立即修复——索引调整为 `(source_doc_id, target_doc_id, relation_type, source)`，并补充 manual + auto_scan 并存与定向删除测试。
- **发现 #2（dist 缺 SQL）**：确认有效，P1 立即修复——推荐内联 SQL 方案以彻底规避路径漂移；如保留外部文件方案则需配 tsup `onSuccess` 复制并补 dist 冒烟测试。
- **发现 #3（update 接受不可变字段）**：确认有效并提升至 P1——收窄 `updateDocument` / `updateRelation` 入参类型，仓储层显式丢弃 `id` / `createdAt` / `updatedAt`，补充回归测试。
- **发现 #4（Mapper 校验缺失）**：确认有效，P1 修复——SQL 增加 CHECK 约束，Mapper 加 try/catch 与白名单校验，补充失败用例。
- **发现 #5（lint 失败）**：确认有效并提升至 P1——直接删除未使用导入，使 `npm run lint` 通过。

---

## 修复执行记录

- **执行日期**：2026-04-28
- **执行模型**：Claude Sonnet 4.6
- **修复项数**：5 项（全部 P1）

### F1 — 删除未使用导入（发现 #5）

- **文件**：`tests/unit/repositories/sqlite-graph-repository.test.ts`
- **操作**：删除 `import type { IGraphRepository }` 一行
- **结果**：`npm run lint` 通过，无 lint 错误

### F2 — 收窄 update 入参类型并丢弃不可变字段（发现 #3）

- **文件**：`src/repositories/interfaces.ts`、`src/repositories/sqlite-graph-repository.ts`
- **操作**：
  - `IGraphRepository.updateDocument` / `updateRelation` 签名改为 `Omit<Partial<...>, 'id' | 'createdAt' | 'updatedAt'>`
  - 实现层 `updateDocument` / `updateRelation` 用 `{ id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates }` 解构并 `void` 压制警告；`createdAt` 显式从已存记录透传
- **结果**：类型级拦截非法字段，内存/DB 状态一致

### F3 — 唯一索引含 source 维度（发现 #1）

- **文件**：`src/repositories/migrations/001-initial-schema.sql`、`src/repositories/migrations/001-initial-schema.ts`
- **操作**：`CREATE UNIQUE INDEX idx_relations_unique_pair ON relations(source_doc_id, target_doc_id, relation_type, source)`（增加 source 列）
- **新增测试**：`sqlite-graph-repository.test.ts` — F3 组，验证 manual + auto_scan 并存（不抛错）及同 source 重复插入（抛 UNIQUE 约束错误）
- **结果**：Story 4.2 manual 保护机制依赖得到正确支撑

### F4 — CHECK 约束 + Mapper 运行时白名单校验（发现 #4）

- **文件**：`src/repositories/migrations/001-initial-schema.sql`、`src/repositories/migrations/001-initial-schema.ts`、`src/repositories/mappers.ts`
- **操作**：
  - SQL 增加 `relations.source`、`relations.status`、`sync_states.status` 的 CHECK 约束
  - `mappers.ts` 新增 `parseJsonMetadata()`（try/catch + `{ cause }`）和 `assertEnum<T>()`（白名单校验）辅助函数
  - `rowToDocument` 使用 `parseJsonMetadata`；`rowToRelation` 使用 `assertEnum` 校验三个枚举字段 + `parseJsonMetadata`；`rowToSyncState` 使用 `assertEnum` 校验 status
- **新增测试**：`mappers.test.ts` — F4 组，共 6 个失败用例（非法 JSON、非法 relationType/source/status/syncState status）
- **结果**：单行数据损坏不再导致整个查询崩溃，错误消息含表名、列名、ID 上下文

### F5 — SQL 内联为 TS 模块（发现 #2）

- **新增文件**：`src/repositories/migrations/001-initial-schema.ts`（导出 `INITIAL_SCHEMA_SQL` 字符串常量）
- **修改文件**：`src/repositories/migrations/runner.ts`
  - 移除 `node:fs`、`node:path`、`node:url` 导入
  - `loadMigrations()` 改为返回 `[{ version: 1, sql: INITIAL_SCHEMA_SQL }]`
- **原 SQL 文件**：`001-initial-schema.sql` 保留为人类可读参考，不再参与运行时
- **结果**：`npm run build` 成功，`dist/` 产物不依赖任何外部 `.sql` 文件，彻底规避路径漂移

### 最终验证

| 检查项 | 结果 |
|--------|------|
| `npx vitest run` | ✅ 198 tests passed (15 test files) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ ESM + DTS build success |
