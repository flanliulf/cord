---
Story: 3-1
Round: 4
Date: 2026-05-11
Model Used: GitHub Copilot (model id not exposed)
Review Source: 3-1-code-review-summary-20260509-round-4.md
Review Model: GitHub Copilot (model id not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-1 的第 4 轮 CR 代码审查结果（复审）进行评估。本轮审查确认 Round 3 的 2 个低严重度测试覆盖问题均已修复，并声明未发现新的阻塞项、中高优先级问题或功能回归。经代码与测试验证，Round 3 修复确认成立；本轮未输出新的有效 Findings，仅包含 2 个已忽略项，评估同意其不构成当前缺陷。评估结论如下：Story 3.1 从 CR evaluator 视角可通过，当前无 P0/P1/P2 待修复项。

---

## 上轮问题回顾确认

### Round 3 / Finding #1 — `CORD_QUERY_002` 关系端点缺失错误路径缺少测试：已修复

`src/services/query-service.ts:55-63` 中 `resolveTargetPath()` 的关系端点缺失分支会抛出 `QueryError`，并设置 `code: 'CORD_QUERY_002'`。`tests/unit/services/query-service.test.ts:271-291` 已新增对应回归测试：构造源文档存在、关系目标文档缺失的数据，断言抛出 `QueryError`，并校验 `code === 'CORD_QUERY_002'` 与 suggestion `请重新运行 cord scan 重建关系图谱`。该测试真实覆盖了缺失端点分支，同意关闭 Round 3 / Finding #1。

### Round 3 / Finding #2 — `--json` 错误输出缺少测试覆盖：已修复

`src/cli/commands/query.ts:141-144` 的 `writeFailure()` 在 `asJson` 为 true 时通过 `JSON.stringify(toErrorPayload(error))` 输出 stderr JSON；`src/cli/commands/query.ts:157-175` 会保留 `message`、`code`、`suggestion`。`tests/unit/cli/commands/query.test.ts:187-212` 已新增 `--json` 错误输出测试，断言 stdout 为空，并解析 stderr JSON，确认包含 `message`、`code`、`suggestion`。该测试覆盖了 QueryError 的机器可读错误输出契约，同意关闭 Round 3 / Finding #2。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R3-#1 | `CORD_QUERY_002` 关系端点缺失错误路径缺少测试 | 已修复 | 同意关闭。 |
| R3-#2 | `--json` 错误输出缺少测试覆盖 | 已修复 | 同意关闭。 |

---

## 本轮新发现评估

本轮审查结果未输出新的有效 Findings。`新发现` 章节明确写明“本轮未发现新的阻塞项或中高优先级问题”，后续仅列出 2 个已忽略项。经复核，未发现需要补充升级为有效缺陷的问题。

---

## 已忽略项复核

### 1. `CORD_QUERY_002` 在 `--json` 模式下缺少单独 CLI JSON 测试：同意忽略

**问题描述准确性：基本准确**

当前 CLI JSON 错误测试使用的是 `CORD_QUERY_001` 的 `QueryError`，没有单独模拟 `CORD_QUERY_002`。但 `src/cli/commands/query.ts:141-144` 的 JSON 错误输出只依赖 `toErrorPayload(error)`，而 `src/cli/commands/query.ts:170-175` 对所有 CordError-like 错误统一保留 `message`、`code`、`suggestion`，并不按具体 QueryError code 分支处理。

**严重性判断：偏高（作为缺陷不成立）**

`CORD_QUERY_002` 的服务层错误契约已由 `tests/unit/services/query-service.test.ts:271-291` 覆盖；CLI 层也已有 `tests/unit/cli/commands/query.test.ts:187-212` 覆盖 QueryError 的 JSON stderr 序列化。要求每个 QueryError code 都重复跑 CLI JSON mock 属于重复覆盖，不符合当前 CLI 薄壳边界。

**修复建议：可行但非必要**

可以增加测试，但收益有限，且会把服务层错误码矩阵复制到 CLI 命令测试中。维持忽略合理。

**误报评估：误报**

作为“必须修复的当前缺陷”不成立，评估同意审查结果将其 dismiss。

### 2. `--include-deprecated` 缺少 CLI 端到端输出测试：同意忽略

**问题描述准确性：基本准确**

当前 CLI 测试覆盖了 `--include-deprecated` 被转发到 QueryInput；服务层测试覆盖了 `includeDeprecated=true` 时返回 deprecated 关系。因此确实没有专门的 CLI 端到端输出测试去重新验证 deprecated 关系展示。

**严重性判断：偏高（作为缺陷不成立）**

Story 3.1 的实现采用 CLI 薄壳边界：CLI 负责参数解析和输出格式，QueryService 负责查询语义。`tests/unit/cli/commands/query.test.ts:135-159` 已验证 `--include-deprecated` 正确转发；`tests/unit/services/query-service.test.ts:224-239` 已验证 deprecated 关系在 includeDeprecated=true 时可见。将服务过滤语义复制到 CLI 测试并不是必要覆盖。

**修复建议：可行但非必要**

可以补端到端测试，但当前测试分层已覆盖关键契约，继续保持忽略合理。

**误报评估：误报**

作为当前 CR 缺陷不成立，评估同意审查结果将其 dismiss。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮未确认 P0/P1 阻塞项。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | Round 3 的 2 个 P2 测试覆盖项已修复，本轮无新增有效 P2。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| 1 | `CORD_QUERY_002` 在 `--json` 模式下缺少单独 CLI JSON 测试 | [低] | CLI JSON 错误序列化已由 QueryError JSON 测试覆盖，`CORD_QUERY_002` 服务层契约也有专门测试；逐 code 重复 CLI mock 非必要。 |
| 2 | `--include-deprecated` 缺少 CLI 端到端输出测试 | [低] | CLI 转发与服务层 deprecated 语义已分层覆盖，重复端到端输出测试非必要。 |

### 评估决定

- **上轮问题回顾**：Round 3 的 2 条发现均已修复并有对应测试证据，同意关闭。
- **本轮新发现**：无新的有效 Findings，无需新增修复项或 CR TODO。
- **已忽略项**：同意审查结果的 dismiss 判断，2 项均不构成当前缺陷。
- **最终决定**：Story 3.1 第 4 轮 CR 评估通过，可进入后续 CR 最终化流程。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: GPT-5.4
- **Fix Items**: 0

1. 已复核最新评估结论：Round 4 未确认任何需要修复的 P0/P1/P2 项，本轮无需修改源码、测试或 Story 文档。
2. 已确认本轮 2 个已忽略项继续维持 dismiss，不纳入当前修复范围，避免扩大修复边界。
3. 本轮未执行代码变更，因此未新增编译、测试或构建验证；当前仓库代码状态保持不变。