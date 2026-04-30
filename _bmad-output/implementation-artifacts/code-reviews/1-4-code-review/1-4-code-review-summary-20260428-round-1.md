---
Story: 1-4
Round: 1
Date: 2026-04-28
Model Used: OpenCode ws/nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。`npm test` 与 `npm run build` 通过，但 `npm run lint` 失败；当前实现存在 2 个阻塞问题和 3 个非阻塞缺陷，结论为**不通过**。

## 新发现

### 1. [高] 关系唯一索引缺少 `source` 维度，和 manual 保护设计自相矛盾

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/repositories/migrations/001-initial-schema.sql:47-49` 将关系唯一性限定为 `(source_doc_id, target_doc_id, relation_type)`。
  - `src/repositories/interfaces.ts:92-96` 与 `src/repositories/sqlite-graph-repository.ts:187-214` 又显式保留了 `excludeSources` 能力，语义上要求同一对文档、同一关系类型的不同 `source` 记录可以并存。

- **影响**
  - 一旦已有 `auto_scan` 关系，再插入同一对节点、同一类型的 `manual` 关系会直接触发唯一约束失败。
  - 这会破坏后续 Story 依赖的“保留 manual、清理 auto_scan”机制，属于核心数据模型冲突。

- **建议**
  - 将唯一索引调整为包含 `source`，或重新收敛设计，把 `source` 改成单条关系的属性而不是并存记录。
  - 补充测试：验证 `manual` 和 `auto_scan` 两条同型关系的并存与定向删除行为。

### 2. [高] 构建产物未包含迁移 SQL，发布后仓储初始化会在运行时找不到文件

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/repositories/migrations/runner.ts:20-29` 运行时通过 `readFileSync(... '001-initial-schema.sql')` 从文件系统读取 SQL。
  - `tsup.config.ts:3-16` 未配置 `publicDir`、复制资源或其他静态文件打包策略。
  - 构建后检查 `dist/` 未发现任何 `.sql` 文件。

- **影响**
  - 源码目录下运行测试时一切正常，但用户通过 `dist` 包、CLI 安装包或发布产物运行时，首次初始化仓储会因找不到迁移脚本而失败。
  - 这是发布路径上的硬故障，直接影响 Story 的可交付性。

- **建议**
  - 在构建流程中复制 `src/repositories/migrations/*.sql` 到 `dist` 对应目录，或改成构建时内联 SQL 内容。
  - 增加针对 `dist` 运行态的冒烟测试，验证构建产物可实际执行迁移。

### 3. [中] `updateDocument` / `updateRelation` 允许传入不可变字段，返回值可能与数据库状态不一致

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/repositories/interfaces.ts:52,79` 将更新参数声明为 `Partial<DocumentNode>` / `Partial<RelationEdge>`。
  - `src/repositories/sqlite-graph-repository.ts:72-92` 与 `src/repositories/sqlite-graph-repository.ts:158-180` 会先把 `updates` merge 到返回对象中，但 SQL 实际并未更新 `created_at` 等不可变字段。

- **影响**
  - 调用方可以传入 `createdAt` 等字段，并收到“看似更新成功”的返回值；随后再次从数据库读取却发现值未变，造成内存态和持久态漂移。
  - 这会污染上层缓存、日志、测试断言以及后续依赖更新时间线的逻辑。

- **建议**
  - 将更新参数收窄为显式可更新字段，排除 `id`、`createdAt`、`updatedAt`。
  - 在仓储层丢弃不可变字段并补充测试，覆盖“传入 `createdAt` 不应生效且返回值也不应变化”的场景。

### 4. [中] Mapper 对枚举值和 JSON 元数据缺少运行时校验，单条脏数据就会破坏读取链路

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/repositories/mappers.ts:56-59`、`src/repositories/mappers.ts:106-109` 直接 `JSON.parse`，没有异常保护。
  - `src/repositories/mappers.ts:102-105`、`src/repositories/mappers.ts:151-152` 仅用 TypeScript 断言把数据库 `TEXT` 转成领域枚举，没有白名单校验。
  - `src/repositories/migrations/001-initial-schema.sql:33-37,57-58` 也未对这些列添加 `CHECK` 约束。

- **影响**
  - 任意一条非法 `metadata` 记录都可能让 `getDocumentById`、`getAllDocuments`、`getRelationById` 或 `getAllRelations` 直接抛错。
  - 枚举脏值会静默流入领域层，导致后续分支判断失真，排查成本高。

- **建议**
  - 在数据库层增加 `CHECK` 约束，在 Mapper 层增加显式校验与带上下文的错误信息。
  - 补充坏 JSON、非法枚举值的失败测试，确保故障以可诊断的方式暴露。

### 5. [低] 当前 Story 分支未通过 lint，测试文件存在未使用导入

- **来源**：auditor
- **分类**：patch

- **证据**
  - `npm run lint` 失败。
  - 报错位置：`tests/unit/repositories/sqlite-graph-repository.test.ts:3`，`IGraphRepository` 被导入但未使用。

- **影响**
  - 虽然不影响运行时行为，但当前提交无法通过静态检查门禁，影响交付完整性。

- **建议**
  - 删除未使用的 `IGraphRepository` 导入。
  - 将 lint 纳入该 Story 的回归检查，避免仅测试通过但质量门禁未通过。

## 验证摘要

- `npm test` ✅ 通过（190 / 190）
- `npm run lint` ❌ 失败
  - `tests/unit/repositories/sqlite-graph-repository.test.ts:3` 未使用导入 `IGraphRepository`
- `npm run build` ✅ 通过
- 定向复现 ✅ 已完成
  - 构建后检查 `dist/`，未发现迁移 `.sql` 文件，确认发布态存在运行时缺失风险。

## 通过项

- `src/repositories/interfaces.ts` 已覆盖文档、关系、同步状态、事务、统计与生命周期接口，AC 范围基本齐全。
- `tests/unit/repositories/sqlite-graph-repository.test.ts` 已覆盖 CRUD、级联删除、事务回滚与基础迁移路径，`npm test` 全量通过。
- `src/repositories/sqlite-graph-repository.ts` 在构造阶段启用了 `journal_mode = WAL` 与 `foreign_keys = ON`，基础初始化路径明确。
