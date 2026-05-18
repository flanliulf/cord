---
Story: 5-4
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5 (copilot)
Review Source: 5-4-code-review-summary-20260518-round-1.md
Review Model: GPT-5.5 (copilot)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-4 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 2 项新发现：1 项 Claude Skills outputSchema / sync_docs 单文档契约偏离，1 项 InitService 结果摘要字段边界重复。经独立代码验证，两项发现均有效，均建议作为本轮 patch 修复后再通过。

---

## 发现 #1 评估

### 审查原文

> **[中] Claude Skills 的 Expected Output 未引用命名 outputSchema，且 sync_docs 调用描述偏离单文档契约**
> - 来源：auditor+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该发现成立。`src/adapters/ide/claude-code.ts:39-41`、`src/adapters/ide/claude-code.ts:57-59`、`src/adapters/ide/claude-code.ts:75-77`、`src/adapters/ide/claude-code.ts:93-95` 的 4 个 `expectedOutput` 仍是自然语言描述，没有直接引用 `AnalyzeImpactResult`、`QueryRelationsResult`、`InitGraphResult`、`SyncDocsResult`。`src/adapters/ide/claude-code.ts:194-210` 会将这些自然语言条目原样写入 `## Expected Output`，因此生成的 Claude Skills 文件确实不满足命名 schema 引用要求。

约束侧也成立。`_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:48-55` 要求 Skills 文件在“预期输出格式”字段中直接引用 `src/mcp/tools/schemas.ts` 的命名 schema，并明确不使用自然语言描述；`_bmad-output/planning-artifacts/epics/epic-5ai-ide-集成mcp-server-hooks-指令注入.md:99-101` 也列出 4 个场景与命名 outputSchema 的映射。`src/mcp/tools/schemas.ts:23-35`、`src/mcp/tools/schemas.ts:45-56`、`src/mcp/tools/schemas.ts:64-69`、`src/mcp/tools/schemas.ts:89-97` 已存在对应命名 schema。

`sync_docs` 的单文档契约偏离同样成立。`src/adapters/ide/claude-code.ts:89-91` 写的是 `Call sync_docs with the source document and relevant impacted targets`，并要求 apply returned guidance；但 `src/mcp/tools/schemas.ts:84-86` 的 `SyncDocsInput` 只有 `filePath` 单文档输入，Story 5.5 也写明 `sync_docs` 是单文档调用，多文档时依次调用。

测试缺口判断也成立。`tests/integration/cli/init.test.ts:86-95` 只断言 4 个 Skills 文件路径和文件存在性，没有读取内容断言 4 个命名 schema，也没有断言 `sync_docs` 不宣称批量 impacted targets 输入。

**严重性判断：合理**

原始 [中] 严重性合理。该问题不一定导致 `cord init` 命令失败，但会让实际生成的 Claude Skills 与 FR31 / Story 5.5 / NFR10 的稳定输出 DTO 约束不一致，并可能诱导 Agent 构造不存在的 `sync_docs` 批量输入形状。由于 Story 5-4 当前已经实际写入 Skills 产物，属于可交付内容的契约偏离，应作为 P1 修复后再通过。

**修复建议：可行**

审查建议可行。应将 4 个 Skill 的 `Expected Output` 改为直接引用命名 schema，并将 `sync_docs` 的 Tool Sequence 改成单文档 `filePath` 语义；多文档场景明确按文件逐次调用。同时补充集成或适配器单测，读取生成内容并断言 4 个命名 schema 存在、`sync_docs` 不包含批量 impacted targets 语义。

**误报评估：非误报**

非误报。实现、Story/Epic 约束、schema 定义和测试缺口均可复现，且 auditor+edge 双来源命中提高了该发现可信度。

---

## 发现 #2 评估

### 审查原文

> **[低] generatedFiles 会重复包含 generatedSkills，非 JSON 摘要会重复列出 Skills 文件**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该发现成立。`src/services/init-service.ts:53-58` 构造 `knownOutputPaths` 时只包含 IDE 固定输出、YAML 配置和 JSON 配置，不包含即将生成的 Skills 路径，因此 `src/services/init-service.ts:59` 的 `beforeSnapshot` 不会记录 Skills 文件。`src/services/init-service.ts:68-73` 先写入 `generatedSkills`，再将 `generatedSkills` 追加进 `afterSnapshot`；`src/services/init-service.ts:193-206` 的 `diffSnapshots` 只要 `before.get(relativePath) !== afterHash` 就把路径加入 `generatedFiles`。对新增 Skills 文件而言，`before.get(relativePath)` 为 `undefined`、`afterHash` 为实际 hash，因此 Skills 会进入 `generatedFiles`。

返回值与 CLI 摘要重复路径也成立。`src/services/init-service.ts:80-81` 同时返回 `generatedFiles` 与 `generatedSkills`；`src/cli/commands/init.ts:174-191` 在非 JSON 摘要中先打印“生成/更新文件”，再打印“Skills 文件”，因此同一批 Skills 文件会在普通文件和 Skills 文件两个分组重复出现。

Story 侧相关要求存在。`_bmad-output/implementation-artifacts/stories/5-4-initservice-one-click-init-cord-init.md:20` 要求输出包含步骤进度和结果摘要，`_bmad-output/implementation-artifacts/stories/5-4-initservice-one-click-init-cord-init.md:25` 的 AC #14 要求支持 Skills 生成。当前实现虽满足生成，但结果摘要边界不清，会让同一文件重复出现在两个字段/分组中。

测试缺口判断成立。`tests/unit/services/init-service.test.ts:115-116` 只断言 `generatedSkills` 和文件内容，不断言 `generatedFiles` 是否排除同一 Skills 文件；`tests/integration/cli/init.test.ts:86-95` 只断言 JSON 输出中的 `generatedSkills` 和文件存在性，也未断言 `generatedFiles` 边界；`tests/unit/cli/commands/init.test.ts:63-87` 的 CLI JSON 样例使用空 `generatedSkills`，没有覆盖 Skills 与普通文件同时存在时的非 JSON 摘要重复问题。

**严重性判断：偏低**

原始 [低] 略偏低。它表面上是结果摘要重复，但影响不止展示层：`generatedFiles` 与 `generatedSkills` 同时暴露在 JSON 结果中，自动化消费方无法稳定判断 `generatedFiles` 是普通文件集合还是包含 Skills 的全集；非 JSON 摘要也会重复列出同一文件，削弱 AC #8 的结果可信度。鉴于这是 `cord init` 的用户可见输出契约问题，建议按 P1 patch 处理后再通过。

**修复建议：可行**

审查建议可行。可选择明确 `generatedSkills` 为专用字段，并在计算或返回 `generatedFiles` 时过滤 Skills 路径；或明确 `generatedFiles` 表示全集，同时调整 CLI 摘要避免二次分组重复。考虑当前返回结构已经有 `generatedSkills` 专用字段，过滤 `generatedFiles` 中的 Skills 更符合现有 API 语义。应补充 InitService / CLI 测试覆盖该边界。

**误报评估：非误报**

非误报。snapshot 差异计算路径可直接推出重复结果，且 blind+edge 双来源命中。当前测试也确实没有覆盖该重复摘要场景。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Claude Skills Expected Output 未引用命名 outputSchema，且 sync_docs 文案偏离单文档契约 | [中] | **P1** | 生成产物与 FR31 / Story 5.5 / schema 契约不一致，需修复并补测试。 |
| 2 | generatedFiles 重复包含 generatedSkills，导致 JSON 和非 JSON 摘要边界不清 | [低] | **P1** | `cord init` 用户可见/机器可读结果摘要存在重复与字段语义歧义，需修复并补测试。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | - | - | - | 本轮无建议转入 CR TODO 的非阻塞项。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | - | - | 本轮无误报。 |

### 评估决定

- **发现 #1（Claude Skills outputSchema / sync_docs 契约偏离）**：确认有效，需作为 P1 修复；修复应覆盖生成内容和测试断言。
- **发现 #2（generatedFiles / generatedSkills 重复摘要）**：确认有效，需作为 P1 修复；修复应明确两个字段边界，并覆盖非 JSON 摘要或 InitService 返回值测试。
- **是否通过**：不通过。本轮 2 项 patch 均有效，建议完成修复后进入 CR 修复/复审流程。

## 修复执行记录

### 修复执行记录

- **Date**: 2026-05-18
- **Model Used**: GPT-5.4 (copilot)
- **Fix Items**: 2

#### 修复项 1：Claude Skills outputSchema / sync_docs 单文档契约

- **修改文件**：`src/adapters/ide/claude-code.ts`、`tests/integration/cli/init.test.ts`
- **执行结果**：已将 4 个 Claude Skills 的 `Expected Output` 改为直接引用命名 schema（`AnalyzeImpactResult`、`QueryRelationsResult`、`InitGraphResult`、`SyncDocsResult`），并将 `sync_docs` 调用说明改为单文档 `filePath` 语义；多文档场景明确按文档逐次调用。
- **关键验证**：集成测试新增对生成的 Skills 文件内容断言，验证 4 个命名 schema 均出现在对应文件中，且 `cord-sync-docs.md` 不再包含 `relevant impacted targets` 这类批量输入措辞。

#### 修复项 2：generatedFiles / generatedSkills 结果摘要边界

- **修改文件**：`src/services/init-service.ts`、`tests/unit/services/init-service.test.ts`、`tests/unit/cli/commands/init.test.ts`、`tests/integration/cli/init.test.ts`
- **执行结果**：已在 `InitService` 返回结果中从 `generatedFiles` 过滤 `generatedSkills`，保留 `generatedSkills` 作为专用字段，消除 JSON 结果与非 JSON 摘要中的 Skills 重复归类问题。
- **关键验证**：新增 InitService 单测断言 Skills 文件不会进入 `generatedFiles`；新增 CLI 非 JSON 摘要测试断言 Skills 仅出现在 `Skills 文件` 分组；集成测试断言 JSON 输出中的 `generatedFiles` 不包含 Skills 路径。

#### 定向验证结果

- `node_modules/.bin/vitest run tests/unit/services/init-service.test.ts tests/unit/cli/commands/init.test.ts tests/integration/cli/init.test.ts` ✅ 通过（3 个文件，10 个测试）
- 编辑器诊断：`src/adapters/ide/claude-code.ts`、`src/services/init-service.ts`、`tests/unit/services/init-service.test.ts`、`tests/unit/cli/commands/init.test.ts`、`tests/integration/cli/init.test.ts` 均无新增错误