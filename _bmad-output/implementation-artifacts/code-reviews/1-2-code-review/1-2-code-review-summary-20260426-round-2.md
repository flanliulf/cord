---
Story: 1-2
Round: 2
Date: 2026-04-26
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的两项原始问题按字面均已关闭：`--verbose` 不再依赖 `preAction`，覆盖率报告数值也已提升到 100%。`npm test`、`npm run lint`、`npm run build`、`npm run type-check`、`npm run test:coverage` 当前均通过。但修复方式引入了 2 条新的中优先级问题：CLI 入口文件在导入时会直接解析外部 `argv`，以及覆盖率排除规则过宽把含逻辑的 `src/cli/index.ts` 一并移出统计。本轮不建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `--verbose` 接线在 CLI 入口无效
   - 修复位置：`src/cli/index.ts`
   - 修复方式：移除 `preAction`，改为 `program.parse(process.argv)` 后调用 `applyVerboseFlag(program.opts(), process.env)`。
   - 验证结果：`tests/unit/cli/index.test.ts` 新增 5 个用例，`npm test` 通过（45 / 45）。

2. Round 1 / Finding #2 — 整体覆盖率 82.35% < AC8 要求的 90%
   - 修复位置：`vitest.config.ts`
   - 修复方式：新增 `coverage.exclude` 规则，并补充 CLI 测试。
   - 验证结果：`npm run test:coverage` 当前报告为 100%。

### 仍为非阻塞待办

无。

## 新发现

### 1. [中][新] CLI 模块顶层 `parse()` 使 helper 导入受外部 `argv` 污染并可能直接退出

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/cli/index.ts:12-17` 在模块顶层直接执行 `program.parse(process.argv)`，随后才导出 `applyVerboseFlag`。
  - `tests/unit/cli/index.test.ts:1-3` 为了测试 helper 直接导入 `src/cli/index.ts`，因此每次导入都会先触发 parse 副作用。
  - 定向复现：`process.argv = ['node', 'cord', '--vitest-foreign-flag']; await import('./dist/cli/index.js')` 会输出 `error: unknown option '--vitest-foreign-flag'` 并以退出码 1 结束。

- **影响**
  - 单测、脚手架、IDE 插件或任何只想复用 helper 的导入方都会被当前进程 `argv` 污染，遇到未知参数时可在导入阶段直接退出。
  - CLI 入口逻辑与可测试 helper 强耦合，后续扩展命令或更换测试运行器时稳定性差。

- **建议**
  - 将 `program.parse(process.argv)` 移入仅 CLI 主入口执行的 `main()` / `runCli()`，并加上 entrypoint 判断保护。
  - 将 `applyVerboseFlag` 抽到无副作用模块，测试直接导入 helper，而不是执行入口文件。

### 2. [中][新] `coverage.exclude` 规则过宽，把含逻辑的 `src/cli/index.ts` 一并排除

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `vitest.config.ts:12-16` 使用 `src/**/index.ts` 作为 blanket exclusion，注释却声明该规则用于纯 re-export facade 文件。
  - `src/cli/index.ts:1-30` 实际包含 `Command` 初始化、`parse()` 调用和 `applyVerboseFlag()` 执行，不是纯 barrel。
  - `npm run test:coverage` 当前报告显示 `All files 100%`，但统计列表中已不再包含 `src/cli/index.ts`，说明 CLI 入口逻辑已脱离 coverage gate。

- **影响**
  - AC8 的达标建立在排除真实逻辑文件上，覆盖率指标无法再衡量 CLI verbose 接线路径是否受测试保护。
  - 后续对 CLI 入口的回归可在不触发覆盖率门禁的情况下进入评审。

- **建议**
  - 将排除规则收窄到真正的 barrel 文件目录，而不是 blanket `src/**/index.ts`。
  - 若需要测试 helper，可把逻辑拆到非 `index.ts` 的纯函数模块中，同时让 `src/cli/index.ts` 继续纳入覆盖率统计。

## 验证摘要

- `npm test` ✅（45 / 45）
- `npm run lint` ✅
- `npm run build` ✅
- `npm run type-check` ✅
- `npm run test:coverage` ✅
- 额外复核：
  - 导入副作用复现：`process.argv = ['node', 'cord', '--vitest-foreign-flag']; await import('./dist/cli/index.js')` -> `unknown option`，退出码 1
  - 覆盖率口径复核：当前报告为 100%，但 `src/cli/index.ts` 已不在统计列表中

## 通过项

- 上轮两个原始问题已按字面关闭：`--verbose` 不再依赖 `preAction`，覆盖率报告数值已提升到 100%。
- `tests/unit/cli/index.test.ts` 已新增 5 个用例，覆盖 `applyVerboseFlag` 的显式参数与环境变量分支。
- `npm test`、`npm run lint`、`npm run build`、`npm run type-check`、`npm run test:coverage` 当前均通过。

## 结论

- **结论：不通过**
- **阻塞项**：
  - CLI 入口文件不可安全导入，helper 测试/复用受外部 `argv` 污染
  - 覆盖率门槛通过 blanket exclusion 达成，`src/cli/index.ts` 实际脱离 gate
- **建议**：先拆分无副作用的 CLI helper 并收窄 `coverage.exclude`，再进行第 3 轮复审。
