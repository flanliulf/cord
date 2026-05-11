---
Story: 3-1
Round: 3
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Review Source: 3-1-code-review-summary-20260509-round-3.md
Review Model: GitHub Copilot (model id not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-1 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 2 的 2 个低严重度问题均已修复，并新增 2 条低严重度 patch 发现，均属于测试覆盖增强：`CORD_QUERY_002` 关系端点缺失错误路径缺少测试、`--json` 错误输出缺少测试覆盖。经代码验证，Round 2 修复确认成立；Round 3 新发现均为有效问题，但不构成 P0/P1 阻塞，不影响 Story 3.1 当前验收通过。评估结论如下。

---

## 上轮问题回顾确认

### Round 2 / Finding #1 — projectRoot 外路径会以 `../` 形式进入 QueryService：已修复

`src/cli/commands/query.ts:78-92` 的 `normalizeQueryDocPath(projectRoot, docPath)` 已将输入解析为 project-relative POSIX 路径，并显式拒绝 `normalizedRelativePath === ''`、`normalizedRelativePath === '..'`、`normalizedRelativePath.startsWith('../')` 的项目外输入，抛出 `ConfigError`。该逻辑发生在 `src/cli/commands/query.ts:51-56` 的 `serviceFactory(projectRoot)` 调用之前。`tests/unit/cli/commands/query.test.ts:259-291` 覆盖项目外相对路径和绝对路径，并断言不会初始化 service。

### Round 2 / Finding #2 — 默认 QueryService 未关闭底层 SQLite repository：已修复

`src/services/query-service.ts:74-76` 已新增 `close()` 并转发到底层 `repository.close()`。CLI 的 `finally` 块仍在 `src/cli/commands/query.ts:65-66` 调用 `service?.close?.()`，因此默认 `QueryService` 现在可以释放底层 SQLite repository。`tests/unit/services/query-service.test.ts:271-278` 覆盖服务层 close 转发，`tests/unit/cli/commands/query.test.ts:187-219` 覆盖 query 成功和失败路径都会调用 injected service 的 close。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R2-#1 | projectRoot 外路径会以 `../` 形式进入 QueryService | 已修复 | 同意关闭。 |
| R2-#2 | 默认 QueryService 未关闭底层 SQLite repository | 已修复 | 同意关闭。 |

---

## 发现 #1 评估

### 审查原文

> **[低][新] `CORD_QUERY_002` 关系端点缺失错误路径缺少测试**
> - 来源：blind + acceptance
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`src/services/query-service.ts:55-63` 的 `resolveTargetPath()` 在关系另一端文档不存在时会抛出 `QueryError`，错误信息包含 `CORD_QUERY_002`，并设置 `code: 'CORD_QUERY_002'`。该分支会在 `src/services/query-service.ts:42` 的结果映射过程中触发。

当前服务层测试覆盖了源文档不存在的 `CORD_QUERY_001`：`tests/unit/services/query-service.test.ts:253-267` 断言 `QueryError`、`code` 和 `suggestion`。但同文件只出现 `CORD_QUERY_001`，没有 `CORD_QUERY_002` 覆盖；`tests/unit/services/query-service.test.ts:271-278` 新增的是 close 转发测试，不覆盖关系端点缺失分支。因此审查指出的测试缺口成立。

**严重性判断：合理**

该发现不是实现错误，而是未覆盖的异常分支。当前代码逻辑直接、错误码明确，主路径和 AC 验收不受影响；但该分支属于错误契约的一部分，缺少回归测试会降低后续维护稳定性。原审查标为低严重度合理，评估为 P2。

**修复建议：可行**

构造一个存在源文档、但 relation 的另一端文档不存在的内存仓储数据，调用 `service.query({ docPath: ... })` 并断言抛出 `QueryError`、`code === 'CORD_QUERY_002'`、`suggestion` 为重建关系图谱提示即可。修复成本低，测试边界清晰。

**误报评估：非误报**

代码分支存在且当前测试没有覆盖 `CORD_QUERY_002`，非误报。

---

## 发现 #2 评估

### 审查原文

> **[低][新] `--json` 错误输出缺少测试覆盖**
> - 来源：edge + acceptance
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`src/cli/commands/query.ts:141-144` 的 `writeFailure()` 在 `asJson` 为 true 时会向 stderr 写入 `JSON.stringify(toErrorPayload(error))`。`src/cli/commands/query.ts:157-175` 的 `toErrorPayload()` 对 `ConfigError` 和 `CordError` 都会保留 `message`、`code`、`suggestion`。

当前 query CLI 测试只覆盖成功路径 JSON：`tests/unit/cli/commands/query.test.ts:100-124` 使用 `--json` 并解析 stdout。错误路径测试 `tests/unit/cli/commands/query.test.ts:162-184` 只覆盖非 JSON 文本 stderr，不解析 `stderr` JSON，也未覆盖 `--json` + `QueryError` 或 `--json` + `ConfigError`。因此审查指出的测试覆盖缺口成立。

**严重性判断：合理**

当前实现看起来正确，问题主要是机器可读错误输出契约缺少测试保护。该风险不会阻塞 Story 3.1 当前交付，但会影响后续维护时对 `code` / `suggestion` 序列化稳定性的信心。原审查标为低严重度合理，评估为 P2。

**修复建议：可行**

补充 CLI 测试即可：使用 `--json` 触发 `QueryError`，解析 `stderr.read()` 并断言包含 `message`、`code`、`suggestion`；可选再覆盖 `--json` + 无效 `--type` 或项目外路径的 `ConfigError`。修复成本低。

**误报评估：非误报**

错误 JSON 输出分支存在，当前测试没有覆盖 stderr JSON 结构，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮未确认 P0/P1 阻塞项。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `CORD_QUERY_002` 关系端点缺失错误路径缺少测试 | [低] | **P2** | 错误分支存在且契约明确，但缺少回归测试保护。 |
| 2 | `--json` 错误输出缺少测试覆盖 | [低] | **P2** | 机器可读错误输出实现存在，但 stderr JSON 结构未被测试验证。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮 2 条新发现均经代码验证为有效。 |

### 评估决定

- **上轮问题回顾**：Round 2 的 2 条发现均已修复并有对应测试证据，同意关闭。
- **发现 #1（`CORD_QUERY_002` 关系端点缺失错误路径缺少测试）**：确认有效，建议作为 P2 非阻塞项处理；补服务层异常分支测试即可。
- **发现 #2（`--json` 错误输出缺少测试覆盖）**：确认有效，建议作为 P2 非阻塞项处理；补 CLI 错误 JSON stderr 结构测试即可。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-09
- **Model Used**: GPT-5.4
- **Fix Items**: 2

1. 已修复发现 #1：在 `tests/unit/services/query-service.test.ts` 中新增 `CORD_QUERY_002` 回归测试，构造“源文档存在但关系端点文档缺失”的内存仓储数据，断言抛出 `QueryError`，并校验 `code === 'CORD_QUERY_002'` 与重建图谱提示。
2. 已修复发现 #2：在 `tests/unit/cli/commands/query.test.ts` 中新增 `--json` 错误输出测试，验证 `QueryError` 在 JSON 模式下会向 stderr 输出包含 `message`、`code`、`suggestion` 的机器可读错误载荷。
3. 本轮未修改生产实现；仅补充评估确认缺失的测试覆盖，未扩大修复范围。
4. 验证结果：`npm test -- tests/unit/services/query-service.test.ts tests/unit/cli/commands/query.test.ts`、`npm test`、`npm run lint` 全部通过。