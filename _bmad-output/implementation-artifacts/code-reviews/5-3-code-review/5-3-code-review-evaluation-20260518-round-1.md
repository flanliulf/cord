---
Story: 5-3
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5 (copilot)
Review Source: 5-3-code-review-summary-20260518-round-1.md
Review Model: GPT-5.5 (copilot)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-3 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 2 个 patch 发现：1 个 VS Code Copilot 指令文件覆盖风险，1 个 `AGENTS.md` CORD 区块更新时修改区块外空白的问题。经代码验证，2 个发现均为真实问题，均需要 fixer 处理；评估决定为 **Changes Required / 不通过**。

---

## 发现 #1 评估

### 审查原文

> **[高] VS Code Copilot 会覆盖已有 `copilot-instructions.md`，违反零侵入要求**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`src/adapters/ide/vscode-copilot.ts:28` 在 `generateInstructionFile()` 中直接调用 `writeCordOwnedFile(join(projectRoot, COPILOT_INSTRUCTIONS_FILE), buildCopilotInstructions())` 写入 `.github/copilot-instructions.md`。`src/adapters/ide/shared.ts:31-37` 的 `writeCordOwnedFile()` 会先创建目录，然后无条件 `writeFileSync(filePath, content, 'utf8')`，没有 `existsSync()` 检查，也没有 same-content no-op 或 conflict 分支。因此如果用户已有 `.github/copilot-instructions.md`，内容会被静默替换。

Story AC #5 要求 VS Code Copilot 生成 `copilot-instructions.md + AGENTS.md + MCP Host`，AC #7 要求“独立文件注入，不修改已有配置（NFR12）”，且仅明确将 `AGENTS.md` 定义为 appendable 例外；AC #8 要求覆盖零侵入验证。当前 Copilot 指令文件不是 `AGENTS.md`，不在 appendable 例外内，使用无条件覆盖不满足 AC #7/#8。

现有 `tests/unit/adapters/ide.test.ts:140-159` 只验证空项目中生成 Copilot 指令、MCP config 和共享 `AGENTS.md` block，没有预置已有 `.github/copilot-instructions.md` 并断言保持不变或结构化冲突。因此 reviewer 对测试缺口的判断也成立。

**严重性判断：合理**

原始严重性标为“高”合理。该问题会导致用户已有 IDE 指令配置被静默覆盖，属于配置数据丢失风险，并直接违反 NFR12/AC #7/#8。虽然不是运行时崩溃，但对初始化工具而言是交付阻塞缺陷，应作为 P1 修复。

**修复建议：可行**

建议将 `.github/copilot-instructions.md` 写入从 `writeCordOwnedFile()` 改为 `writeProtectedFile()`，或采用 CORD 专属独立文件加非侵入引用策略。考虑 AC #5 已明确要求 `copilot-instructions.md`，最小修复是使用 `writeProtectedFile()`：不存在时创建，内容一致时 no-op，内容不一致时抛出结构化冲突。同时补充已有文件保护测试。

**误报评估：非误报**

代码路径和 Story 约束均能独立支持该发现，且 reviewer 的来源为 blind+auditor，多来源命中提高可信度。该发现不是误报。

---

## 发现 #2 评估

### 审查原文

> **[中] 已有 CORD 区块更新会改动 `AGENTS.md` 区块外空白，未满足“区块外不变”校验口径**
> - 来源：edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`src/adapters/ide/shared.ts:120-121` 在更新已有 CORD 区块时分别对区块前后内容调用 `trimEnd()` 和 `trimStart()`。这会删除 CORD block 外侧用户内容的原始空白。随后 `src/adapters/ide/shared.ts:122-126` 使用过滤后的片段重新 join，并通过 `writeCordOwnedFile()` 写回，导致 CORD 区块外内容不再逐字节保持。

Story AC #7 定义 `AGENTS.md` 是 NFR12 appendable 例外，但约束是以 CORD 注释边界段追加；共享文件处理契约进一步要求 preserve-if-exists 时“原内容不变”。AC #8 要求零侵入验证。当前实现对于“已存在且已含 CORD 区块”的重复运行/升级路径会修改区块外空白，无法满足“CORD 注释段外不变”的可审计口径。

现有 `tests/unit/adapters/ide.test.ts:161-173` 只验证首次向已有 `AGENTS.md` 追加 CORD section 后包含旧标题和 CORD marker，没有断言原始内容逐字节不变；测试文件中也没有覆盖“已有合法 CORD block 后再次 upsert”的路径。因此 reviewer 对 AC #8 测试缺口的判断成立。

**严重性判断：偏低**

原始严重性标为“中”在功能影响层面可以理解，因为它通常不会破坏核心初始化流程；但从 Story 验收角度看，它违反 AC #8 的零侵入验证要求，也削弱 NFR12 appendable 例外的可审计性。评估后提升为 P1：不是因为运行时风险高，而是因为它是验收标准未闭合，应在交付前修复。

**修复建议：可行**

建议替换已有 CORD block 时保留 `existingContent.slice(0, startIndex)` 和 `existingContent.slice(endIndex + marker.length)` 的原始切片，不对 CORD block 外内容执行 trim；只替换 marker 边界内的 CORD 段或包含 marker 的 CORD 段。补充测试时应构造区块前后含多种空白的 `AGENTS.md`，再次 upsert 后断言 CORD block 外内容逐字节不变。

**误报评估：非误报**

代码中存在明确的 trim 行为，且该行为会改变区块外字节。结合 Story 的 preserve-if-exists / 零侵入测试要求，该发现不是误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | VS Code Copilot 会覆盖已有 `.github/copilot-instructions.md` | [高] | **P1** | 直接违反 NFR12/AC #7/#8，存在用户配置被静默覆盖的数据丢失风险。 |
| 2 | 已有 CORD 区块更新会改动 `AGENTS.md` 区块外空白 | [中] | **P1** | 违反 `AGENTS.md` preserve-if-exists / 区块外不变的零侵入验收口径，测试覆盖未闭合。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮 2 个发现均应进入 fixer，不建议仅作为延迟 TODO。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮未发现误报。 |

### 评估决定

- **发现 #1（VS Code Copilot 会覆盖已有 `.github/copilot-instructions.md`）**：确认有效，阻塞交付。应进入 fixer，改为非侵入写入并补充已有文件保护测试。
- **发现 #2（已有 CORD 区块更新会改动 `AGENTS.md` 区块外空白）**：确认有效，阻塞交付。应进入 fixer，保留 CORD block 外原始切片并补充重复 upsert 的逐字节不变测试。
- **总体决定**：**Changes Required / 不通过**。需要进入 fixer。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-18
- **Model Used**: GPT-5.4 (copilot)
- **Fix Items**: 2

1. 发现 #1 已修复：将 `src/adapters/ide/vscode-copilot.ts` 中 `.github/copilot-instructions.md` 的写入策略从 `writeCordOwnedFile()` 改为 `writeProtectedFile()`，确保已有用户文件保持不变，并在冲突时抛出结构化错误而非静默覆盖。补充了 `tests/unit/adapters/ide.test.ts` 中“已有 Copilot 指令文件时拒绝覆盖”的定向测试，覆盖 NFR12 / AC #7 / AC #8 要求。
2. 发现 #2 已修复：调整 `src/adapters/ide/shared.ts` 中 `upsertAgentsSection()` 的已有 CORD 区块更新逻辑，改为仅替换 marker 边界内的 CORD 段，完整保留区块外前后原始字节内容，不再对区块外内容执行 trim。补充了 `tests/unit/adapters/ide.test.ts` 中“重复 upsert 时区块外内容逐字节不变”的定向测试。
3. 验证结果：`npm test -- --run tests/unit/adapters/ide.test.ts` 通过；`npm run type-check` 与 `npm run lint` 首次因本次改动遗留的未使用导入失败，移除 `src/adapters/ide/vscode-copilot.ts` 中未使用的 `writeCordOwnedFile` 导入后重跑，二者均通过。