---
Story: 1-3
Round: 2
Date: 2026-04-27
Model Used: Claude Opus 4.7 (GitHub Copilot)
Review Source: 1-3-code-review-summary-20260427-round-2.md
Review Model: GPT-5.4 (GitHub Copilot)
Type: Code Review Evaluation
---

## 评估总结

对 Story 1-3 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认上轮 2 个阻塞项（AC6 落地、lint）已闭合，但发现上轮 Finding #2（query-input 二选一契约）的修复在 mixed-empty 边界仍存在残留漏洞，提出 1 条新发现（中优先级 patch 项）。经独立代码验证并通过 `safeParse` 实测复现，该发现完全成立、无误报，确为 P1 阻塞项，必须修复后方可发起第 3 轮复审。

---

## 上轮问题回顾确认

### Round 1 / Finding #1（AC6 schema 入口未走 validateWithCordError）：✅ 已闭合

经验证：6 个 schema 文件（document/relation/config/scan-input/query-input/impact-input）均已导出 `validateXxx` 包装函数，统一通过 `validateWithCordError` 抛出 `ConfigError` 并携带对应错误码（`CORD_SCHEMA_001` ~ `CORD_SCHEMA_006`）。`helpers.ts:20-34` 的 `validateWithCordError` 签名已修正为 `ZodType<T, ZodTypeDef, unknown>`，兼容含 `default/transform` 的 schema。各 schema 测试中均补齐 `validateXxx — ConfigError 断言（AC6）` 测试组（`tests/unit/schemas/query-input.test.ts:45-63` 可见样例）。AC6 已落地。

### Round 1 / Finding #4（document.test.ts 3 处 lint 错误）：✅ 已闭合

经独立 lint 复核，`tests/unit/schemas/document.test.ts` 已改用显式对象字面量构造缺字段数据，无 `_` 未使用变量。本轮审查报告 `npm run lint` 零输出，结论与之一致。

### Round 1 / Finding #2（query-input 二选一契约）：⚠️ 部分闭合 — 残留 mixed-empty 漏洞

`queryInputSchema` 已添加 `.refine((d) => Boolean(d.docId) !== Boolean(d.path), ...)`，并补充了 neither / both / both-empty 三类非法用例测试。但由于 `docId/path` 仍是 `z.string().optional()`（不拒绝空字符串），且 refine 用 `Boolean()` 判定真伪，导致 `{ docId: '', path: 'docs/prd.md' }` 与 `{ docId: 'doc-001', path: '' }` 这两类 mixed-empty 输入仍被 `Boolean('') !== Boolean(...)` 视为「恰好一个」，从而通过验证。本轮 Finding #1 即针对该残留问题，详见下文。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#3 | document/relation 时间字段未约束 ISO 8601；document.path / scan.projectRoot 未约束相对/绝对路径 | CR TODO / 非阻塞 | 同意维持。本轮未对该类格式约束做收紧，与上轮评估「由后续 Story 按需收紧」一致。 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] query-input 修复后仍接受"一个有效值 + 一个空字符串"的双字段输入**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：完全准确**

经独立代码验证与运行时复现：
- `src/schemas/query-input.ts:9-22`：`docId: z.string().optional()`、`path: z.string().optional()`，refine 仅以 `Boolean(d.docId) !== Boolean(d.path)` 判定。由于 `Boolean('') === false`，空字符串被视作"未提供"，导致：
  - `{ docId: '', path: 'docs/prd.md' }`：`false !== true` → refine 通过 → safeParse 成功（实测 `success: true`）。
  - `{ docId: 'doc-001', path: '' }`：`true !== false` → refine 通过 → safeParse 成功（实测 `success: true`）。
  - `{ docId: '', path: '' }`：`false !== false` → refine 失败 → safeParse 拒绝（实测 `success: false`，符合预期）。
- `tests/unit/schemas/query-input.test.ts:25-43` 仅覆盖 neither / both / both-empty / 类型错误四类非法分支，**未覆盖** mixed-empty 的两个分支，回归测试存在缺口。

审查发现的运行时实测描述、文件:行号定位与测试缺口分析均与代码现状完全一致。

**严重性判断：合理（中等偏高，建议升至 P1 阻塞）**

虽然审查标记为「中」，但考虑到：
- 该问题属于上轮 Finding #2（已被评估为 P1 阻塞修复）的**直接残留**——契约修复未真正闭合，等同于 R1-#2 未完全修复。
- query-input 是统一验证层的对外契约边界，CLI / MCP / Service 三个下游消费方一旦把空字符串作为合法字段值传入，会出现"字段存在但值为空"的歧义状态，破坏 AC8 要求的输入路径覆盖。
- 来源标记为 `blind+edge+auditor` 三层同时命中，可信度极高。
- 修复成本极低（一行 schema 收紧 + 4 条回归测试），延迟收益小、复发风险大。

综合判断：评估优先级 P1（阻塞交付）。

**修复建议：可行**

审查给出的方案 `z.string().trim().min(1).optional()` 是 zod 标准用法，能从根本上让空字符串在 schema 层被拒绝，refine 无需调整即自动收敛。等价方案：
1. 抽取共享 schema：`const nonEmptyOptionalString = z.string().trim().min(1).optional()`，docId/path 同时复用。
2. 或保留现有结构，在 refine 中将判定改为 `(d.docId?.trim() ? 1 : 0) + (d.path?.trim() ? 1 : 0) === 1`；但 schema 层收紧更符合「契约前置失败」的设计原则，推荐方案 1。

回归测试需补 4 条：
- `queryInputSchema.parse({ docId: '', path: 'docs/prd.md' })` 抛错；
- `queryInputSchema.parse({ docId: 'doc-001', path: '' })` 抛错；
- `validateQueryInput({ docId: '', path: 'docs/prd.md' })` 抛 `ConfigError` 且 code 为 `CORD_SCHEMA_005`；
- `validateQueryInput({ docId: 'doc-001', path: '' })` 抛 `ConfigError` 且 code 为 `CORD_SCHEMA_005`。

**误报评估：非误报**

运行时复现与代码逐行复核均已确认问题真实存在。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | query-input mixed-empty 输入仍可穿过验证层 | [中] | **P1** | R1-#2 修复残留漏洞，必须真正闭合输入契约 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| — | （本轮无新增 TODO 项） | — | — | R1-#3 既有 TODO 维持非阻塞状态，不重复登记 |

### 评估决定

- **发现 #1（query-input mixed-empty 漏洞）**：确认修复。建议在 `src/schemas/query-input.ts` 将 `docId/path` 收紧为 `z.string().trim().min(1).optional()`（推荐抽取为共享 schema 复用），并在 `tests/unit/schemas/query-input.test.ts` 补齐 4 条 mixed-empty 回归测试（含 `validateQueryInput` 的 `ConfigError` + 错误码断言）。修复后重跑 `npm test` / `npm run lint` / `npm run build`，再发起第 3 轮复审。
- **R1-#3（路径 / ISO 8601 约束）**：维持 CR TODO 状态，本轮不阻塞。
- **整体结论**：与本轮审查结论一致，**不通过**。仅需修复 1 项 P1，预计修复成本低（< 30 分钟）。

✅ CR 代码审查结果评估完成（第 2 轮），结果已保存

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-28
- **Model Used**: Claude Sonnet 4.6 (GitHub Copilot)
- **Fix Items**: 1

---

#### F1 — 修复 query-input mixed-empty 漏洞（R2 Finding #1）

**问题**：`queryInputSchema` 中 `docId` 和 `path` 为 `z.string().optional()`，空字符串 `''` 经 `Boolean()` 判定为 `false`（等同于"未提供"），导致 `{ docId: '', path: 'docs/prd.md' }` 和 `{ docId: 'doc-001', path: '' }` 两类 mixed-empty 输入绕过 refine 约束通过验证。

**修复方案**：
1. 在 `src/schemas/query-input.ts` 抽取共享 schema：
   ```ts
   const nonEmptyOptionalString = z.string().trim().min(1).optional();
   ```
   将 `docId` 和 `path` 改用 `nonEmptyOptionalString`，从 schema 层拒绝空字符串，无需修改 refine 逻辑。

2. 在 `tests/unit/schemas/query-input.test.ts` 补齐 4 条 mixed-empty 回归测试：
   - `invalid inputs` 组：新增 2 条（empty docId + valid path、valid docId + empty path）
   - `validateQueryInput — ConfigError 断言（AC6）` 组：新增 2 条对应 ConfigError 断言

**修改文件**：
- `src/schemas/query-input.ts`（`docId`/`path` 字段定义 + 抽取 `nonEmptyOptionalString`）
- `tests/unit/schemas/query-input.test.ts`（新增 4 条测试）

**修复验证**：

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| query-input 测试数 | 10 | 14 |
| 全量测试数 | 130 | 134 |
| 全量测试通过 | 130 | 134 |
| TSC 类型错误 | 0 | 0 |
| Lint 错误 | 0 | 0 |
| mixed-empty 漏洞 | ❌ 存在 | ✅ 已闭合 |
