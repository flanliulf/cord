# CORD 开发指南

**生成日期：** 2026-05-21  
**扫描模式：** DP Deep Scan

## 前置条件

- Node.js >= 20 LTS
- npm
- macOS/Linux/Windows 均应可运行；跨平台行为由 workflow 覆盖

## 安装依赖

```bash
npm install
```

## 常用命令

| 命令                    | 用途                              |
| ----------------------- | --------------------------------- |
| `npm run build`         | 使用 tsup 构建 ESM 输出和 `.d.ts` |
| `npm test`              | 运行 Vitest 测试套件              |
| `npm run test:watch`    | 进入 watch 模式                   |
| `npm run test:coverage` | 生成覆盖率报告                    |
| `npm run lint`          | ESLint 检查                       |
| `npm run format:check`  | Prettier 格式检查                 |
| `npm run type-check`    | TypeScript 类型检查               |
| `npm run smoke:bin`     | 构建后检查 CLI 版本输出           |
| `npm run pack:check`    | npm pack dry run                  |

## 本地验证 CLI

构建后使用 dist 入口：

```bash
npm run build
node dist/cli/index.js --help
node dist/cli/index.js status
```

如果要在示例项目中验证扫描，可使用测试 fixture 或临时项目目录，避免污染真实工作区的 `.cord/`。

## 本地验证 MCP

MCP Server 的构建入口是 `dist/mcp/server.js`。通常不直接手动调用，而是通过 `cord init --ide <name>` 生成 IDE MCP 配置后由 MCP Host 启动。

调试 MCP 时要注意：stdout 是 JSON-RPC 通道，日志必须走 stderr。不要在 MCP server 正常运行路径中使用 `console.log`。

## 代码约定

| 约定          | 要求                                                  |
| ------------- | ----------------------------------------------------- |
| 模块系统      | ESM only，源码 import 本地模块时带 `.js` 后缀         |
| Node 内置模块 | 使用 `node:` 前缀                                     |
| 类型安全      | `strict: true`，公共 API 显式返回类型                 |
| 错误类型      | 使用 `CordError` 子类，提供 code、suggestion、context |
| Service 层    | 不调用 `console.log` 或 `process.exit`                |
| Repository 层 | 同步 API，负责数据库字段 mapper                       |
| CLI 层        | 延迟创建 Service；输入错误在初始化存储前返回          |
| MCP 层        | stdout 专供 JSON-RPC，日志走 stderr                   |

## 新增 CLI 命令流程

1. 在 `src/cli/commands/` 新增命令工厂。
2. 使用依赖注入参数暴露 `cwd`、`serviceFactory`、stdout/stderr。
3. 在 action 中先做输入清理、路径归一化和 Zod 验证。
4. 再创建 Service 或 Repository。
5. 分别实现人类可读输出与 `--json` 输出。
6. 添加 unit test 覆盖成功、配置错误、运行时错误、资源关闭。
7. 如命令是用户可见能力，更新 [cli-reference.md](cli-reference.md)。

## 新增 MCP Tool 流程

1. 在 `src/mcp/tools/schemas.ts` 定义 input/output Zod schema。
2. 导出 JSON Schema 并加入 `MCP_TOOL_SCHEMAS`。
3. 在 `src/mcp/tools/` 新增 register 函数。
4. 在 `src/mcp/tools/index.ts` 导出。
5. 在 `src/mcp/server.ts` 注册 Tool。
6. 保持 Tool 输出 `{ content, structuredContent }`。
7. 添加 MCP unit/integration test。
8. 更新 [mcp-tools-reference.md](mcp-tools-reference.md)。

## 新增框架适配器流程

1. 实现 `IFrameworkAdapter`，优先继承 `AbstractFrameworkAdapter`。
2. 定义框架检测信号、文档类型和预设关系。
3. 不修改核心扫描流程；通过 adapter registry 接入。
4. 添加检测、文档分类、扫描路径、预设关系测试。
5. 更新 [adapter-guide.md](adapter-guide.md)。

## 测试策略

| 测试层      | 目录                       | 覆盖重点                                           |
| ----------- | -------------------------- | -------------------------------------------------- |
| Unit        | `tests/unit/cli/`          | 命令解析、输出、错误码、entrypoint guard           |
| Unit        | `tests/unit/services/`     | 查询、影响分析、扫描、导出、状态、初始化、关系管理 |
| Unit        | `tests/unit/repositories/` | SQLite CRUD、迁移、事务、mapper                    |
| Unit        | `tests/unit/scanner/`      | AST pipeline、规则、生命周期检测                   |
| Unit        | `tests/unit/adapters/`     | BMAD/Generic framework adapter、IDE adapter        |
| Integration | `tests/integration/cli/`   | 真实 CLI 行为与 fixture 项目                       |
| Integration | `tests/integration/mcp/`   | MCP Tool 列表、schema、端到端调用                  |

覆盖率门禁为 80%。`src/cli/index.ts` 不在覆盖率排除列表中，因为它包含真实入口逻辑。

## 发布与打包

`package.json` 只发布 `dist`。发布前应至少执行：

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run smoke:bin
npm run pack:check
```

semantic-release 与 npm provenance 由 release workflow 管理。

## 常见排障

| 问题                         | 排查方向                                             |
| ---------------------------- | ---------------------------------------------------- |
| CLI 找不到命令               | 确认已运行 `npm run build`，检查 `dist/cli/index.js` |
| ESM import 失败              | 检查相对 import 是否带 `.js` 后缀                    |
| MCP Host 无响应              | 检查 stdout 是否被日志污染；日志应写 stderr          |
| SQLite native addon 问题     | 重新安装依赖，确认 Node 版本 >= 20                   |
| `cord status` 意外创建数据库 | 检查只读命令是否在校验前创建 Repository              |
| Windows 路径异常             | 检查路径归一化和 project-root 边界判断               |
