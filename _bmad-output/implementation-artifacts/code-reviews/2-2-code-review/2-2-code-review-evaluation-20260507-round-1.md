---
Story: 2-2
Round: 1
Date: 2026-05-07
Model Used: GitHub Copilot (model not exposed)
Review Source: 2-2-code-review-summary-20260507-round-1.md
Review Model: GitHub Copilot (model not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-2 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 2 条新发现：1 条涉及 AC8/NFR16 的扫描跳过契约缺口，1 条涉及 Markdown 链接 URI scheme 过滤边界。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] ScanPipeline.process 未调用预检，非 Markdown 与超大文件不会被管道跳过**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证，`precheckScannableFile(filePath, fileSizeBytes)` 已在 `src/scanner/pipeline.ts:26` 定义，并包含非 `.md` 与 `> 1MB` 两类跳过判断；但 `ScanPipeline.process()` 在 `src/scanner/pipeline.ts:79-81` 直接进入 `readFileOrThrow(filePath)` 和 `decodeUtf8OrSkip(filePath, rawFile)`，没有调用预检，也没有在读取前获取文件大小。`precheckScannableFile` 在 `src/**` 中除定义外没有被任何生产代码调用。测试层面，`tests/unit/scanner/pipeline.test.ts:132-139` 只覆盖 helper 返回 warning，未覆盖 `process()` 对非 Markdown 或超大文件的跳过行为；编码错误路径则由 `tests/unit/scanner/pipeline.test.ts:68` 起的用例覆盖。

Story AC8 明确要求异常文档扫描时跳过并记录 WARNING，范围包含编码错误、非 Markdown、超大 `> 1MB`。当前 Story 2.2 已交付的可执行扫描入口是 `ScanPipeline.process()`，但该入口只实际处理编码错误跳过。虽然 Story 文档中写了“预检前移方案”，当前代码库没有可验证的调用方集成，因此不能用未实现的调用方承担 AC8。

**严重性判断：合理**

原始严重性为高是合理的。该问题直接影响 AC8 与 NFR16，属于验收标准未完整落地；同时超大文件在读取前没有限制，会削弱资源防护意图。建议评估为 P1 阻塞交付。

**修复建议：可行**

审查建议可行。更稳妥的修复方式是在 `process()` 读取前使用文件元信息进行大小预检，并在扩展名或大小命中跳过条件时记录 warning 后返回 `null`；或者补齐明确调用方集成并提供测试证据。但在 Story 2.2 当前边界内，直接让 `ScanPipeline.process()` 自身满足跳过契约更容易验证。

**误报评估：非误报**

非误报。三层来源同时命中，且代码证据与测试缺口一致。

---

## 发现 #2 评估

### 审查原文

> **[低] Markdown 链接规则仅过滤 http/https，其他 URI scheme 仍进入路径解析**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

经代码验证，`sanitizeReference` 在 `src/scanner/rules/markdown-link-rule.ts:100` 定义，当前只在 `src/scanner/rules/markdown-link-rule.ts:107` 过滤 `http://` 与 `https://`，之后继续在 `src/scanner/rules/markdown-link-rule.ts:111` 进入 fragment/query 剥离流程。`tests/unit/scanner/rules.test.ts:137` 确实包含 `mailto:test@example.com`，但该用例只证明当前 fixture 下未产生额外关系，没有明确断言所有非文件 URI scheme 都被语义化跳过。

问题边界需要轻微收窄：当前实现通常不会把 `mailto:`、`tel:`、`file:` 自动解析成现有 Markdown 文档，只有在候选路径与带 scheme 的字符串形成唯一后缀匹配时才可能产生噪声。因此它更像规则边界不严和未来噪声风险，而不是当前确定可复现的主流程缺陷。

**严重性判断：合理但非阻塞**

原始严重性为低是合理的。该问题不直接阻塞 AC4/AC6/AC7，也不影响本轮发现 #1 那样的验收门禁；但“跳过外部链接”的边界更清晰后，规则更稳健。建议评估为 P2，纳入 CR TODO 或后续小补丁。

**修复建议：可行但非必要**

审查建议可行。可以在 `sanitizeReference` 中增加通用 URI scheme 判断，保留相对路径、根路径与合法 Markdown 文档目标；同时补充 `mailto:`、`tel:`、`file:` 等不生成关系的定向测试。考虑当前影响较低，可不作为交付阻塞项。

**误报评估：非误报**

非误报。过滤边界确实存在，但影响面低于阻塞级别。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `ScanPipeline.process` 未接入非 Markdown/超大文件预检 | [高] | **P1** | AC8/NFR16 未能通过当前扫描入口完整验证，需修复后再通过 Story。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | Markdown 链接规则未通用过滤非文件 URI scheme | [低] | **P2** | 规则边界有效，但当前风险较低，可后续补强并加测试。 |

### 评估决定

- **发现 #1（`ScanPipeline.process` 未接入预检）**：确认有效，作为 P1 阻塞项处理。建议在扫描入口完成扩展名与大小跳过契约，并补充 `process()` 级别单测。
- **发现 #2（Markdown 链接 URI scheme 过滤边界）**：确认有效但降级为非阻塞 P2。建议进入 CR TODO，后续用通用 URI scheme 过滤和定向测试补强。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-07
- **Model Used**: GPT-5.4
- **Fix Items**: 1

- **Fix #1**: `ScanPipeline.process` 未接入非 Markdown/超大文件预检
- **Files**: `src/scanner/pipeline.ts`、`tests/unit/scanner/pipeline.test.ts`
- **执行结果**: 已修复
- **修改摘要**: 在 `process()` 读取前新增 `statFileSizeOrThrow()`，先获取文件大小并调用 `precheckScannableFile()`；命中非 `.md` 或超过 1MB 时，立即通过 `pendingWarnings` 和 `logger.warn()` 记录 warning 并返回 `null`，不再继续读取或解析文件。
- **关键差异**: 修复前 `process()` 直接进入 `readFileOrThrow()`；修复后改为 `stat -> precheck -> readFile` 的控制流，预检未通过时不会进入 AST 解析阶段。
- **验证**: `npm test -- tests/unit/scanner/pipeline.test.ts`、`npm run type-check`、`npm run lint`、`npm test`
- **备注**: 评估中的发现 #2 已被结论降级为 P2 TODO，本轮按评估约束未修改源码。