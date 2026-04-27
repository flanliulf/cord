---
Story: 1-2
Round: 3
Date: 2026-04-26
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 2 的两项阻塞问题已被实际关闭：CLI 模块导入不再触发 parse 副作用，覆盖率也已把 src/cli/index.ts 重新纳入 gate，`npm test`、`npm run lint`、`npm run build`、`npm run type-check`、`npm run test:coverage` 当前均通过。但本轮仍识别出 1 条功能性问题和 1 条实现时序风险，因此暂不建议通过。

## 上轮问题回顾

### 已修复

1. Round 2 / Finding #1 — CLI 顶层 parse 导致 helper 导入受 argv 污染
   - 修复位置：src/cli/index.ts、src/cli/verbose.ts、tests/unit/cli/index.test.ts
   - 修复方式：将 applyVerboseFlag 提取到无副作用模块；提取 createProgram/runCli；增加 entrypoint guard。
   - 验证结果：`process.argv = ['node', 'cord', '--foreign-flag']; await import('./dist/cli/index.js')` 现可正常输出 `import-completed`，不再触发 Commander 退出。

2. Round 2 / Finding #2 — coverage.exclude 过宽，src/cli/index.ts 脱离 gate
   - 修复位置：vitest.config.ts
   - 修复方式：将 blanket `src/**/index.ts` 排除改为显式列举纯 barrel 文件，保留 src/cli/index.ts 在统计中。
   - 验证结果：`npm run test:coverage` 当前报告包含 `cli/index.ts` 与 `cli/verbose.ts`，总覆盖率为 Statements 97.36%、Lines 97.29%。

### 仍为非阻塞待办

无。

## 新发现

### 1. [中][新] entrypoint 守卫用原始 `file://` 字符串比较，带空格的符号链接路径下 CLI 会静默不执行

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/cli/index.ts:32-34` 使用 `import.meta.url === \`file://${process.argv[1]}\`` 进行入口判断，没有做 URL 规范化。
  - 对照组：直接执行 `node ./dist/cli/index.js --help`，退出码为 0，帮助输出大小为 218 字节。
  - 定向复现：把 `dist/cli/index.js` 建成带空格文件名的符号链接后执行 `node "$tmp/cord link.js" --help`，退出码同样为 0，但输出大小为 0，说明 `runCli()` 根本没有触发。

- **影响**
  - CLI 通过带空格路径、某些符号链接路径或其他未规范化入口执行时，可能直接静默退出。
  - 当前入口守卫会把“执行成功但什么都没发生”伪装成正常行为，定位成本高。

- **建议**
  - 用 `pathToFileURL(process.argv[1]).href` 这类规范化方式比较，而不是直接拼接 `file://` 字符串。
  - 增加一个覆盖带空格或符号链接路径的入口回归测试。

### 2. [低][新] `runCli` 在 `parse()` 之后才开启 verbose，真实命令执行期间仍拿不到 `--verbose`

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/cli/index.ts:27-29` 的顺序是 `program.parse(process.argv)` 先执行，`applyVerboseFlag(program.opts(), process.env)` 后执行。
  - Commander 最小复现使用同样顺序时，`--verbose` 运行结果为 `{\"phase\":\"action\",\"verbose\":false}`，只有 parse 结束后才变成 `{\"phase\":\"after-parse\",\"verbose\":true}`。
  - `tests/unit/cli/index.test.ts:63-98` 仅验证了 runCli 返回后会调用 `setVerbose(true)`，没有覆盖 action 执行期间的日志时序。

- **影响**
  - 当前仓库一旦增加真实命令 action，action 内部的 debug 日志仍会在 `--verbose` 下被吞掉。
  - 这会让 CLI skeleton 的 verbose 接线在未来扩展命令时再次退化。

- **建议**
  - 在进入 Commander action 之前就决定 verbose 状态，例如先从 argv / env 预判并设置 logger，再执行 parse。
  - 增加一个带 action 的回归测试，验证命令执行期间 debug 已被开启。

## 验证摘要

- `npm test` ✅（51 / 51）
- `npm run lint` ✅
- `npm run build` ✅
- `npm run type-check` ✅
- `npm run test:coverage` ✅
  - 总覆盖率：Statements 97.36%，Lines 97.29%
  - `cli/index.ts` 已重新纳入统计，当前未覆盖行为为入口守卫分支
- 额外复核：
  - 导入副作用修复验证：`process.argv = ['node', 'cord', '--foreign-flag']; await import('./dist/cli/index.js')` -> `import-completed`
  - 入口守卫稳健性复现：直接路径执行有输出；带空格符号链接路径执行退出码 0 但无输出
  - verbose 时序复现：Commander action 阶段 `verbose=false`，parse 结束后才变为 `true`

## 通过项

- Round 2 的两项阻塞项已经被当前实现关闭：导入无副作用、覆盖率口径已收窄且重新覆盖 CLI 入口。
- `src/cli/verbose.ts` 已将 helper 抽离为无副作用模块，CLI 测试数量从 5 个增至 11 个。
- `npm test`、`npm run lint`、`npm run build`、`npm run type-check`、`npm run test:coverage` 当前均通过。

## 结论

- **结论：不通过**
- **阻塞项**：
  - entrypoint 守卫在带空格符号链接路径下会误判，CLI 可静默不执行
- **建议**：先修正入口守卫的 URL 规范化；若同时把 verbose 提前到 action 执行前开启，再触发第 4 轮复审。
