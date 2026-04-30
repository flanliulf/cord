---
Story: 1-4
Round: 4
Date: 2026-04-30
Model Used: Claude Opus 4.7 (claude-opus-4.7)
Review Source: 1-4-code-review-summary-20260430-round-4.md
Review Model: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 1-4 的第 4 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查仅提出 1 项新发现（高），且 Round 3 的修复（`relation_type` DB CHECK 约束 + 写入期测试）经独立验证已在新建库上完全闭合。

**唯一的新发现 #1**（Round 3 的 `relation_type` 修复未覆盖已初始化的 v1 数据库）与 Round 2 的 #1 是**同一根因的重复提出**——已在 [cr-todo-backlog.md / TODO-007](_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md#L117) 中明确记录场景判定与处置时机。Round 2 评估结论「v0.1 pre-release 无任何在野老库 → 降级为 P2 / CR TODO」继续适用，本轮**不应再次以同一根因升格为阻塞项**。

**结论：建议本轮放行**。无 P0/P1 阻塞项；新发现 #1 视为 TODO-007 的范围扩展（相同处置约定），无需在 backlog 中再开新条目。

---

## 上轮问题回顾确认

### Round 3 / Finding #1（`relation_type` 缺 DB CHECK 约束）：✅ 已确认修复

经核实：
- [src/repositories/migrations/001-initial-schema.sql](src/repositories/migrations/001-initial-schema.sql) 与 [001-initial-schema.ts](src/repositories/migrations/001-initial-schema.ts) 已为 `relation_type` 增加 `CHECK (relation_type IN (...))` 9 值约束，与 `RELATION_TYPES` 常量对称。
- [tests/unit/repositories/sqlite-graph-repository.test.ts](tests/unit/repositories/sqlite-graph-repository.test.ts) 第 433-467 行新增写入期测试组「relation_type DB CHECK 约束（F1b）」，2 个用例直接绕过 TS 类型校验验证 DB 拒绝非法值/接受合法值。
- 三项门禁全绿：`npm test` 200/200、`npm run lint` ✅、`npm run build` ✅。

新建库路径上的修复完全到位，Round 3 修复未回退。

### Round 3 / Finding #2（mapper 错误缺统一类型）：✅ 已按 Round 3 评估处置

Round 3 评估已降级为 **P3 / CR TODO（TODO-011）**，本轮审查未产生新的升格证据，维持现状。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| TODO-007 | 旧库升级路径未走 002 增量迁移 | CR TODO / 非阻塞 | **同意维持**——Round 4 发现 #1 是同一根因的扩展，处置约定不变。 |
| TODO-008 | metadata 未校验对象形态 | CR TODO / 非阻塞 | 同意维持。 |
| TODO-009 | partial update 未过滤 undefined | CR TODO / 非阻塞 | 同意维持。 |
| TODO-010 | 迁移行为 AC 测试证据不足 | CR TODO / 非阻塞 | 同意维持。 |
| TODO-011 | mapper 错误缺统一仓储层错误类型 | CR TODO / 非阻塞 | 同意维持。 |

---

## 发现 #1 评估

### 审查原文

> **[高][新] Round 3 的 `relation_type` 修复未覆盖任何已初始化的 `v1` 数据库**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 与 TODO-007 同根因，维持 CR TODO 处置（P2 优先级）

### 评估分析

**问题描述准确性：技术准确，与 TODO-007 同根因**

技术层面完全属实：
- [src/repositories/migrations/runner.ts](src/repositories/migrations/runner.ts#L17-L20) 当前 `loadMigrations()` 仍只返回 `version: 1` 单条迁移。
- L70-78 `runMigrations` 通过 `applied.has(m.version)` 跳过已记录版本，对 Round 3 直接重写的 `001` 内容不会再次执行。
- Round 3 修复改写了 `001-initial-schema.sql/.ts` 但未新增 `002`，因此「已跑过旧 v1 的本地库」reopen 后仍保留无 `relation_type CHECK` 的旧 schema。

**但本质是 TODO-007 的范围扩展，不是新问题**：
- [cr-todo-backlog.md / TODO-007](_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md#L117-L130) 已明确记录：「Round 1 的 schema 修复（唯一索引加 source 维度、CHECK 约束）直接重写了 001-initial-schema，未新增 002 增量迁移……当前 v0.1 pre-release 无任何在野老库，场景不成立。」
- TODO-007 的修复时机约定为「首个稳定 release（或确认有用户已用 0.x schema）前，新增 002 增量迁移」。
- Round 3 的 `relation_type` CHECK 约束是同一类「直接重写 v1」的修复，**完全适用同一约定**——只是将 TODO-007 的覆盖面从「唯一索引 + 部分 CHECK」扩展到「唯一索引 + 全部 CHECK（含 relation_type）」。

**严重性判断：偏高，降级理由同 Round 2 #1**

「高」严重性不合理，理由与 Round 2 评估完全一致：
- v0.1 pre-release 阶段，仓库尚未发布任何版本，**无任何外部用户在野数据库**。
- 本地开发库可直接删库重建；CI 全部使用 `:memory:` 不存在历史负担。
- 增量迁移机制（002+）的真正价值在首个稳定 release 之后才开始体现。
- Round 4 复审重新以「高」严重性提出该问题，相当于撤销 Round 2 评估的场景判定结论，但**审查方未提供任何新证据证明在野老库存在**——既无新发布版本，也无用户报告。

**修复建议：可行但非必要（沿用 TODO-007 处置）**

建议的「新增 002 增量迁移 + 升级路径测试」是工程上正确的做法，但当前 sprint 没有真实迁移负担。处置方案沿用 TODO-007：
- **本轮无需变更**：Round 3 的修复方式（直接重写 v1）符合 TODO-007 中 pre-release 阶段的约定。
- **TODO-007 范围更新**：将「唯一索引含 source + 部分 CHECK 约束」扩展到「+ relation_type CHECK 约束」一并在首个稳定 release 前打包到 `002-fix-v1-baseline.sql`。
- 如确需安抚审查方，可在 Story 1-4 的 Tech Notes / Change Log 中显式声明「本 sprint 内对 v1 schema 的所有修订均采用直接重写而非增量迁移」。

**误报评估：非误报，但场景误判 + 重复提出**

- 代码事实正确（`runMigrations` 行为属实）。
- 场景适配性是评估分歧点，与 Round 2 #1 完全相同。
- 属于对历史 CR TODO 决议的重复提出，未提供新证据推翻原有降级结论。

---

## 整体评估结论

### 需要修复（阻塞交付）

无。

### 建议纳入 CR TODO 跟踪（非阻塞）

无新增 TODO 条目（发现 #1 为现有 **TODO-007** 的范围扩展，更新 TODO-007 的覆盖范围说明即可，无需新开条目）。

### 可忽略（误报）

无（发现 #1 不是误报，而是对已决策 TODO 的重复升格请求；通过维持 TODO-007 处置消化）。

### 评估决定

- **发现 #1（Round 3 修复未覆盖旧库）**：**降级处置，并入 TODO-007**——
  - 技术属实但 v0.1 pre-release 无在野老库，场景判定与 Round 2 #1 一致。
  - 不再升格为阻塞项；建议在 TODO-007 描述中追加一句「Round 3 的 `relation_type` CHECK 约束修复同样需要在 002 增量迁移中包含」，将 002 的修复范围明确为「唯一索引含 source + relations.source + relations.status + sync_states.status + relations.relation_type 五项 CHECK 约束 + 旧索引清理」。
  - 触发时机仍为「首个稳定 release（或确认有 0.x 在野数据库）前」。
- **本轮放行建议**：三项门禁全绿，Round 3 阻塞项已闭合，Round 4 唯一新发现属于已决策 CR TODO 的范围扩展。建议 **CR 通过**。

**给审查方的反馈**：若未来对 v0.1 pre-release 阶段的 schema 直接重写约定有异议，建议另开「schema 演进规范」专项 Story 系统讨论，不宜在每一轮 CR 中以同一根因反复升格为阻塞项，否则会形成无法收敛的 CR 循环。

---

## 修复执行记录

### 修复执行记录

- **Date**: 2026-04-30
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 0 项代码修复；1 项文档更新（TODO-007 覆盖范围扩展）

---

### 代码修复

本轮评估结论中**无阻塞修复项**，无代码变更。

### 文档更新：TODO-007 覆盖范围扩展

**操作文件**：`_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md`

**变更说明**：根据评估决定，将 Round 4 发现 #1（Round 3 的 `relation_type` CHECK 约束修复同样未覆盖旧库）并入 TODO-007，更新其问题描述以涵盖完整的 002 增量迁移修复范围：

- **002 需覆盖的完整修复范围**明确为：`DROP INDEX idx_relations_unique_pair / CREATE UNIQUE INDEX`（加 source 维度）+ `relations.source` CHECK + `relations.status` CHECK + `sync_states.status` CHECK + `relations.relation_type` CHECK（共 5 项约束 + 1 个索引重建）
- **文件名建议**从 `002-fix-unique-index-source.sql` 更新为 `002-fix-v1-baseline.sql`，体现全量修复语义
- 触发时机不变：首个稳定 release（或确认有 0.x 在野数据库）前

**结果**：✅ cr-todo-backlog.md TODO-007 已更新

---

### 门禁验证总结

本轮无代码修改，门禁状态延续 Round 3 修复后的结果：

| 项目 | 状态 |
|------|------|
| npm test | ✅ 200/200 |
| npm run lint | ✅ |
| npm run build | ✅ |
| 阻塞修复项 | 无 |

**结论：Round 4 CR 通过，Story 1-4 的代码审查工作流完整收尾。**
