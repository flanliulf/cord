# CR TODO Backlog

跨 Story 延迟改进事项追踪。仅记录非阻塞性问题，阻塞项须在当前 Story CR 流程内解决。

## 统计摘要

| 状态 | 数量 |
|------|------|
| Open | 4 |
| In Progress | 0 |
| Resolved | 0 |
| **合计** | **4** |

---

## Open Items

---

### TODO-001

- **标题**：CLI 与包根导出职责分离 + 二进制 smoke test
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：refactor
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #1 衍生）
- **涉及文件**：
  - `package.json`
  - `src/cli/index.ts`
- **问题描述**：`package.json` 中 `bin.cord` 与 `exports["."]` 同时指向 `dist/cli/index.js`，CLI 可执行入口与包根导出职责混用。此外缺少对已构建 CLI 二进制的 smoke test（如 `node dist/cli/index.js --version`）。
- **建议时机**：首次发布前的发布策略 Story（引入包导出结构重构时一并处理）
- **解决记录**：—

---

### TODO-002

- **标题**：缺少 `prepack`/`prepublishOnly` 与 tarball 校验
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #2）
- **涉及文件**：
  - `package.json`
- **问题描述**：`package.json` 的 `scripts` 中无 `prepack`、`prepare` 或 `prepublishOnly` 钩子。`dist/` 被 `.gitignore` 排除，仅靠 `files: ["dist"]` 声明白名单，不触发构建，存在发布时产物为空的风险。
- **建议时机**：首次发布前的专门 Story（配套 CI 流水线、版本管理、tarball 校验一揽子引入）
- **解决记录**：—

---

### TODO-003

- **标题**：type-check 未覆盖 `tests/` 与配置文件
- **状态**：open
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #3）
- **涉及文件**：
  - `tsconfig.json`
  - `tests/`
  - `tsup.config.ts`
  - `vitest.config.ts`
- **问题描述**：`tsconfig.json` 的 `include` 仅覆盖 `src/**/*.ts`，`tests/`、`tsup.config.ts`、`vitest.config.ts` 均被排除，导致 `npm run type-check` 无法检测这些文件中的类型错误。
- **建议时机**：引入真实测试代码的 Story（1-2 或 1-3），通过新增 `tsconfig.check.json`（`include` 扩展至 `tests/` 和配置文件）统一处理
- **解决记录**：—

---

### TODO-004

- **标题**：MCP 入口为静默空实现，缺少防御性占位输出
- **状态**：open
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #4）
- **涉及文件**：
  - `src/mcp/server.ts`
- **问题描述**：`src/mcp/server.ts` 当前为仅含注释的占位文件（符合 Task 2.5 显式要求），构建后 `node dist/mcp/server.js` 静默退出（exit code 0），运维层面难以区分"正常启动"与"空实现静默退出"。
- **建议时机**：Epic 5 启动时，将占位文件升级为防御性实现（如 `throw new Error('not implemented')` 或向 stderr 输出提示信息）
- **解决记录**：—

---

## Resolved Items

（暂无）
