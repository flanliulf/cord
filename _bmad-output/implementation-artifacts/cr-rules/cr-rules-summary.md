# CR Rules Summary

用于沉淀跨 Story 可复用的 CR 规则提炼结果，记录规则来源、适用范围、落地位置与同步状态。

---

## Story 4-1 / 2026-05-15

- **Story**: 4-1
- **分析来源**:
  - `4-1-code-review-summary-20260514-round-1.md`
  - `4-1-code-review-evaluation-20260515-round-1.md`
  - `4-1-code-review-summary-20260515-round-2.md`
  - `4-1-code-review-evaluation-20260515-round-2.md`
  - `4-1-code-review-summary-20260515-round-3.md`
  - `4-1-code-review-evaluation-20260515-round-3.md`
- **结论概览**:
  - Round 1 发现 1 条正式 patch：测试桩时间戳在第 10 条关系后会生成无效 ISO 字符串。
  - Round 2 保留 1 条非阻塞 TODO：迁移 002 的 status 索引创建可进一步加固。
  - Round 3 确认两项问题均已修复，无剩余阻塞项或 CR TODO。

### 提炼规则

#### 1. CR-REPO-06：迁移子步骤必须独立幂等，并覆盖部分迁移数据库场景

- **来源问题**: migration 002 在检测到 `status` 列已存在时直接返回，导致“列已存在但索引缺失”的部分迁移数据库无法补建 `idx_relations_status`。
- **适用范围**: Repository migration、schema 演进、启动自愈逻辑。
- **规避指南**:
  - 禁止将“列已存在”作为整条 migration 的提前返回条件。
  - 列新增、索引创建、数据回填等子步骤必须分别设计幂等保护。
- **最佳实践**:
  - 将可独立执行的 schema 子步骤拆成单独 SQL 常量或单独检查分支。
  - 除标准旧库升级测试外，必须补“部分迁移数据库”回归测试，例如列已存在但索引缺失。
- **本次落地**:
  - `src/repositories/migrations/002-add-relation-status.ts`
  - `tests/unit/repositories/sqlite-graph-repository.test.ts`
- **已同步全局文档**:
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`

#### 2. CR-TEST-01：测试 helper 的时间/序列数据必须用数值偏移生成，并覆盖跨位数边界

- **来源问题**: `InMemoryRelationRepository.addRelation()` 通过字符串拼接构造 ISO 时间戳，在第 10 条关系时生成非法字符串 `2026-05-14T00:00:010.000Z`。
- **适用范围**: fixture factory、in-memory repository、fake clock、递增 ID / 时间戳 helper。
- **规避指南**:
  - 禁止通过字符串拼接生成依赖位数变化的日期、编号或序列值。
  - 只要 helper 依赖计数器增长，就必须覆盖跨位数边界回归。
- **最佳实践**:
  - 使用固定基准值加数值偏移生成时间戳、ID 或序列。
  - 至少覆盖一条 9→10 或 99→100 的边界测试，防止测试基础设施在业务断言前失效。
- **本次落地**:
  - `tests/unit/services/relation-service.test.ts`
- **已同步全局文档**:
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`

### 治理结论

- 本次提炼出的两条规则均已升格为全局规则，并完成 Rule Document Registry 要求的三份镜像文档同步。
- 本次无新增 backlog 项；相关问题已在 Story 4-1 CR 流程中完成修复并关闭。
- 后续若有新 Story 出现同类问题，应直接引用 `CR-REPO-06` 与 `CR-TEST-01`，避免重复讨论同一根因。
