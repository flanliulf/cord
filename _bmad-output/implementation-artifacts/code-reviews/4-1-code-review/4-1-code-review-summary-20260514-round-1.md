---
Story: 4-1
Round: 1
Date: 2026-05-14
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成，子审查层因工具限制未能自行写入临时文件，主审已根据其返回内容代写临时审查输出并完成去重分类。`npm test`、`npm run type-check`、`npm run lint`、`npm run build` 均通过。未发现阻塞问题，建议通过；仅保留 1 个低优先级 patch 建议。

## 新发现

### 1. [低] 测试桩时间戳在第 10 条关系后会生成无效 ISO 字符串

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `tests/unit/services/relation-service.test.ts:57` 使用 ``new Date(`2026-05-14T00:00:0${this.nextRelationId}.000Z`).toISOString()`` 构造测试关系时间戳。
  - 当同一测试通过 `InMemoryRelationRepository.addRelation()` 添加第 10 条及之后的关系时，字符串会变成类似 `2026-05-14T00:00:010.000Z`，这是无效 ISO 时间，`toISOString()` 会抛出 `RangeError: Invalid time value`。

- **影响**
  - 当前测试集未触发该边界，但该 helper 后续一旦用于批量添加关系的单测，会在业务断言前失败，掩盖真正的 RelationService 行为。

- **建议**
  - 改为固定基准时间加毫秒偏移，或对秒字段使用 `String(this.nextRelationId).padStart(2, '0')` 并限制合法秒值。
  - 补一个同一 repository 添加 10 条以上关系的单测，锁住测试桩行为。

## 验证摘要

- `npm test` ✅ 通过（367 / 367，40 个 test files 全部通过）
- `npm run type-check` ✅ 通过（`tsc --noEmit` 无错误）
- `npm run lint` ✅ 通过（ESLint 无错误输出）
- `npm run build` ✅ 通过（tsup ESM 与 DTS 输出成功）
- 定向复现 ✅ 代码审查确认：AC1-AC8 均有实现/测试证据；未发现 AC 偏离。

## 通过项

- RelationService 覆盖 `addRelation`、`removeRelation`、`deprecateRelation` 三条核心路径，手动添加固定写入 `source='manual'` 与 `status='active'`。
- deprecated 语义使用独立 `status` 字段，保留原 `relationType`，并在 deprecate 路径追加 `metadata.history`。
- remove 路径符合 Story 裁决：硬删除、不保留历史记录。
- 添加关系前校验源/目标文档存在，重复关系检测按 source+target+type 且不受 status/source 影响，符合 Story Dev Notes。
- QueryService 与 ImpactService 的 read-side 默认过滤 `status='deprecated'`，避免 deprecated 关系继续参与默认查询/影响传播。
- 旧库迁移回归测试覆盖 status 列补齐、存量关系回填 active、迁移版本推进到 2。
- 非阻塞加固项：`src/repositories/migrations/002-add-relation-status.ts:20-22` 在 status 列已存在时会跳过 `idx_relations_status` 的幂等创建。标准新库和旧库升级路径已覆盖；若未来要支持手工修复/部分迁移数据库，建议将索引创建拆成无条件 `CREATE INDEX IF NOT EXISTS`。
