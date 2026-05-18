---
Story: 5-4
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5 (copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。Agent 工具不可用，本轮已降级为当前上下文串行三层审查模式（Blind Hunter / Edge Case Hunter / Acceptance Auditor），审查层均完成。`npm test`、`npm run lint`、`npm run build` 均通过；会话上下文中 `npm run type-check` 已通过。当前存在 2 个需 patch 的问题，其中 1 个中优先级契约偏离、1 个低优先级结果摘要重复问题；建议暂不通过，先修复 patch 后进入评估/复审。

## 新发现

### 1. [中] Claude Skills 的 Expected Output 未引用命名 outputSchema，且 sync_docs 调用描述偏离单文档契约

- **来源**：auditor+edge
- **分类**：patch

- **证据**
  - `src/adapters/ide/claude-code.ts:39-41`、`src/adapters/ide/claude-code.ts:57-59`、`src/adapters/ide/claude-code.ts:75-77`、`src/adapters/ide/claude-code.ts:93-95` 为 4 个 Skills 写入自然语言 Expected Output，例如 impacted documents、related documents、initialization status、sync recommendations。
  - `src/adapters/ide/claude-code.ts:194-210` 会把这些自然语言条目原样输出到 `## Expected Output`。
  - `src/adapters/ide/claude-code.ts:89-91` 的同步建议 Skill 写成调用 `sync_docs` 时携带 source document 和 impacted targets，并要求 apply guidance；但 Story 5.1 对 `sync_docs` 的边界是只读、单文档建议 Tool，多文档场景按文件依次调用。
  - `_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md:48-55` 明确要求 Skills 的“预期输出格式”直接引用 `src/mcp/tools/schemas.ts` 中的命名 schema，不使用自然语言描述，并列出 `AnalyzeImpactResult`、`QueryRelationsResult`、`InitGraphResult`、`SyncDocsResult`。
  - `_bmad-output/planning-artifacts/epics/epic-5ai-ide-集成mcp-server-hooks-指令注入.md:99-101` 同样要求 Skills 直接引用对应命名 outputSchema。
  - `src/mcp/tools/schemas.ts:23-35`、`src/mcp/tools/schemas.ts:45-56`、`src/mcp/tools/schemas.ts:64-69`、`src/mcp/tools/schemas.ts:89-97` 已存在 4 个对应的命名输出 schema。

- **影响**
  - `cord init` 现在已经会实际生成 Claude Skills 文件；生成内容会与 FR31 / Story 5.5 的 schema 对齐要求不一致，后续 Agent 读取 Skills 时无法从产物中绑定稳定输出 DTO。
  - `sync_docs` 的多目标措辞可能诱导 Agent 构造不存在的批量输入形状，偏离 Story 5.1 的单文档只读建议边界。

- **建议**
  - 将每个 Skill 的 Expected Output 改为直接引用命名 schema，例如 `Expected output schema: AnalyzeImpactResult (src/mcp/tools/schemas.ts)`、`QueryRelationsResult`、`InitGraphResult`、`SyncDocsResult`。
  - 将 `sync_docs` 的调用序列改为单文档 `filePath` 语义；如有多文档场景，明确“按文件逐次调用”。
  - 补充测试读取生成的 Skill 内容，断言 4 个命名 schema 出现在对应文件中，并断言 `sync_docs` 不宣称批量 impacted targets 输入。

### 2. [低] generatedFiles 会重复包含 generatedSkills，非 JSON 摘要会重复列出 Skills 文件

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/init-service.ts:57-62` 的 `beforeSnapshot` 只包含 IDE 固定输出和配置文件，不包含即将生成的 Skills 路径。
  - `src/services/init-service.ts:68-73` 先写入 Skills，再把 `generatedSkills` 追加进 `afterSnapshot`。
  - `src/services/init-service.ts:193-206` 的 `diffSnapshots` 对 `before.get(relativePath) !== afterHash` 即加入 `generatedFiles`；因为 Skills 路径没有进入 before snapshot，`before.get()` 为 `undefined`，所以 Skills 会进入 `generatedFiles`。
  - `src/services/init-service.ts:80-81` 同时返回 `generatedFiles` 与 `generatedSkills`；`src/cli/commands/init.ts:184-191` 在非 JSON 摘要中分别打印“生成/更新文件”和“Skills 文件”，因此同一 Skills 文件会出现两次。

- **影响**
  - AC #8 要求步骤进度与结果摘要；重复列出同一文件会让初始化结果摘要显得不可信，也让 JSON 消费方难以判断 `generatedFiles` 是否表示普通文件集合还是包含 Skills 的全集。
  - 当前测试只断言 `generatedSkills`，未覆盖实际 `generatedFiles` 是否排除 Skills，因此该行为容易回归。

- **建议**
  - 明确 `generatedFiles` 与 `generatedSkills` 的边界：若 `generatedSkills` 是专用字段，则从 `generatedFiles` 中过滤 Skills；或让 `generatedFiles` 表示全集并取消 CLI 中的重复分组。
  - 增补 InitService / CLI 测试，断言 Claude Code init 的 Skills 文件不会在普通摘要中重复出现。

## 验证摘要

- `npm test` ✅ 通过（413 / 413）
- `npm run lint` ✅ 通过（0 errors）
- `npm run build` ✅ 通过（生成 ESM 与 DTS 输出）
- `npm run type-check` ✅ 通过（来自本轮会话上下文，退出码 0）
- 定向复现 ✅ 完成
  - 静态追踪 `InitService.init()` 的 snapshot 差异计算，确认 Skills 路径会同时进入 `generatedFiles` 与 `generatedSkills`。
  - 对照 Story 5.5 / Epic 5 / `src/mcp/tools/schemas.ts`，确认当前 Claude Skills 的 Expected Output 未引用命名 outputSchema。

## 通过项

- `InitService` 已编排 IDE 检测、框架检测、IDE 配置/指令/Hooks 生成、Skills 写入、配置文件写入和 `.cord/` 目录创建。
- `--json` 非交互成功输出与 `AMBIGUOUS_IDE` 结构化错误路径已有单元测试覆盖。
- `--ide` 显式覆盖多 IDE 检测的交互选择路径已有单元测试覆盖。
- `--format json` 生成 `cord.config.json` 且移除默认 YAML 的路径已有 InitService / 集成测试覆盖。
- 不支持 Skills 的 IDE 适配器会跳过 Skills 生成并返回空 `generatedSkills`。
- Claude Code init 集成测试已覆盖 4 个 Skills 文件的生成路径与存在性。