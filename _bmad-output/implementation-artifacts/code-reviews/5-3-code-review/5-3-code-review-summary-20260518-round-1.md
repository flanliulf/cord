---
Story: 5-3
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5 (copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。Agent 工具在当前运行时不可用，本轮按 `bmenhance-cr-01-reviewer` 降级规则串行完成 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三层审查；三层均完成，未跳过。`npm run type-check`、`npm run lint`、定向 `npm test -- --run tests/unit/adapters/ide.test.ts` 均通过；`npm run build` 未执行，因为该命令会写入 `dist`，与本轮只读审查约束冲突。当前存在 2 个需要修复的 patch 发现，其中 1 个直接违反 NFR12/AC #7/#8，建议不通过，进入 evaluator/fixer 下一步。

## 新发现

### 1. [高] VS Code Copilot 会覆盖已有 `copilot-instructions.md`，违反零侵入要求

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `src/adapters/ide/vscode-copilot.ts:28` 在 `generateInstructionFile()` 中直接调用 `writeCordOwnedFile(join(projectRoot, COPILOT_INSTRUCTIONS_FILE), buildCopilotInstructions())` 写入 `.github/copilot-instructions.md`。
  - `src/adapters/ide/shared.ts:30-37` 的 `writeCordOwnedFile()` 无存在性检查，会无条件 `writeFileSync(filePath, content, 'utf8')`。
  - Story AC #7 明确要求“独立文件注入，不修改已有配置（NFR12）”，且只有 `AGENTS.md` 是 appendable 例外；Story AC #5 又将 `copilot-instructions.md` 列为 VS Code Copilot 适配产物。
  - `tests/unit/adapters/ide.test.ts:140-159` 只覆盖空项目中新建 Copilot 指令、MCP 和 `AGENTS.md`，没有覆盖“已有 `.github/copilot-instructions.md` 必须保留/冲突”的零侵入负例。

- **影响**
  - 用户已有 Copilot 指令会被静默替换为 CORD 模板，属于配置数据丢失风险。
  - AC #7 的“除 `AGENTS.md` 外不修改已有配置”未满足，AC #8 的零侵入测试覆盖也未闭合。

- **建议**
  - 对 `.github/copilot-instructions.md` 使用 `writeProtectedFile()` 或改为 CORD 专属独立文件并由非侵入方式引用；若已有内容不同，应抛出结构化冲突而不是覆盖。
  - 补充测试：预置 `.github/copilot-instructions.md` 后运行 `VscodeCopilotAdapter.generateInstructionFile()`，断言原内容保持不变或抛出明确冲突，并验证 `AGENTS.md` 仍按 appendable 例外处理。

### 2. [中] 已有 CORD 区块更新会改动 `AGENTS.md` 区块外空白，未满足“区块外不变”校验口径

- **来源**：edge+auditor
- **分类**：patch

- **证据**
  - `src/adapters/ide/shared.ts:120-121` 在更新已有 CORD 区块时使用 `trimEnd()` 和 `trimStart()` 处理区块前后内容。
  - 架构决策要求 `AGENTS.md` 的 SHA-256 零侵入校验分为“严格不变文件”与“CORD 注释段外不变”；Story AC #8 要求零侵入验证，父 Epic 也明确测试需覆盖“CORD 注释段外不变”。
  - `tests/unit/adapters/ide.test.ts:161-173` 只验证追加后包含旧标题和 CORD 标记，没有断言区块外原始字节/内容完全不变；现有测试也没有覆盖“文件已含 CORD 区块后再次 upsert”的路径。

- **影响**
  - 重复运行初始化或升级 CORD 区块时，用户在 CORD 区块前后的空白格式会被修改；这会使“CORD 注释段外不变”的零侵入断言不可验证。
  - 该问题不会破坏核心功能，但会削弱 NFR12 appendable 例外的可审计性。

- **建议**
  - 替换已有 CORD 区块时保留 `startIndex` 前和 end marker 后的原始切片，不对区块外内容执行 trim；只替换 marker 内部或包含 marker 的 CORD 段。
  - 补充测试：构造已有 `AGENTS.md`，包含用户内容、空白、已有 CORD 区块和尾部内容；upsert 后断言 CORD 区块外内容逐字节不变。

## 验证摘要

- `npm run type-check` ✅ 通过（`tsc --noEmit`，退出码 0）
- `npm run lint` ✅ 通过（退出码 0）
- `npm test -- --run tests/unit/adapters/ide.test.ts` ✅ 通过（11 / 11）
- `npm test` ✅ 根据当前会话上下文，用户上一条终端记录显示退出码 0
- `npm run build` 未执行：会写入 `dist`，为遵守本轮只读 CR 约束未运行
- 定向复核：
  - 4 IDE 检测实现存在，`AGENTS.md` 与 `.vscode` 共存时不会误判 Codex CLI。
  - `AGENTS.md` create-if-absent / preserve-if-exists / malformed marker explicit-conflict 均有基本测试覆盖。
  - AC #8 对“已有 Copilot 指令不得覆盖”和“已有 CORD 区块的区块外不变”覆盖不足。

## 通过项

- `IIdeAdapter`、`IdeName`、`SkillsArtifact` 接口与类型已落在 `src/adapters/ide/interfaces.ts`。
- `detector.ts` 覆盖 Claude Code / Cursor / VS Code Copilot / Codex CLI 四类检测，且 `AGENTS.md` 与其他 IDE 专属标志共存时不计为 Codex CLI 命中。
- 四个 IDE 适配器均存在；基础生成路径与 Story File List 对齐。
- `AGENTS.md` malformed marker 路径返回 `AGENTS_MD_CONFLICT` 结构化上下文，满足 explicit-conflict 的核心错误形态。

## 结论

- **结论：不通过**
- **阻塞项**：Finding #1（现有 `.github/copilot-instructions.md` 会被覆盖，违反 NFR12/AC #7/#8）
- **建议**：进入 evaluator 确认发现有效性；若确认，进入 fixer 修复 Copilot 指令零侵入写入与 `AGENTS.md` 区块外不变测试缺口。