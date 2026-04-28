---
Story: 1-3
Round: 1
Date: 2026-04-27
Model Used: nx-claude-opus-4-7 (ws/nx-claude-opus-4-7)
Review Source: 1-3-code-review-summary-20260427-round-1.md
Review Model: GPT-5.4 (GitHub Copilot)
Type: Code Review Evaluation
---

## 评估总结

对 Story 1-3 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查共提出 4 条发现：1 条高优先级（AC6 未落地）、3 条中优先级（输入契约缺失、类型注释承诺未兑现、lint 失败）。经独立代码验证，全部 4 条发现均成立、无误报，其中 2 条（#1 AC6、#4 lint 失败）确为阻塞项，必须修复；2 条（#2、#3）属契约/质量改进，建议同步修复以避免下游 Story 复用脏 schema。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] Schema 入口仍直接抛出原生 ZodError，AC6 未落地**
> - 来源：auditor+blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：
- `src/schemas/document.ts:8-18`、`src/schemas/relation.ts:15-26`、`src/schemas/config.ts:17` 均直接 `export const xxxSchema = z.object(...)`，未提供任何包装入口。
- `src/schemas/helpers.ts:20-34` 已实现 `validateWithCordError`，但通过 `grep` 全仓搜索：除 `src/schemas/helpers.ts`（定义处）和 `tests/unit/schemas/helpers.test.ts`（自身单测）外，`src/` 下其他模块均未调用该函数。
- 这意味着任何调用方使用 `documentSchema.parse(...)` 时，失败均抛出原生 `ZodError`，与 AC6「抛出 CordError 子类（ConfigError 或对应子类）」直接冲突。

**严重性判断：合理**

AC6 是 Story 1-3 的明确验收条件，未落地即为 Story 未完成。审查标记为「高」并归类为阻塞项是合理的。同时来源 `auditor+blind` 双层命中，可信度高。

**修复建议：可行**

两种修复路径都可行：
1. 推荐方案：为每个 schema 同时导出 `validateXxx` 包装函数（基于 `validateWithCordError`），调用方使用包装函数而非裸 schema.parse。
2. 备选方案：直接重写每个 schema 文件，导出已封装的 parse/safeParse 入口对象。

测试同步要求合理：tests 中目前用 `toThrow()` 泛化断言（如 `document.test.ts:38` 等），无法验证错误类型，应改为断言 `ConfigError` 实例与具体错误码。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中] queryInputSchema 没有落实「docId/path 二选一」契约**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：
- `src/schemas/query-input.ts:8-17` 中 `docId` 和 `path` 均为 `z.string().optional()`，且 schema 顶层无 `.refine()` / `.superRefine()` 约束。
- 注释 `src/schemas/query-input.ts:9, 12` 明确标注「与 `path` 二选一」「与 `docId` 二选一」，但代码未实现该契约。
- `tests/unit/schemas/query-input.test.ts:20-26` 将「同时提供 docId 和 path」固定为合法用例，进一步把错误契约固化到回归测试中。

**严重性判断：合理（中等偏高）**

虽然审查标记为「中」，但考虑到：
- query-input 是统一验证层的对外契约边界，契约错误会传播到 CLI、MCP、Service。
- 测试层错误固化使后续修复成本上升。
- 严重性维持「中」、评估优先级 P1（阻塞交付）较为合适，因为下游 Story 一旦基于错误契约消费，回滚成本更高。

**修复建议：可行**

`.refine((d) => Boolean(d.docId) !== Boolean(d.path), { message: 'docId 与 path 必须恰好提供一个' })` 是 zod 的标准用法，成本极低。回归测试需相应修订（neither/both/empty-string 三类）。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中] 多个 schema 未实现类型注释承诺的路径与时间约束**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：
- `src/schemas/document.ts:16-17`：`createdAt`/`updatedAt` 仅 `z.string().min(1)`，未使用 `z.string().datetime()`，但 Story Dev Notes 第 80-81 行注释明确要求 `// ISO 8601`。
- `src/schemas/document.ts:10`：`path` 仅 `z.string().min(1)`，DocumentNode 接口注释（Story 第 74 行）明确「相对于项目根目录的路径」，未实现相对路径约束。
- `src/schemas/scan-input.ts:10`：`projectRoot` 仅 `min(1)`，注释（第 9 行）「绝对路径」承诺未落实。
- `src/schemas/relation.ts:24-25`：同样的 ISO 8601 缺失问题。

**严重性判断：合理偏低**

虽然审查标记为「中」，但考虑到：
- 这些约束**未在 AC1-8 中明示**（仅在 Dev Notes 类型注释中），不构成 AC 违规。
- Story 1-3 是基础类型与 schema 定义层，下游 Story（扫描、查询、缓存）实际消费时若对路径/时间格式有更严要求，可在该层叠加 `.refine`，本层不实现不会立即破坏下游。
- 但「主键语义」「排序/比较稳定性」的风险成立，长期不修会埋雷。

综合判断：降级为 P2，纳入 CR TODO 跟踪，由后续相关 Story（1-4 扫描器、查询模块）按需收紧。

**修复建议：可行但非必要（本轮）**

`z.string().datetime()`、自定义 `relativePathSchema`、`absolutePathSchema` 都可行，但本轮已有 2 个阻塞项需修复，建议本轮不强制处理，TODO 跟踪。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[中] Story 自述「ESLint 无错误」与实际 lint 结果不符**
> - 来源：manual
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：完全准确**

独立执行 `npm run lint` 复现：
```
tests/unit/schemas/document.test.ts
  46:19  error  '_' is assigned a value but never used  @typescript-eslint/no-unused-vars
  51:26  error  '_' is assigned a value but never used  @typescript-eslint/no-unused-vars
  56:26  error  '_' is assigned a value but never used  @typescript-eslint/no-unused-vars
✖ 3 problems (3 errors, 0 warnings)
```
位置和数量与审查报告完全一致。

**严重性判断：合理（实际可视为高）**

虽然审查标记为「中」，但 lint 失败属于**质量门禁阻塞项**——按项目惯例，质量门禁失败即阻塞合入。同时 Story 自述与实际不符也违反「文档真实性」原则。建议评估优先级 P1（阻塞交付）。

**修复建议：可行**

修复方案极简，三种均可：
1. 改用 `Reflect.deleteProperty` 或显式构造缺字段对象。
2. 在 ESLint 配置中放行 `argsIgnorePattern: '^_'` + `varsIgnorePattern: '^_'`（项目已有该约定时直接生效）。
3. 改写为 `const { id, ...rest } = validDoc; void id;`。

修复后需同步更新 Story 完成记录中的「lint 通过」声明。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Schema 入口未通过 validateWithCordError 落地 AC6 | [高] | **P1** | AC6 直接违规，必须修复 |
| 2 | queryInputSchema 缺失 docId/path 二选一 refine | [中] | **P1** | 输入契约错误已固化到测试，回滚成本随时间上升 |
| 4 | tests/unit/schemas/document.test.ts 3 处 lint 错误 | [中] | **P1** | 质量门禁阻塞，且 Story 自述不实 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 3 | document/relation 未约束 ISO 8601；document.path/scan.projectRoot 未约束相对/绝对路径 | [中] | **P2** | 非 AC 项，可在下游消费 Story 中按需收紧 |

### 评估决定

- **发现 #1（AC6 未落地）**：确认修复。需在所有 6 个 schema（document/relation/config/scan-input/query-input/impact-input）建立统一 CordError 入口，并把现有 `toThrow()` 测试改为断言具体子类与错误码。
- **发现 #2（query-input 二选一契约）**：确认修复。在 `queryInputSchema` 顶层添加 `.refine`，同步修订 `tests/unit/schemas/query-input.test.ts:20-26` 的合法用例为非法用例，并补 neither/both/empty-string 三类回归测试。
- **发现 #3（路径与时间约束）**：纳入 CR TODO，由后续 Story（推测为 1-4 扫描器、查询模块）按实际消费需求收紧；本轮不阻塞修复。
- **发现 #4（lint 错误）**：确认修复。修复 3 处 `_` 未使用错误后重跑 lint 并更新 Story 完成记录中相关声明。

✅ CR 代码审查结果评估完成（第 1 轮），结果已保存

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-27
- **Model Used**: Claude Sonnet 4.6 (GitHub Copilot)
- **Fix Items**: 3

---

#### F4 — 修复 lint 错误（`tests/unit/schemas/document.test.ts`）

**问题**：3 处解构赋值使用 `_` 变量名占位（`id: _`、`createdAt: _`、`updatedAt: _`），触发 `@typescript-eslint/no-unused-vars`。

**修复方案**：改用显式对象字面量构造缺字段数据，不再依赖解构赋值。

**修改文件**：
- `tests/unit/schemas/document.test.ts`（第 46、51、56 行）

**修复结果**：✅ `npx eslint tests/unit/schemas/document.test.ts` 零报错。

---

#### F1 — AC6 落地：为 6 个 schema 添加 `validateXxx` 包装函数

**问题**：6 个 schema 均直接导出裸 `xxxSchema.parse()`，验证失败抛出原生 `ZodError`，违反 AC6（应抛 `ConfigError`）。

**修复方案**：
1. 在每个 schema 文件顶部导入 `validateWithCordError`。
2. 为每个 schema 导出对应的包装函数，统一错误码：
   - `validateDocument` → `CORD_SCHEMA_001`
   - `validateRelation` → `CORD_SCHEMA_002`
   - `validateConfig` → `CORD_SCHEMA_003`
   - `validateScanInput` → `CORD_SCHEMA_004`
   - `validateQueryInput` → `CORD_SCHEMA_005`
   - `validateImpactInput` → `CORD_SCHEMA_006`
3. 将 `helpers.ts` 的 `validateWithCordError` 签名从 `ZodSchema<T>` 改为 `ZodType<T, ZodTypeDef, unknown>`，以兼容含 `.default()` / `.transform()` 的 schema（修复 4 个 TSC 类型错误）。

**修改文件**：
- `src/schemas/document.ts`
- `src/schemas/relation.ts`
- `src/schemas/config.ts`
- `src/schemas/scan-input.ts`
- `src/schemas/query-input.ts`
- `src/schemas/impact-input.ts`
- `src/schemas/helpers.ts`（类型签名修正）

**测试同步**：在 6 个测试文件中各新增 `validateXxx — ConfigError 断言（AC6）` 测试组，验证：
- `toThrow(ConfigError)` 实例类型断言
- `(err as ConfigError).code` 精确匹配错误码

**修复结果**：✅ TSC 零错误，所有 130 条测试通过。

---

#### F2 — `queryInputSchema` 添加 docId/path 二选一契约

**问题**：`queryInputSchema` 中 `docId` 和 `path` 均为可选字段，未实现注释承诺的「二选一」约束，错误契约已固化到测试中。

**修复方案**：
1. 在 `queryInputSchema` 顶层添加 `.refine((d) => Boolean(d.docId) !== Boolean(d.path), { message: 'docId 与 path 必须恰好提供一个' })`。
2. 删除原 "accepts empty object with defaults" 合法用例测试（neither 场景变为非法）。
3. 删除原 "accepts both docId and path" 合法用例测试（both 场景变为非法）。
4. 新增 `invalid inputs` 测试：`neither`、`both`、`empty-string both`。
5. 新增 `validateQueryInput — ConfigError 断言` 测试组（neither/both 两类 + 错误码验证）。

**修改文件**：
- `src/schemas/query-input.ts`（添加 `.refine()`）
- `tests/unit/schemas/query-input.test.ts`（契约修订 + 新增测试）

**修复结果**：✅ query-input 测试从 5 条增至 10 条，全部通过。

---

#### 修复验证汇总

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| TSC 类型错误 | 4 | 0 |
| Lint 错误 | 3 | 0 |
| 测试总数 | 114 | 130 |
| 测试通过 | 114 | 130 |
| AC6 覆盖 | ❌ | ✅ |
| docId/path 契约 | ❌ | ✅ |
