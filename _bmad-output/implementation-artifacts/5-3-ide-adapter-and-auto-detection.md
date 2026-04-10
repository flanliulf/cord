# Story 5.3: IDE 适配器与自动检测

Status: ready-for-dev

## Story

As a 用户，
I want 系统自动检测我使用的 AI IDE 类型，
So that `cord init` 可以为我的 IDE 生成正确的配置文件。

## Acceptance Criteria (AC)

1. **Given** 需要支持多 IDE **When** 定义接口 **Then** `src/adapters/ide/interfaces.ts` 定义 IIdeAdapter
2. **Given** 接口定义 **When** 实现检测 **Then** `src/adapters/ide/detector.ts` 检测 4 种 IDE（FR2）
3. **Given** Claude Code **When** 实现适配 **Then** Hooks + CLAUDE.md + MCP 配置
4. **Given** Cursor **When** 实现适配 **Then** .cursor/mcp.json + .cursor/rules/
5. **Given** VS Code Copilot **When** 实现适配 **Then** copilot-instructions.md + MCP Host
6. **Given** Codex CLI **When** 实现适配 **Then** AGENTS.md（基础集成）
7. **Given** 注入策略 **When** 检查 **Then** 独立文件注入，不修改已有配置（NFR12）
8. **Given** 实现完毕 **When** 测试 **Then** 4 种 IDE 检测 + 配置生成 + 零侵入验证

## Tasks / Subtasks

- [ ] Task 1: 定义 IIdeAdapter 接口 (AC: #1)
- [ ] Task 2: 实现 IDE 检测器 (AC: #2)
- [ ] Task 3: 实现 4 个 IDE 适配器 (AC: #3-#6, #7)
  - [ ] 3.1 `src/adapters/ide/claude-code.ts`
  - [ ] 3.2 `src/adapters/ide/cursor.ts`
  - [ ] 3.3 `src/adapters/ide/vscode-copilot.ts`
  - [ ] 3.4 `src/adapters/ide/codex-cli.ts`
- [ ] Task 4: 更新 index.ts
- [ ] Task 5: 编写测试 (AC: #8)

## Dev Notes

### IIdeAdapter 接口

```typescript
export interface IIdeAdapter {
  readonly name: string;
  detect(projectRoot: string): boolean;
  generateMcpConfig(projectRoot: string): void;
  generateInstructionFile(projectRoot: string): void;
  generateHooksConfig?(projectRoot: string): void;  // 仅 Claude Code
}
```

### IDE 检测策略

- Claude Code: 检查 `.claude/` 目录或 `CLAUDE.md`
- Cursor: 检查 `.cursor/` 目录
- VS Code Copilot: 检查 `.vscode/` 目录
- Codex CLI: 检查 `AGENTS.md`

### 零侵入策略（NFR12）

生成独立的 CORD 配置文件（如 `CLAUDE.md` 中引用 `.cord/instructions.md`），不直接修改用户已有文件。

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
### Debug Log References
### Completion Notes List
### File List
