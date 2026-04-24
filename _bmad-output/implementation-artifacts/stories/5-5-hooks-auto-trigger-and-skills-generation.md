# Story 5.5: Hooks 文档变更自动触发与 Skills 生成

Status: ready-for-dev

## Story

As a 用户，
I want 文档变更落盘时自动触发关系检查，且 AI Agent 有 Skills 定义文件引导它调用 CORD，
So that 日常开发中无需手动操作，AI Agent 自动完成影响分析和同步建议。

## Acceptance Criteria (AC)

1. **Given** Story 5.4 init 就绪 **When** Claude Code Hooks **Then** 文档变更落盘时触发 analyze_impact（FR29）；Skills 生成由 Story 5.4 InitService 通过 `IIdeAdapter.generateSkills?()` 调用本 Story `SkillsGenerator` 实现（FR31 编排 owner = InitService）
2. **Given** 不支持 Hooks 的 IDE **When** 配置 **Then** 指令文件引导 Agent 主动调用 CORD
3. **Given** Skills 生成 **When** 实现 **Then** `src/adapters/ide/skills-generator.ts` 生成 Skills 定义文件（FR31）
4. **Given** Skills 文件 **When** 检查 **Then** 覆盖 4 个意图场景
5. **Given** Skills 文件 **When** 内容 **Then** 包含触发条件、MCP Tool 调用序列、预期输出格式
6. **Given** MCP 验证 **When** 在 3 大 IDE **Then** 验证通过（NFR11）
7. **Given** 实现完毕 **When** 测试 **Then** Hooks 触发 + Skills 格式 + IDE MCP 验证

## Tasks / Subtasks

- [ ] Task 1: 生成 Claude Code Hooks 脚本 (AC: #1)
- [ ] Task 2: 生成指令文件引导 (AC: #2)
- [ ] Task 3: 实现 Skills 生成器 (AC: #3, #4, #5)
  - [ ] 3.1 `src/adapters/ide/skills-generator.ts`
  - [ ] 3.2 4 个 Skills：影响分析、关系查询、图谱初始化、同步建议
- [ ] Task 4: 编写测试 (AC: #6, #7)

## Dev Notes

### Claude Code Hooks 脚本

```json
// .claude/settings.json hooks 配置示例
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "command": "cord impact --json \"$TOOL_INPUT_PATH\" 2>/dev/null || true"
    }]
  }
}
```

### Skills 文件结构（4 个意图场景）

Skills 文件须在"预期输出格式"字段中直接引用 `src/mcp/tools/schemas.ts` 中的命名 schema（不使用自然语言描述），以确保 NFR10 output schema 快照与 FR31 Skills 输出格式保持统一。

| 场景 | 触发条件 | Tool | 预期输出 schema |
|------|---------|------|----------------|
| 影响分析 | 文档编辑后 | `analyze_impact` | `AnalyzeImpactResult` |
| 关系查询 | 用户询问文档关系 | `query_relations` | `QueryRelationsResult`（含 `relationId`） |
| 图谱初始化 | 首次使用或重建 | `init_graph` | `InitGraphResult` |
| 同步建议 | 文档编辑后（单文档调用） | `sync_docs` | `SyncDocsResult`（Story 5.1 单文档契约，多文档时依次调用） |

### Project Structure Notes

- `src/adapters/ide/skills-generator.ts`
- Claude Code hooks 脚本模板

### References

- [Source: prd.md#FR29, FR31] — Hooks 和 Skills
- [Source: prd.md#NFR11] — IDE 兼容性验证
- [Source: epics.md#Story 5.5] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
