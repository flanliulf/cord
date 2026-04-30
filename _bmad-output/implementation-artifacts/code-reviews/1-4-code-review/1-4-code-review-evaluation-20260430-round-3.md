---
Story: 1-4
Round: 3
Date: 2026-04-30
Model Used: Claude Sonnet 4.6
Type: Code Review Evaluation
---

## 评估总结

对 Story 1-4 的第 3 轮 CR 代码审查结果进行逐条评估。本轮审查共提出 2 项发现（1 高 / 1 中）。经独立验证：

- **#1（`relation_type` 缺 DB CHECK 约束）**：技术属实，Round 2 的评估文件中对「所有 CHECK 约束已补齐」的判断确实不成立，这是真实的 schema 完整性缺口，**确认为阻塞项，需立即修复**。
- **#2（Mapper 错误缺统一错误类型）**：有效观察，但严重性偏高。当前 fail-fast + 带上下文文本的实现已满足可诊断性需求；引入 `RepositoryError` 类型属于架构演进，非当前 story 阻塞项，**建议降级为 P3 / CR TODO**。

**结论：#1 阻塞，执行修复后再行放行。**

---

## 发现 #1 评估

### 审查原文

> **[高][新] `relations.relation_type` 仍未在数据库层受约束，Round 2 的放行依据不成立**
> - 来源：blind
> - 分类：patch

### 评估结论：🚨 确认阻塞 — 需立即修复

### 评估分析

**问题描述准确性：完全准确**

- `src/repositories/migrations/001-initial-schema.ts:41` 与 `001-initial-schema.sql:34` 中 `relation_type TEXT NOT NULL` 确认无 CHECK 约束。
- `src/repositories/mappers.ts:144-146` 的 `assertEnum` 只在读取时校验，写入路径（`addRelation` / `updateRelation`）完全依赖 TS 类型，绕过 TS 层（如直接 SQL 写入）即可持久化非法值。
- Round 2 评估文件 `1-4-code-review-evaluation-20260428-round-2.md` 的「Round 1 / Finding #4 确认修复」章节声称「DB 层补充了所有 CHECK 约束」，与实际 schema 不符，这是本轮 R3 审查正确识别的评估失误。

**严重性判断：高，合理**

- DB CHECK 约束是数据完整性的最后一道防线；一旦绕过 TS/应用层，非法 `relation_type` 即可写入持久化存储。
- 9 个合法值已在 `RELATION_TYPES` 常量中明确定义，约束值域完全可知，实施成本极低。
- 修复必须与写入期回归测试同步，确保约束行为有直接测试证据。

**修复建议：执行**

为 `relation_type` 添加 CHECK 约束，值域与 `RELATION_TYPES` 常量保持一致（9 个值），同时补充写入期失败测试（直接操作底层 DB 绕过 TS 类型校验，验证 DB 拒绝非法值）。

---

## 发现 #2 评估

### 审查原文

> **[中][新] mapper 运行时错误仍直接抛裸 `Error`，缺少统一错误模型与诊断结构**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`src/repositories/mappers.ts` 中 `parseJsonMetadata` 和 `assertEnum` 在失败时直接 `throw new Error(...)`，错误文本包含上下文（table/id/column/cause），但无稳定的错误类型/错误码供上层程序性识别。

**严重性判断：偏高**

「中」偏高。考虑：
- 当前实现已提供足够的人类可读上下文信息（`[mappers] Invalid value "X" for table.col`），满足开发期诊断需求。
- 上层（CLI、MCP）目前尚未实现，也未对 `RepositoryError` 类型有依赖；引入自定义错误类型在当前 story 没有直接消费方。
- `RepositoryError` 属于仓储层错误体系的架构决策，应与 CLI 错误处理规范统一设计，而不是在单个 story 中孤立引入。

**修复建议：降级 P3 / CR TODO**

纳入 backlog，在引入 CLI 错误处理或日志规范的 Story 中与 `RepositoryError` 一并实施，保留 `table/id/column/cause` 结构化字段，并补充错误类型断言测试。

**误报评估：非误报，但优先级偏高**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 严重性 | 修复方案 |
|---|------|--------|---------|
| 1 | `relation_type` 缺 DB CHECK 约束 | [高] | 添加 CHECK 约束 + 写入期回归测试 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | Mapper 错误缺统一错误类型 | [中] | **P3** | 与 CLI 错误处理规范统一设计时引入 |

**总体评估**：#1 是真实阻塞项，补齐 `relation_type` CHECK 约束后，Story 1-4 的 schema 完整性才算真正闭合。

---

## 修复执行记录

### 修复执行记录

- **Date**: 2026-04-30
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 1（F1：`relation_type` DB CHECK 约束 + 写入期测试）

---

### F1：`relations.relation_type` 添加 DB CHECK 约束 + 写入期测试

**涉及文件**：
- `src/repositories/migrations/001-initial-schema.ts`
- `src/repositories/migrations/001-initial-schema.sql`
- `tests/unit/repositories/sqlite-graph-repository.test.ts`

**修改内容**：

**① `001-initial-schema.ts` 与 `001-initial-schema.sql`**

将 `relation_type TEXT NOT NULL,` 扩展为带 CHECK 约束：
```sql
-- 修改前
relation_type   TEXT    NOT NULL,

-- 修改后
relation_type   TEXT    NOT NULL
                        CHECK (relation_type IN (
                          'sync_required', 'context_for', 'lifecycle_bound', 'contains',
                          'must_consistent', 'sync_suggested', 'derived_from', 'deprecated', 'references'
                        )),
```

约束值域来源：`src/types/relations.ts` 的 `RELATION_TYPES` 常量（9 个值），与 `assertEnum` 使用的 `VALID_RELATION_TYPES` 集合完全对称。

**② `sqlite-graph-repository.test.ts` 新增测试组**

新增 `describe('SqliteGraphRepository — relation_type DB CHECK 约束（F1b）')` 测试组（2 个测试用例）：
- 插入非法 `relation_type`（`'INVALID_TYPE'`）时，DB CHECK 约束在写入阶段抛出错误
- 插入合法 `relation_type`（`'references'`）时，DB CHECK 约束不阻塞写入

测试方案：通过 `(repo as unknown as { db: Database }).db` 直接操作底层 SQLite，绕过 TS 类型约束，验证 DB 层防线有效。

**修复结果**：✅ 成功

**验证结果**：

| 验证项 | 结果 |
|--------|------|
| `npm test` | ✅ 200 / 200 |
| `npm run lint` | ✅ 通过 |
| `npm run build` | ✅ 通过 |

---

### TODO 处理

**Round 3 / Finding #2** 已降级为 P3，纳入 CR TODO backlog：
- **TODO-011**：Mapper 错误缺少统一仓储层错误类型（P3）— 已添加至 `cr-todo-backlog.md`

---

### 门禁验证总结

| 项目 | Round 3 修复后状态 |
|------|------------------|
| npm test | ✅ 200/200（较 Round 2 新增 2 个 F1b 测试） |
| npm run lint | ✅ |
| npm run build | ✅ |
| `relation_type` DB CHECK 约束 | ✅ 已补齐，与 TS 枚举对称 |
| Round 3 阻塞项 | ✅ 全部修复 |

**结论：Round 3 阻塞项已修复，建议进行 Round 4 终轮确认性复审。**
