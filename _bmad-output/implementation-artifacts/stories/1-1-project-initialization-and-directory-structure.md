# Story 1.1: 项目初始化与目录结构搭建

Status: done

## Story

As a 开发者，
I want 一个完整配置好的 TypeScript/Node.js 项目骨架（含 tsup 构建、Vitest 测试、ESLint、Prettier），
So that 我可以立即开始编写符合架构规范的功能代码。

## Acceptance Criteria (AC)

1. **Given** 一个空的项目目录 **When** 执行项目初始化 **Then** 生成完整的 D5 目录结构（src/ 下 cli/、mcp/、services/、repositories/、scanner/、adapters/、schemas/、utils/、types/ 全部就位）
2. **Given** 初始化完成 **When** 检查 package.json **Then** 配置 `"type": "module"` 且所有核心依赖已声明
3. **Given** 初始化完成 **When** 检查 tsconfig.json **Then** 启用 strict 模式、ESNext target、NodeNext module resolution
4. **Given** 初始化完成 **When** 执行 `npm run build` **Then** tsup 成功编译 ESM 输出
5. **Given** 初始化完成 **When** 执行 `npm test` **Then** Vitest 运行通过（含一个占位测试）
6. **Given** 初始化完成 **When** 执行 `npm run lint` **Then** ESLint 检查通过
7. **Given** 初始化完成 **When** 检查各架构层 **Then** 每个层的 index.ts 门面文件已创建（空导出）
8. **Given** 初始化完成 **When** 检查 tests/ 目录 **Then** 镜像 src/ 结构（unit/、integration/、fixtures/）

## Tasks / Subtasks

- [x] Task 1: 初始化 npm 项目与 package.json (AC: #2)
  - [x] 1.1 `npm init` 并配置 `"type": "module"`
  - [x] 1.2 声明所有核心 dependencies 和 devDependencies（版本见 Dev Notes）
  - [x] 1.3 配置 scripts：`build`、`test`、`lint`、`format`、`type-check`
  - [x] 1.4 配置 `bin` 字段指向 CLI 入口（`"cord": "./dist/cli/index.js"`）
- [x] Task 2: 创建 D5 完整目录结构 (AC: #1, #7)
  - [x] 2.1 创建 src/ 下全部架构层目录及子目录
  - [x] 2.2 创建每个层的 index.ts 门面文件（空导出占位）
  - [x] 2.3 创建 CLI 入口文件 `src/cli/index.ts`（最小 Commander 骨架）
  - [x] 2.4 创建 MCP 门面文件 `src/mcp/index.ts`（空导出占位）
  - [x] 2.5 创建 MCP Server 入口 `src/mcp/server.ts`（最小薄壳占位，与 tsup.config.ts 构建入口对齐）
- [x] Task 3: 配置 TypeScript (AC: #3)
  - [x] 3.1 创建 tsconfig.json（strict、ESNext、NodeNext）
  - [x] 3.2 配置 paths、include/exclude
- [x] Task 4: 配置 tsup 构建 (AC: #4)
  - [x] 4.1 创建 tsup.config.ts（ESM 输出、入口点配置）
  - [x] 4.2 验证 `npm run build` 成功
- [x] Task 5: 配置 Vitest (AC: #5)
  - [x] 5.1 创建 vitest.config.ts
  - [x] 5.2 创建占位测试 `tests/unit/setup.test.ts`
  - [x] 5.3 验证 `npm test` 通过
- [x] Task 6: 配置 ESLint + Prettier (AC: #6)
  - [x] 6.1 创建 ESLint 配置文件（eslint.config.js，flat config）
  - [x] 6.2 创建 .prettierrc
  - [x] 6.3 验证 `npm run lint` 通过
- [x] Task 7: 创建 tests/ 目录结构 (AC: #8)
  - [x] 7.1 创建 tests/unit/ 镜像 src/ 结构
  - [x] 7.2 创建 tests/integration/ 和 tests/fixtures/ 目录
  - [x] 7.3 创建 fixtures 子目录：sample-projects/、documents/、configs/
- [x] Task 8: 创建基础配置文件
  - [x] 8.1 创建 .gitignore（node_modules/、dist/、.cord/、*.db、coverage/）
  - [x] 8.2 创建 .npmignore
  - [x] 8.3 创建 LICENSE (MIT)

## Dev Notes

### 关键技术栈版本

**根据架构文档确定以下版本（已收敛，无双分支）：**

**devDependencies：**

| 包 | 版本 | 说明 |
|----|------|------|
| typescript | ^5.8.x | 稳定版，TS 6.0 存在大版本更新风险暂不采用 |
| tsup | ^8.5.1 | ESM-first，内置 TS 支持 |
| vitest | ^4.1.3 | 当前主线版本 |
| eslint | ^10.2.0 | **ESLint 10 仅支持 flat config（`eslint.config.js`）**，与基线一致 |
| typescript-eslint | ^8.58.1 | 配合 ESLint 使用 |
| eslint-config-prettier | ^10.1.8 | 关闭与 Prettier 冲突的规则 |
| prettier | ^3.8.1 | 稳定 |
| @types/better-sqlite3 | ^7.6.13 | |
| @types/node | ^20.19.39 | 锁定 Node 20 LTS |

**dependencies：**

| 包 | 版本 | 说明 |
|----|------|------|
| commander | ^14.0.3 | CLI 框架，ESM + CJS 双支持 |
| @clack/prompts | ^1.2.0 | 交互向导，纯 ESM |
| chalk | ^5.4.1 | 终端颜色，ESM-only，与 D4 基线一致 |
| better-sqlite3 | ^12.8.0 | 同步 SQLite API，native addon |
| @modelcontextprotocol/sdk | ^1.29.0 | MCP 官方 TS SDK（**注意包名不是 @anthropic-ai/mcp-sdk**） |
| unified | ^11.0.5 | 纯 ESM |
| remark-parse | ^11.0.0 | 纯 ESM，配合 unified v11 |
| remark-frontmatter | ^5.0.0 | 纯 ESM |
| remark-gfm | ^4.0.1 | 纯 ESM |
| gray-matter | ^4.0.3 | CJS 为主，ESM 需 `esModuleInterop: true` |
| zod | ^3.24.2 | 数据验证层，锁定 v3.x（D1 基线决策） |

### ESLint 配置方案

使用 **ESLint 10 + flat config（`eslint.config.js`）**，与 `project-context.md` 基线一致（ESLint ≥ v10 已移除 `.eslintrc` 支持，只支持 flat config）。配置文件名为 `eslint.config.js`（`.js` 后缀，非 `.ts`）。

flat config 参考实现：

```javascript
// eslint.config.js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);
```

### MCP SDK 包名纠正

架构文档中写的 `@anthropic-ai/mcp-sdk` 实际包名应为 **`@modelcontextprotocol/sdk`**。这是 MCP 官方 TypeScript SDK。

### Zod 版本锁定

架构决策 D1 已锁定 **Zod v3.x**（`zod@^3.24`）。Zod v4 存在 breaking changes，项目不采用。`zod-to-json-schema` 等依赖需与 v3 大版本匹配。

### tsconfig.json 参考配置

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### tsup.config.ts 参考配置

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'cli/index': 'src/cli/index.ts',
    'mcp/server': 'src/mcp/server.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  splitting: false,
  sourcemap: true,
  shims: false,
});
```

### package.json scripts 参考

```json
{
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit"
  }
}
```

### 完整目录结构（必须创建）

参照架构文档 `project-structure-boundaries.md`，需创建以下完整结构：

```
src/
├── cli/
│   ├── commands/         # 命令定义目录（空）
│   ├── formatters/       # 输出格式化目录（空）
│   └── index.ts          # CLI 入口（最小 Commander 骨架）
├── mcp/
│   ├── tools/            # MCP Tool 定义目录（空）
│   ├── server.ts         # MCP Server 入口（占位）
│   └── index.ts
├── services/
│   └── index.ts
├── repositories/
│   ├── migrations/       # SQL 迁移脚本目录（空）
│   └── index.ts
├── scanner/
│   ├── rules/            # 规则引擎目录（空）
│   ├── plugins/          # remark 插件目录（空）
│   └── index.ts
├── adapters/
│   ├── framework/
│   │   ├── bmad/         # BMAD 适配模块目录（空）
│   │   ├── generic/      # 通用适配目录（空）
│   │   └── index.ts
│   ├── ide/
│   │   └── index.ts
│   └── index.ts
├── schemas/
│   └── index.ts
├── utils/
│   └── index.ts
└── types/
    └── index.ts

tests/
├── unit/
│   ├── services/
│   ├── repositories/
│   ├── scanner/
│   │   └── rules/
│   ├── adapters/
│   │   ├── framework/
│   │   │   └── bmad/
│   │   └── ide/
│   └── utils/
├── integration/
│   ├── cli/
│   ├── mcp/
│   └── flows/
└── fixtures/
    ├── sample-projects/
    │   ├── bmad-project/
    │   ├── generic-project/
    │   └── empty-project/
    ├── documents/
    └── configs/
```

### 架构模式遵守要点

1. **跨层引用必须通过 index.ts 门面**（P6）——每个 index.ts 仅空导出占位，后续 Story 逐步填充
2. **ESM 导入必须带 `.js` 后缀**——如 `import { X } from './foo.js'`（NodeNext module resolution 要求）
3. **package.json 的 bin 字段**——指向 `./dist/cli/index.js`
4. **CLI 入口最小骨架**——仅初始化 Commander 程序，输出版本号，不含任何命令实现
5. **导入排序遵循 P14**：Node 内置 → 第三方 → 内部模块 → 同级

### Project Structure Notes

- 本 Story 是整个项目的第零步——"Custom Setup（从零搭建）"策略（D5 + Starter Template 评估结论）
- 所有目录和 index.ts 门面文件在此 Story 中创建，内容在后续 Story 中逐步实现
- `.cord/` 数据目录不在此 Story 创建（属于 `cord init` 功能，Epic 5）

### References

- [Source: architecture/core-architectural-decisions.md#D5] — 按架构层组织目录
- [Source: architecture/core-architectural-decisions.md#D7-D8] — CI/CD 和覆盖率目标
- [Source: architecture/implementation-patterns-consistency-rules.md#P1-P16] — 完整实现模式
- [Source: architecture/project-structure-boundaries.md] — 完整项目目录结构
- [Source: architecture/starter-template-evaluation.md] — 从零搭建策略和依赖列表
- [Source: planning-artifacts/epics/epic-1工程就绪开发者可开始编写功能代码.md#Story 1.1] — 验收标准来源

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (GitHub Copilot)

### Debug Log References

- ESLint 10 flat config 需要 `@eslint/js` 作为独立 devDependency（未在 Story Dev Notes 中列出），已补充安装并更新 package.json。

### Completion Notes List

- 所有 8 个 Task 全部完成，全部 AC 满足。
- `npm run build` ✅ tsup ESM 输出成功（cli/index.js + mcp/server.js）
- `npm test` ✅ Vitest 1 passed
- `npm run lint` ✅ ESLint flat config 通过
- `npm run type-check` ✅ tsc --noEmit 无报错
- 补充 `@eslint/js` devDependency（ESLint 10 flat config 所需）
- `src/adapters/index.ts` 通过 `export * from './framework/index.js'` 和 `export * from './ide/index.js'` 聚合两个子门面（符合 P6 跨层引用规则）

### File List

- package.json
- tsconfig.json
- tsup.config.ts
- vitest.config.ts
- eslint.config.js
- .prettierrc
- .gitignore
- .npmignore
- LICENSE
- src/cli/index.ts
- src/cli/commands/.gitkeep
- src/cli/formatters/.gitkeep
- src/mcp/index.ts
- src/mcp/server.ts
- src/mcp/tools/.gitkeep
- src/services/index.ts
- src/repositories/index.ts
- src/repositories/migrations/.gitkeep
- src/scanner/index.ts
- src/scanner/rules/.gitkeep
- src/scanner/plugins/.gitkeep
- src/adapters/index.ts
- src/adapters/framework/index.ts
- src/adapters/framework/bmad/.gitkeep
- src/adapters/framework/generic/.gitkeep
- src/adapters/ide/index.ts
- src/schemas/index.ts
- src/utils/index.ts
- src/types/index.ts
- tests/unit/setup.test.ts
- tests/unit/services/.gitkeep
- tests/unit/repositories/.gitkeep
- tests/unit/scanner/rules/.gitkeep
- tests/unit/adapters/framework/bmad/.gitkeep
- tests/unit/adapters/ide/.gitkeep
- tests/unit/utils/.gitkeep
- tests/integration/cli/.gitkeep
- tests/integration/mcp/.gitkeep
- tests/integration/flows/.gitkeep
- tests/fixtures/sample-projects/bmad-project/.gitkeep
- tests/fixtures/sample-projects/generic-project/.gitkeep
- tests/fixtures/sample-projects/empty-project/.gitkeep
- tests/fixtures/documents/.gitkeep
- tests/fixtures/configs/.gitkeep

## Change Log

- 2026-04-26: Story implemented — full project scaffold created (package.json, tsconfig, tsup, vitest, eslint flat config, prettier, all src/ and tests/ directories with index.ts facades). All ACs satisfied, build/test/lint verified. Added @eslint/js devDependency (required by ESLint 10 flat config).

## Status

review
