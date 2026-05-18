# Story 5.3: IDE 适配器与自动检测

Status: done

## Story

As a 用户，
I want 系统自动检测我使用的 AI IDE 类型，
So that `cord init` 可以为我的 IDE 生成正确的配置文件。

## Acceptance Criteria (AC)

1. **Given** 需要支持多 IDE **When** 定义接口 **Then** `src/adapters/ide/interfaces.ts` 定义 IIdeAdapter
2. **Given** 接口定义 **When** 实现检测 **Then** `src/adapters/ide/detector.ts` 检测 4 种 IDE（FR2）
3. **Given** Claude Code **When** 实现适配 **Then** Hooks + CLAUDE.md + MCP 配置
4. **Given** Cursor **When** 实现适配 **Then** .cursor/mcp.json + .cursor/rules/
5. **Given** VS Code Copilot **When** 实现适配 **Then** copilot-instructions.md + AGENTS.md + MCP Host（与 PRD IDE 矩阵对齐）
6. **Given** Codex CLI **When** 实现适配 **Then** AGENTS.md（基础集成）
7. **Given** 注入策略 **When** 检查 **Then** 独立文件注入，不修改已有配置（NFR12）；`AGENTS.md` 为 NFR12 appendable 例外共享文件：文件不存在时创建，已存在时以 CORD 注释边界段追加（详见共享文件处理契约）
8. **Given** 实现完毕 **When** 测试 **Then** 4 种 IDE 检测 + 配置生成 + 零侵入验证

## Tasks / Subtasks

- [x] Task 1: 定义 IIdeAdapter 接口 (AC: #1)
- [x] Task 2: 实现 IDE 检测器 (AC: #2)
- [x] Task 3: 实现 4 个 IDE 适配器 (AC: #3-#6, #7)
  - [x] 3.1 `src/adapters/ide/claude-code.ts`
  - [x] 3.2 `src/adapters/ide/cursor.ts`
  - [x] 3.3 `src/adapters/ide/vscode-copilot.ts` — 生成 copilot-instructions.md + AGENTS.md + MCP Host 配置
  - [x] 3.4 `src/adapters/ide/codex-cli.ts`
- [x] Task 4: 更新 index.ts
- [x] Task 5: 编写测试 (AC: #8)

## Dev Notes

### IIdeAdapter 接口

```typescript
export interface IIdeAdapter {
  readonly name: string;
  detect(projectRoot: string): boolean;
  generateMcpConfig(projectRoot: string): void;
  generateInstructionFile(projectRoot: string): void;
  generateHooksConfig?(projectRoot: string): void;   // 仅 Claude Code
  generateSkills?(targetDir: string): SkillsArtifact[];  // 可选；仅 Claude Code 实现，其他 IDE 适配器不实现（FR31）
}
```

### IDE 检测策略

- Claude Code: 检查 `.claude/` 目录或 `CLAUDE.md`
- Cursor: 检查 `.cursor/` 目录
- VS Code Copilot: 检查 `.vscode/` 目录
- Codex CLI: 检查 `AGENTS.md` **且不存在 `.claude/`、`.cursor/`、`.vscode/` 等其他 IDE 专属标志**（发现#5 裁决：`AGENTS.md` 为 Copilot 和 Codex CLI 共享产物，当与任意其他 IDE 专属标志共存时将其视为共享文档而不计为 Codex 命中）

### IDE 检测优先级与冲突裁决（发现#5 裁决）

当项目中同时存在多种 IDE 痕迹时，按以下优先级顺序选择主检测结果：

| 优先级 | IDE | 检测标志 |
|--------|-----|---------|
| 1（最高）| Claude Code | `.claude/` 目录或 `CLAUDE.md` |
| 2 | Cursor | `.cursor/` 目录 |
| 3 | VS Code Copilot | `.vscode/` 目录 |
| 4（最低）| Codex CLI | `AGENTS.md` |

**冲突处理规则**：
- 自动检测命中多个 IDE 时，**不静默选择**，必须向用户展示检测到的 IDE 列表并要求确认
- `cord init --ide <name>` 允许用户显式覆盖自动检测（override 路径，`<name>` 取值：`claude-code` | `cursor` | `vscode-copilot` | `codex-cli`）
- 显式 `--ide` 优先级高于自动检测，不受上表优先级约束
- **AGENTS.md 共享文档规则**（发现#5 裁决）：`AGENTS.md` 与 `.vscode/`、`.claude/`、`.cursor/` 任意一项共存时，不计为 Codex CLI 检测命中；只有在项目中存在 `AGENTS.md` 且不存在任何其他 IDE 专属标志时，才将其计为 Codex CLI 命中

### 零侵入策略（NFR12）

生成独立的 CORD 配置文件（如 `CLAUDE.md` 中引用 `.cord/instructions.md`），不直接修改用户已有文件。

**NFR12 appendable 例外：`AGENTS.md`** — `AGENTS.md` 为 Copilot 和 Codex CLI 共享产物，属于可安全追加的共享文件类型。此例外已在共享文件处理契约中定义具体行为（create-if-absent / preserve-if-exists / explicit-conflict），与项目级零侵入分类展示板对齐。

### 共享文件处理契约（AGENTS.md 等）

对于多个 IDE 适配器可能同时写入的共享文件（如 `AGENTS.md`），采用以下策略：

- **create-if-absent**：文件不存在时创建，写入 CORD 所需内容
- **preserve-if-exists**：文件已存在时保留原内容，追加 CORD 专属配置段（以 CORD 注释标记边界）
- **explicit-conflict**：如检测到内容冲突（格式不兼容），明确提示用户，不自动覆盖

**非 TTY 行为**：在非 TTY / `--json` 自动化场景下，`preserve-if-exists` 追加操作仍应默默执行（不要求交互）；当且仅当检测到 `explicit-conflict` 时，返回结构化错误 `{ "error": "AGENTS_MD_CONFLICT", "suggestion": "..." }`。

**测试断言要求**：
- `cord init` 在 `AGENTS.md` 不存在时创建文件（create-if-absent 正例）
- `cord init` 在 `AGENTS.md` 已存在时追加 CORD 注释段，原内容不变（preserve-if-exists 正例）
- `cord init` 在格式冲突时不自动覆盖，返回 `AGENTS_MD_CONFLICT` 错误（explicit-conflict 正例）

### Project Structure Notes

- `src/adapters/ide/interfaces.ts`
- `src/adapters/ide/detector.ts`
- `src/adapters/ide/claude-code.ts`
- `src/adapters/ide/cursor.ts`
- `src/adapters/ide/vscode-copilot.ts`
- `src/adapters/ide/codex-cli.ts`

### References

- [Source: prd.md#FR2, FR4] — IDE 检测和配置生成
- [Source: prd.md#NFR12] — 零侵入
- [Source: prd.md#IDE 集成矩阵] — 4 种 IDE 能力
- [Source: epics.md#Story 5.3] — 验收标准

## Dev Agent Record

### Agent Model Used
- GPT-5.4 (copilot)
### Debug Log References
- `npm test -- --run tests/unit/adapters/ide.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm test`
### Completion Notes List
- 已新增 `IIdeAdapter`、`IdeName`、检测器与 `resolveIdeAdapter` 门面，覆盖 Claude Code / Cursor / VS Code Copilot / Codex CLI 四种 IDE 检测与冲突裁决。
- 已实现 4 个 IDE 适配器：Claude Code 生成 `.claude/rules/cord-relations.md`、`CLAUDE.md` 引导壳、`.claude/settings.json` 与 Hook 脚本；Cursor 生成 `.cursor/mcp.json` 与 `.cursor/rules/cord-relations.mdc`；VS Code Copilot 生成 `.github/copilot-instructions.md`、`.vscode/mcp.json` 与共享 `AGENTS.md` 区块；Codex CLI 生成共享 `AGENTS.md` 区块。
- 已实现零侵入写入策略：IDE 原生配置文件仅 create-if-absent / same-content no-op，冲突时抛出 `CordError` 风格的 `AdapterError`；`AGENTS.md` 作为 appendable 例外，使用 `<!-- CORD:START -->` / `<!-- CORD:END -->` 共享区块追加或替换。
- 已补充 AC #8 测试，覆盖 4 种 IDE 检测、配置生成、共享 `AGENTS.md` 追加、冲突报错与零侵入保护，并通过窄测试、全量测试、类型检查和 lint。
### File List
- _bmad-output/implementation-artifacts/code-reviews/5-3-code-review/EXPERIMENTS.md
- _bmad-output/implementation-artifacts/code-reviews/5-3-code-review/EXPERIMENT_NOTES.md
- _bmad-output/implementation-artifacts/code-reviews/5-3-code-review/PLAN.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md
- src/adapters/ide/claude-code.ts
- src/adapters/ide/codex-cli.ts
- src/adapters/ide/cursor.ts
- src/adapters/ide/detector.ts
- src/adapters/ide/index.ts
- src/adapters/ide/interfaces.ts
- src/adapters/ide/shared.ts
- src/adapters/ide/vscode-copilot.ts
- tests/unit/adapters/ide.test.ts

### Change Log

- 2026-05-18: 开始 Story 5.3 开发，状态更新为 in-progress，开发模型记录为 GPT-5.4 (copilot)。
- 2026-05-18: 完成 Story 5.3 的 IDE 适配器、检测器与测试，状态更新为 review。
