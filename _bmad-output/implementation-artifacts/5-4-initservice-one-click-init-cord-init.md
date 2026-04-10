# Story 5.4: InitService 一键初始化（cord init）

Status: ready-for-dev

## Story

As a 用户，
I want 通过 `cord init` 一键完成项目的完整初始化配置，
So that 从安装到首次使用的体验闭环 < 30 分钟，零摩擦上手。

## Acceptance Criteria (AC)

1. **Given** Story 5.3 IDE 适配器和 Story 2.1 框架适配器就绪 **When** 执行 cord init **Then** `src/services/init-service.ts` 编排完整流程（FR1）
2. **Given** 初始化 **When** 检测 IDE **Then** 自动检测并选择适配器（FR2）
3. **Given** 初始化 **When** 检测框架 **Then** 自动检测并选择适配器（FR3）
4. **Given** 初始化 **When** 生成配置 **Then** 生成 MCP 配置、指令文件、Hooks 脚本（FR4）
5. **Given** 初始化 **When** 默认配置 **Then** 生成 cord.config.yaml
6. **Given** 初始化 **When** 数据目录 **Then** 创建 .cord/ 目录
7. **Given** CLI **When** 实现 **Then** `src/cli/commands/init.ts` 使用 @clack/prompts 交互向导
8. **Given** 输出 **When** 检查 **Then** 步骤进度 + 结果摘要
9. **Given** --json **When** 传入 **Then** JSON 输出
10. **Given** 实现完毕 **When** 测试 **Then** BMAD 项目 init + 通用项目 init + IDE 检测

## Tasks / Subtasks

- [ ] Task 1: 实现 InitService (AC: #1-#6)
  - [ ] 1.1 `src/services/init-service.ts`
  - [ ] 1.2 流程：检测 IDE → 检测框架 → 生成配置 → 创建数据目录
- [ ] Task 2: 实现 CLI 命令 (AC: #7, #8, #9)
  - [ ] 2.1 `src/cli/commands/init.ts` — @clack/prompts 交互
- [ ] Task 3: 编写测试 (AC: #10)

## Dev Notes

### InitService 流程

```
1. detectIde(projectRoot) → IIdeAdapter
2. detectFramework(projectRoot) → IFrameworkAdapter
3. ideAdapter.generateMcpConfig()
4. ideAdapter.generateInstructionFile()
5. ideAdapter.generateHooksConfig?()
6. 生成 cord.config.yaml（含检测到的 framework/ide）
7. 创建 .cord/ 目录
8. 返回 InitResult
```

### @clack/prompts 交互

```typescript
import * as p from '@clack/prompts';
p.intro('🔗 CORD 初始化');
const spinner = p.spinner();
spinner.start('检测 IDE...');
// ...
p.outro('✅ CORD 初始化完成！');
```

### Project Structure Notes

- `src/services/init-service.ts`
- `src/cli/commands/init.ts`

### References

- [Source: prd.md#FR1-FR4] — 初始化需求
- [Source: epics.md#Story 5.4] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
