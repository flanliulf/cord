---
Story: 1-3
Round: 2
Date: 2026-04-27
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

本轮为复审。上轮确认的 AC6 落地问题和 lint 阻塞项已修复，测试/lint/build 当前均通过；但 query-input 的契约修复仍有一个残留边界，导致无效输入还能穿过验证层。本轮未发现新的高优先级问题，但仍存在 1 个中优先级 patch 项，暂不建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — Schema 入口未通过 validateWithCordError 落地 AC6
   - 6 个 schema 已新增 validateXxx 包装函数，helpers.ts 也改为兼容带 default/transform 的 ZodType<T, ZodTypeDef, unknown>。
   - 验证结果：AC6 相关断言已补到各 schema 测试中，当前总测试数为 130，全部通过。

2. Round 1 / Finding #4 — tests/unit/schemas/document.test.ts 3 处 lint 错误
   - 缺字段测试数据已改成显式对象构造，不再使用未使用的 _ 绑定。
   - 验证结果：ESLint 复核通过，未再出现 document.test.ts 的 no-unused-vars 错误。

### 仍为非阻塞待办

1. Round 1 / Finding #3 — document/relation 时间字段 ISO 8601 约束，以及 document.path / scan.projectRoot 的路径约束
   - 维持既有评估结论：CR TODO / 非阻塞。
   - 本轮未对这类格式约束做进一步收紧。

## 新发现

### 1. [中][新] query-input 修复后仍接受“一个有效值 + 一个空字符串”的双字段输入

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - src/schemas/query-input.ts:12-21 里，docId 和 path 仍然是 z.string().optional()，顶层 refine 只比较 Boolean(d.docId) 与 Boolean(d.path)。
  - 纯 Zod 定向复现显示 `{ docId: '', path: 'docs/prd.md' }` 与 `{ docId: 'doc-001', path: '' }` 都会返回 success: true。
  - tests/unit/schemas/query-input.test.ts:22-39 仅覆盖 neither、both、both-empty 和 includeRelations 类型错误，未覆盖上述 mixed-empty 两个分支。

- **影响**
  - 上轮 Finding #2 的 query-input 契约修复并未完全闭合，仍有无效输入会绕过验证层。
  - AC8 要求的“有效/无效输入路径覆盖”对 query-input 仍不完整，后续 CLI/MCP/Service 若把空字符串视为真实字段值，可能出现分支歧义。

- **建议**
  - 将 docId/path 收紧为共享的非空字符串 schema，例如 z.string().trim().min(1).optional()。
  - 补 4 条回归测试：`{ docId: '', path: 'docs/prd.md' }`、`{ docId: 'doc-001', path: '' }`，以及对应的 validateQueryInput ConfigError 断言。

## 验证摘要

- `npm test` ✅（130 / 130）
- `npm run lint` ✅（等价复核 `npx eslint . --no-color` 零输出）
- `npm run build` ✅
- 额外复核：
  - `queryInputSchema` 的 mixed-empty 样本 `{ docId: '', path: 'docs/prd.md' }` 与 `{ docId: 'doc-001', path: '' }` 复现为 success: true。
  - AC6 包装入口已存在：`validateDocument`、`validateRelation`、`validateConfig`、`validateScanInput`、`validateQueryInput`、`validateImpactInput` 均已导出。

## 通过项

- 上轮 AC6 阻塞项已关闭：6 个 schema 现已提供统一的 validateXxx 包装入口，并配套 ConfigError 错误码断言测试。
- 上轮 lint 阻塞项已关闭：document.test.ts 的未使用变量问题消失，整体 lint 复核通过。
- 修复后没有引入构建或测试回归：130 条测试全部通过，打包构建成功。
- 上轮评估中降级为 TODO 的路径/时间格式约束仍保持非阻塞状态，没有被误升级为本轮阻塞项。

## 结论

- **结论：不通过**
- **阻塞项**：query-input 的 mixed-empty 双字段输入仍会穿过验证层，导致上轮 Finding #2 未完全关闭。
- **建议**：先补齐 docId/path 的非空字符串约束与对应回归测试，再发起第 3 轮复审。
