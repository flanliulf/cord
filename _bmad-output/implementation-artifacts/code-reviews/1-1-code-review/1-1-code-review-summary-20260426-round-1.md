---
Story: 1-1
Round: 1
Date: 2026-04-26
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。`npm test`、`npm run lint`、`npm run build`、`npm run type-check` 均通过，三层审查均正常返回；但当前仍存在 2 个中优先级入口/发布问题和 2 个低优先级工程质量问题，暂不建议直接通过。

## 新发现

### 1. [中] CLI 入口同时承担包导出与可执行入口，且缺少 shebang/直接运行保护

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `package.json:7-10` 将 `./dist/cli/index.js` 同时配置为 `bin.cord` 和 `exports["."]`
  - `src/cli/index.ts:1-10` 在模块顶层直接调用 `program.parse(process.argv)`
  - `dist/cli/index.js:1-5` 的构建产物首行不是 shebang，而是普通 JS 代码

- **影响**
  - 全局安装后的 `cord` 在类 Unix 环境下可能无法被直接执行
  - 任何导入根导出的调用方都可能意外触发 CLI 参数解析，出现副作用或异常退出

- **建议**
  - 在 CLI 入口添加 `#!/usr/bin/env node`
  - 将 CLI runner 与包根导出分离，或仅在 direct-run 场景执行 `program.parse`
  - 补一个安装后或构建后二进制 smoke test

### 2. [中] 发布流程没有 prepack/prepare 构建保护

- **来源**：edge
- **分类**：patch

- **证据**
  - `package.json:12-23` 只声明了 `files: ["dist"]` 与 `build` 脚本，没有 `prepack` / `prepare` / `prepublishOnly`
  - `.gitignore:2` 忽略了 `dist/`

- **影响**
  - 在干净工作树上直接执行 `npm pack` 或 `npm publish` 时，可能打出缺失或陈旧的可执行产物
  - 发布结果依赖人工先执行 build，容易在 CI 或手工发布时漏掉

- **建议**
  - 增加 `prepack` 或 `prepublishOnly`，确保打包前强制构建
  - 在发布流水线中校验 tarball 内实际包含 `dist/cli/index.js`

### 3. [低] type-check 实际没有覆盖 tests 与 TypeScript 配置文件

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `tsconfig.json:21-22` 只覆盖 `src/**/*.ts`，并显式排除 `tests`
  - `tests/unit/setup.test.ts:1-7`、`tsup.config.ts:1-15`、`vitest.config.ts:1-15` 都是当前仓库中的 TypeScript 文件，但不在 type-check 覆盖范围内

- **影响**
  - `npm run type-check` 通过并不代表测试代码和配置文件的 TypeScript 语义正确
  - 后续在测试或配置中引入类型错误时，CI 可能继续绿灯

- **建议**
  - 扩大 `include` 范围，或新增单独的 `tsconfig.check.json` 覆盖 tests 与 `*.config.ts`
  - 把这些文件纳入持续集成的类型检查门禁

### 4. [低] MCP 入口构建成功但运行时是静默空实现

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/mcp/server.ts:1-2` 整个入口文件只有注释，没有任何导出、报错或占位逻辑
  - `npm run build` 仍然产出了 `dist/mcp/server.js`

- **影响**
  - 调用方执行该入口时只能得到静默结束的空实现，容易把“未实现”误判为“可运行”
  - 后续联调时问题会推迟到运行阶段才暴露

- **建议**
  - 至少抛出明确的 `not implemented` 错误，或输出到 stderr 的占位提示
  - 如果该入口尚未对外承诺，可暂时不要把它纳入可执行构建入口

## 验证摘要

- `npm test` ✅（1 / 1）
- `npm run lint` ✅
- `npm run build` ✅
- `npm run type-check` ✅
- 定向复现 ✅
  - 检查 `dist/cli/index.js` 首行，确认构建产物没有 shebang
  - 检查 `package.json`，确认同一文件同时承担 `bin` 与根导出
  - 检查 `src/mcp/server.ts`，确认 MCP 入口当前只有注释占位

## 通过项

- `package.json` 已正确设置 `"type": "module"`，基础脚本与核心依赖已声明
- `tsconfig.json` 已启用 strict、ESNext target、NodeNext module resolution
- `npm test`、`npm run lint`、`npm run build`、`npm run type-check` 在当前工作树均通过
- 基础目录结构、测试目录和大部分 facade/placeholder 文件已按 Story 建立
