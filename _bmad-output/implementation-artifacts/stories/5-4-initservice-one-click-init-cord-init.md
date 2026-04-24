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
9. **Given** `--json` **When** 在非 TTY / 自动化场景下传入 **Then** 跳过 @clack/prompts 交互向导，直接以机器可读 JSON 格式输出 InitResult（不混入进度文本）
10. **Given** 实现完毕 **When** 测试 **Then** BMAD 项目 init + 通用项目 init + IDE 检测
11. **Given** 自动检测命中多个 IDE **When** 执行 cord init **Then** 展示检测到的 IDE 列表并通过交互向导要求用户选择；`--ide <name>` 显式覆盖自动检测（FR2，与 Story 5.3 检测优先级规则一致）
12. **Given** `--format json` **When** 传入 **Then** 生成 cord.config.json 而非 cord.config.yaml（对齐架构决策 D6）
13. **Given** `--json` + 非 TTY / 自动化场景 + 自动检测命中多个 IDE **When** 执行 cord init **Then** 返回机器可读结构化错误 `{ "error": "AMBIGUOUS_IDE", "candidates": ["..."], "suggestion": "请使用 --ide \u6807志显式指定 IDE"}` 并退出，不进入交互向导（解 AC #9 与 AC #11 在非 TTY 场景下的冲突）14. **Given** IDE 适配器支持 Skills 生成 **When** 执行 cord init **Then** 调用 `ideAdapter.generateSkills()` 并将 Skills 文件写入目标目录（FR31）；不支持 Skills 生成的 IDE 适配器跳过此步骤
## Tasks / Subtasks

- [ ] Task 1: 实现 InitService (AC: #1-#6, #14)
  - [ ] 1.1 `src/services/init-service.ts`
  - [ ] 1.2 流程：检测 IDE → 检测框架 → 生成配置 → 创建数据目录
  - [ ] 1.3 如果 `ideAdapter.generateSkills` 存在，调用并将产物写入目标目录（AC: #14）
- [ ] Task 2: 实现 CLI 命令 (AC: #7, #8, #9, #11, #13)
  - [ ] 2.1 `src/cli/commands/init.ts` — @clack/prompts 交互；检测多 IDE 冲突提示；`--ide` override；`--format json` 生成 cord.config.json；`--json` 跳过交互并输出机器可读 JSON；非 TTY + 多命中时返回 `AMBIGUOUS_IDE` 结构化错误（AC: #13）
- [ ] Task 3: 编写测试 (AC: #10, #11, #12, #13)
- [ ] Task 4: Skills 生成测试 (AC: #14) — 验证 Claude Code 适配器调用 generateSkills() 并产出居正 Skills 文件；验证其他 IDE 适配器居正跳过 Skills 步骤

## Dev Notes

### InitService 流程

```
1. detectIde(projectRoot) → DetectionResult
   // DetectionResult: { matches: IdeMatch[], selected?: IdeMatch, ambiguous: boolean }
   // IdeMatch: { name: IdeType, confidence: 'explicit' | 'detected' }
   // ambiguous=true 时 selected 为 undefined
2. detectFramework(projectRoot) → IFrameworkAdapter
3. 如果 DetectionResult.ambiguous=true 且非 TTY：返回 AMBIGUOUS_IDE 错误（AC: #13）
4. 如果 DetectionResult.ambiguous=true 且 TTY：通过交互向导要求用户选择（AC: #11）
5. ideAdapter.generateMcpConfig()
6. ideAdapter.generateInstructionFile()
   // AGENTS.md 共享文件特殊处理（NFR12 appendable 例外，与 Story 5.3 共享文件处理契约一致）：
   // - 文件不存在：create-if-absent，写入 CORD 所需内容
   // - 文件已存在：preserve-if-exists，追加 CORD 专属注释段（<!-- CORD:START --> ... <!-- CORD:END -->）
   // - 格式冲突时：explicit-conflict，非 TTY 下返回 AGENTS_MD_CONFLICT 结构化错误，不自动覆盖
7. ideAdapter.generateHooksConfig?()
8. ideAdapter.generateSkills?(targetDir) — 仅支持 Skills 生成的适配器（当前仅 Claude Code）产出 Skills 文件；其他适配器跳过此步骤（AC: #14）
9. 生成配置文件：`--format json` 时生成 cord.config.json，默认生成 cord.config.yaml（均包含检测到的 framework/ide 字段）
10. 创建 .cord/ 目录
11. 返回 InitResult
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
