# Story 1.1: 项目初始化与目录结构搭建

Status: ready-for-dev

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

- [ ] Task 1: 初始化 npm 项目与 package.json (AC: #2)
  - [ ] 1.1 `npm init` 并配置 `"type": "module"`
  - [ ] 1.2 声明所有核心 dependencies 和 devDependencies（版本见 Dev Notes）
  - [ ] 1.3 配置 scripts：`build`、`test`、`lint`、`format`、`type-check`
  - [ ] 1.4 配置 `bin` 字段指向 CLI 入口（`"cord": "./dist/cli/index.js"`）
- [ ] Task 2: 创建 D5 完整目录结构 (AC: #1, #7)
  - [ ] 2.1 创建 src/ 下全部架构层目录及子目录
  - [ ] 2.2 创建每个层的 index.ts 门面文件（空导出占位）
  - [ ] 2.3 创建 CLI 入口文件 `src/cli/index.ts`（最小 Commander 骨架）
  - [ ] 2.4 创建 MCP 入口文件 `src/mcp/index.ts`（空导出占位）
- [ ] Task 3: 配置 TypeScript (AC: #3)
  - [ ] 3.1 创建 tsconfig.json（strict、ESNext、NodeNext）
  - [ ] 3.2 配置 paths、include/exclude
- [ ] Task 4: 配置 tsup 构建 (AC: #4)
  - [ ] 4.1 创建 tsup.config.ts（ESM 输出、入口点配置）
  - [ ] 4.2 验证 `npm run build` 成功
- [ ] Task 5: 配置 Vitest (AC: #5)
  - [ ] 5.1 创建 vitest.config.ts
  - [ ] 5.2 创建占位测试 `tests/unit/setup.test.ts`
  - [ ] 5.3 验证 `npm test` 通过
- [ ] Task 6: 配置 ESLint + Prettier (AC: #6)
  - [ ] 6.1 创建 ESLint 配置文件（见 Dev Notes 关于版本选择）
  - [ ] 6.2 创建 .prettierrc
  - [ ] 6.3 验证 `npm run lint` 通过
- [ ] Task 7: 创建 tests/ 目录结构 (AC: #8)
  - [ ] 7.1 创建 tests/unit/ 镜像 src/ 结构
  - [ ] 7.2 创建 tests/integration/ 和 tests/fixtures/ 目录
  - [ ] 7.3 创建 fixtures 子目录：sample-projects/、documents/、configs/
- [ ] Task 8: 创建基础配置文件
  - [ ] 8.1 创建 .gitignore（node_modules/、dist/、.cord/、*.db、coverage/）
  - [ ] 8.2 创建 .npmignore
  - [ ] 8.3 创建 LICENSE (MIT)

## Dev Notes

### 关键技术栈版本

**根据架构文档和最新稳定版本研究，推荐以下版本：**

> **重要版本决策点：** TypeScript 6.0、ESLint 10、Zod 4 均已发布大版本更新。架构文档撰写于 2026 年 4 月初，部分版本引用可能需要对齐。以下提供保守方案和最新方案供选择。

**devDependencies：**

| 包 | 保守版本 | 最新版本 | 说明 |
|----|---------|---------|------|
| typescript | ^5.8.x | ^6.0.2 | TS 6.0 为大版本更新，若追求稳定建议 5.8 |
| tsup | ^8.5.1 | ^8.5.1 | ESM-first，内置 TS 支持 |
| vitest | ^4.1.3 | ^4.1.3 | 当前主线版本 |
| eslint | ^9.39.4 | ^10.2.0 | **ESLint 10 仅支持 flat config**，见下方说明 |
| typescript-eslint | ^8.58.1 | ^8.58.1 | 配合 ESLint 使用 |
| eslint-config-prettier | ^10.1.8 | ^10.1.8 | 关闭与 Prettier 冲突的规则 |
| prettier | ^3.8.1 | ^3.8.1 | 稳定 |
| @types/better-sqlite3 | ^7.6.13 | ^7.6.13 | |
| @types/node | ^20.19.39 | ^20.19.39 | 锁定 Node 20 LTS |

**dependencies：**

| 包 | 版本 | 说明 |
|----|------|------|
| commander | ^14.0.3 | CLI 框架，ESM + CJS 双支持 |
| @clack/prompts | ^1.2.0 | 交互向导，纯 ESM |
| picocolors | ^1.1.1 | 终端颜色，零依赖 |
| better-sqlite3 | ^12.8.0 | 同步 SQLite API，native addon |
| @modelcontextprotocol/sdk | ^1.29.0 | MCP 官方 TS SDK（**注意包名不是 @anthropic-ai/mcp-sdk**） |
| unified | ^11.0.5 | 纯 ESM |
| remark-parse | ^11.0.0 | 纯 ESM，配合 unified v11 |
| remark-frontmatter | ^5.0.0 | 纯 ESM |
| remark-gfm | ^4.0.1 | 纯 ESM |
| gray-matter | ^4.0.3 | CJS 为主，ESM 需 `esModuleInterop: true` |
| zod | ^3.24.x 或 ^4.3.6 | Zod 4 有 API breaking changes，架构文档指定 v3.x |

### ESLint 配置关键决策

**架构文档写了 `.eslintrc.cjs`，但 ESLint 10 已移除对旧配置格式的支持。** 有两个选择：

1. **方案 A（推荐）**：使用 ESLint 9.x（最后支持旧配置的版本）+ `.eslintrc.cjs`，与架构文档保持一致
2. **方案 B**：使用 ESLint 10.x + `eslint.config.ts`（flat config），这是 ESLint 官方推荐方向

**建议采用方案 B**（flat config），因为 ESLint 9 将进入维护模式。flat config 示例：

```typescript
// eslint.config.ts
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

### Zod 版本决策

架构文档指定 Zod v3.x。**Zod 4 已发布但 API 有 breaking changes。** 建议：
- 如果追求稳定和文档一致性：使用 `zod@^3.24`
- 如果追求最新生态和长期维护：使用 `zod@^4.3`（需注意 API 变化）

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
- [Source: epics.md#Story 1.1] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
