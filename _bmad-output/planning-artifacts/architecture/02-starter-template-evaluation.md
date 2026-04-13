# Starter Template Evaluation

## Primary Technology Domain

CLI Tool + MCP Server（开发者工具链基础设施）— 基于项目需求分析，CORD 是一个本地优先的 CLI 工具 + MCP Server 双入口系统，不属于 Web 应用、移动应用或传统 API 服务的范畴。

## Starter Options Considered

| 选项 | 评估结论 | 理由 |
|------|---------|------|
| **Custom Setup（从零搭建）** | ✅ **选定** | 技术栈已由11项TR完全锁定，架构独特性（CLI+MCP双入口+共享Service+Repository Pattern+框架适配器）无现成模板覆盖 |
| oclif (Salesforce CLI 框架) | ❌ 排除 | 过重、自带框架约束与Commander.js v14冲突、TR5已否决 |
| create-ts-starter 类通用模板 | ❌ 排除 | 面向通用库/工具、不包含CLI/MCP架构、仍需大量改造 |
| MCP Server 官方模板 | ⚠️ 仅参考 | 仅覆盖MCP层、缺少CLI/存储/扫描引擎等核心层 |

## Selected Starter: Custom Setup（从零搭建）

**Rationale for Selection:**

1. **技术栈已完全锁定** — 11项TR已确定所有核心依赖，Starter Template 的选型优势（帮你做技术决策）不再适用
2. **架构独特性** — CLI + MCP双入口 + 共享Service层 + Repository Pattern + 框架适配器，没有现成模板能覆盖
3. **避免技术债** — 使用不匹配的 Starter 意味着首先花时间剥离不需要的东西，再添加需要的东西
4. **控制力** — 架构分层、目录结构、模块边界完全由我们设计，确保与 PRD 需求精确对齐

**Initialization Command:**

```bash
# 1. 创建项目并初始化
mkdir cord && cd cord
npm init -y

# 2. 安装核心开发依赖
npm install -D typescript tsup @types/node vitest eslint prettier

# 3. 安装核心运行时依赖
npm install commander @clack/prompts chalk better-sqlite3 @modelcontextprotocol/sdk
npm install unified remark-parse remark-frontmatter remark-gfm gray-matter

# 4. 配置 TypeScript + tsup + Vitest
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript strict mode + Node.js 20+ LTS
- ESM 模块系统（`"type": "module"` in package.json）
- tsconfig.json: strict, ESNext target, NodeNext module resolution

**Build Tooling:**
- tsup: TypeScript → JavaScript 编译，零配置 ESM/CJS 双输出
- semantic-release: 自动化版本管理（从第一天建立规范的版本语义）
- npm provenance: 供应链安全从第一天启用

**Testing Framework:**
- Vitest: TypeScript 原生支持、与 tsup 生态一致、速度快、兼容 Jest API

**Code Quality:**
- ESLint: 静态分析
- Prettier: 代码格式化

**Development Experience:**
- Vitest watch mode 开发时即时反馈
- TypeScript 类型检查集成 IDE 实时提示
- tsup --watch 开发模式

**Note:** 项目初始化应作为第一个实现 Story，确保基础工程化配置到位。
