---
Story: 1-2
Round: 4
Date: 2026-04-27
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

本轮为复审，重点验证 Round 3 对 entrypoint 守卫的修复是否真正关闭阻塞项，并确认已降级的 verbose 时序问题没有恶化。`npm test`、`npm run lint`、`npm run build`、`npm run type-check`、`npm run test:coverage` 当前仍全部通过，普通直接入口和 foreign-flag 导入场景也正常；但独立验证显示 Round 3 / Finding #1 仍未关闭，同时本轮修复又引入了一个新的导入时崩溃回归，因此仍不建议通过。

## 上轮问题回顾

### 已修复

无。

### 仍为非阻塞待办

1. Round 3 / Finding #2 — `runCli` 在 `parse()` 之后才开启 verbose
   - 当前状态：仍然存在，但 Round 3 evaluation 已明确降级为 P2 / CR TODO。
   - 本轮复核：当前 skeleton 仍无 `.action(...)` 注册，问题没有扩大，也未形成新的 AC 违背。
   - 处理建议：继续作为后续引入首条 action 时的待办，不在本轮重复阻塞。

### 仍未关闭的阻塞项

1. Round 3 / Finding #1 — entrypoint 守卫对符号链接路径的处理仍然不正确
   - 修复位置：`src/cli/index.ts`
   - 本轮修复方式：将 `file://${process.argv[1]}` 改为 `pathToFileURL(process.argv[1]).href`
   - 验证结果：
     - `node ./dist/cli/index.js --help` -> exit 0，输出 218 字节
     - 通过带空格文件名的符号链接执行同一入口 -> exit 0，输出 0 字节
   - 结论：该修复只解决了 URL 百分号编码，不处理 symlink / realpath 归一化，Round 3 的阻塞项仍然存在。

## 新发现

### 1. [中][新] entrypoint 守卫在 `process.argv[1]` 缺失时会在模块求值阶段抛 `TypeError`

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/cli/index.ts:35` 顶层直接执行 `pathToFileURL(process.argv[1]).href`，没有任何判空保护。
  - 定向复现：通过 `node --input-type=module` 从 stdin 导入 `./dist/cli/index.js` 时，直接抛出 `TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received undefined`。
  - 对照组：在 `process.argv = ['node', 'cord', '--foreign-flag']` 的普通导入场景下，模块仍可正常输出 `import-completed`。

- **影响**
  - 这次修复把先前已经关闭的“导入无副作用”问题以更窄但更直接的方式重新带回来了：在 stdin / eval / 某些嵌入式导入环境中，模块会在加载阶段直接崩溃。
  - 顶层求值抛错会让测试、脚本化消费或未来复用 CLI helper 的场景变得脆弱。

- **建议**
  - 先判断 `process.argv[1]` 是否存在，再进行 URL 转换与比较。
  - 入口守卫需要同时解决“非 main 导入不抛错”和“symlink / 带空格路径仍能命中”两个约束，再补一个覆盖 `argv[1]` 缺失场景的回归测试。

## 验证摘要

- `npm test` ✅（51 / 51）
- `npm run lint` ✅
- `npm run build` ✅
- `npm run type-check` ✅
- `npm run test:coverage` ✅
  - 总覆盖率：Statements 97.36%，Branches 96.29%，Functions 100%，Lines 97.29%
  - `cli/index.ts` 当前覆盖率：Statements / Lines 85.71%，未覆盖入口守卫执行分支
- 额外复核：
  - 直接执行入口：`node ./dist/cli/index.js --help` -> exit 0，输出 218 字节
  - foreign-flag 导入：`process.argv = ['node', 'cord', '--foreign-flag']; await import('./dist/cli/index.js')` -> `import-completed`
  - 带空格符号链接入口：exit 0，输出 0 字节
  - stdin 导入：抛 `TypeError [ERR_INVALID_ARG_TYPE]`

## 通过项

- Round 2 的导入副作用修复在“普通非 main 导入 + foreign flag”路径上仍保持关闭。
- 覆盖率 gate、测试、lint、build、type-check 均维持通过，AC8 当前仍满足。
- `src/cli/verbose.ts` 的无副作用 helper 拆分，以及 `createProgram` / `runCli` 结构仍然成立。

## 结论

- **结论：不通过**
- **阻塞项**：
  - Round 3 / Finding #1 仍未关闭：带空格符号链接路径下 CLI 仍会静默不执行
  - 本轮新增回归：`process.argv[1]` 缺失时模块导入阶段直接抛 `TypeError`
- **建议**：下一轮修复应把入口守卫统一收敛为“先判空，再对真实路径做归一化，再比较 URL”，并补两类回归测试：符号链接入口与 `argv[1]` 缺失导入。verbose 时序问题继续保留为 CR TODO，不阻塞本 Story 的本轮结论。