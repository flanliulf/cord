---
Story: 1-3
Round: 1
Date: 2026-04-27
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。测试与构建通过，但 lint 失败；同时 AC6 要求的 CordError 包装没有在 schema 入口真正落地。当前存在 2 个阻塞项（AC6 未满足、质量门禁未通过）和 2 个中优先级输入契约问题，不建议通过本轮审查。

## 新发现

### 1. [高] Schema 入口仍直接抛出原生 ZodError，AC6 未落地

- **来源**：auditor+blind
- **分类**：patch

- **证据**
  - src/schemas/document.ts:7-16、src/schemas/relation.ts:13-25、src/schemas/config.ts:16-37 当前都直接导出 z.object(...) schema。
  - src/schemas/helpers.ts:19-31 虽然提供了 validateWithCordError，但仓库内没有任何 schema 入口调用它。
  - 定向复现：对 documentSchema.parse(...) 传入无效输入时，命令输出为 ZodError / ZodError / has-issues，而不是 CordError 子类。

- **影响**
  - 直接违反 AC6，当前验证失败不会返回 Story 要求的统一错误体系。
  - CLI、MCP、Service 后续若直接复用这些 schema，错误码、suggestion、context 等结构化信息都会丢失。

- **建议**
  - 明确统一对外验证入口：要么导出 validateXxx 包装函数，要么统一封装 parse/safeParse 到 CordError 子类。
  - 所有无效输入测试改为断言具体 CordError 子类与错误码，而不是泛化的 toThrow()。

### 2. [中] queryInputSchema 没有落实“docId/path 二选一”契约

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - src/schemas/query-input.ts:7-16 中 docId 与 path 都是裸 optional string，没有 refine 约束“恰好提供一个”。
  - tests/unit/schemas/query-input.test.ts:20-26 还把“同时提供 docId 和 path”固定为合法输入。
  - 定向复现：queryInputSchema.parse({}) 与 queryInputSchema.parse({ docId: 'doc-1', path: 'docs/a.md' }) 都会成功通过。

- **影响**
  - 调用方无法知道应按 docId 还是 path 解析查询，空对象也会把错误延后到业务层。
  - 这会削弱“统一验证层”的边界，把输入契约判断继续下放给调用方。

- **建议**
  - 对 docId/path 增加“恰好一个非空值”的 refine。
  - 同时把两个字段改为 min(1) 或 trim().min(1)，补充 neither/both/empty-string 三类回归测试。

### 3. [中] 多个 schema 未实现类型注释承诺的路径与时间约束

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - src/schemas/document.ts:8-16、src/schemas/relation.ts:14-25 只把 createdAt/updatedAt 校验为非空字符串，未校验 ISO 8601。
  - src/schemas/document.ts:9 允许绝对路径；src/schemas/scan-input.ts:8-15 也未落实“projectRoot 必须是绝对路径”的注释约束。
  - 定向复现：documentSchema 接受 /tmp/a.md 与非 ISO 时间戳；scanInputSchema 接受 relative/project。

- **影响**
  - 非法路径会破坏“相对项目根目录”这一主键语义，导致查询、缓存和持久化键值不一致。
  - 非 ISO 时间戳会让排序、比较和增量扫描判断建立在脏数据之上。

- **建议**
  - 对时间字段使用 z.string().datetime() 或等价 ISO 校验。
  - 对 document path 与 query path 增加相对路径约束，对 projectRoot 增加绝对路径约束，并补回归测试。

### 4. [中] Story 自述“ESLint 无错误”与实际 lint 结果不符

- **来源**：manual
- **分类**：patch

- **证据**
  - npm run lint 实际失败。
  - tests/unit/schemas/document.test.ts:46、51、56 中 const { field: _, ...rest } = validDoc 触发 @typescript-eslint/no-unused-vars，共 3 处错误。

- **影响**
  - 当前变更不能通过项目质量门禁，Story 的完成记录与实际状态不一致。
  - 后续 CR/合并若仅依赖 Story 记录，会误判该 Story 已具备可合并条件。

- **建议**
  - 改写这 3 处测试数据构造，避免未使用绑定。
  - 修复后重新执行 lint，并同步更新 Story 中的验证结论。

## 验证摘要

- npm test ✅（114 / 114）
- npm run lint ❌（3 errors，均位于 tests/unit/schemas/document.test.ts）
- npm run build ✅
- 定向复现 ❌
  - documentSchema.parse(...) 失败时抛出 ZodError，而非 CordError 子类。
  - queryInputSchema 对 {} 和同时提供 docId/path 的输入都会放行。
  - documentSchema 接受绝对路径与非 ISO 时间戳，scanInputSchema 接受相对 projectRoot。

## 通过项

- src/types/relations.ts、src/types/documents.ts、src/types/graph.ts、src/types/config.ts 已按 Story 范围补齐核心类型并通过门面导出。
- src/schemas/ 下 6 个目标 schema 与 json-schema 导出工具均已建立，zod-to-json-schema 的基础转换路径可运行。
- 单元测试覆盖面已经达到 Story 目标范围的大部分 happy path/invalid path，只是其中部分断言与 Story 契约仍有偏差。
