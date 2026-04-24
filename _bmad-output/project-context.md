---
project_name: 'CORD'
user_name: 'Fancyliu'
date: '2026-04-09'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 48
optimized_for_llm: true
---

# Project Context for AI Agents

_此文件包含 AI Agent 在本项目中编写代码时必须遵守的关键规则和模式。聚焦于 Agent 可能遗漏的非显而易见的细节。_

---

## Rule Document Registry

**凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档：**

| 文档 | 职责 |
|------|------|
| `_bmad-output/project-context.md` | AI agent 主规则文件，优化为 LLM 消费 |
| `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md` | 实现模式，面向人类可读 |
| `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md` | 技术决策事项记录，面向人类可读 |

> 两份文档内容互为镜像，任何一处规则变更必须同时更新另一处。

---

## 技术栈与版本

### 核心技术

| 技术 | 用途 | 版本约束 |
|------|------|---------|
| Node.js | 运行时 | ≥ 20 LTS |
| TypeScript | 开发语言 | 严格模式, ESNext target, NodeNext 模块解析 |
| ESM | 模块系统 | `"type": "module"`, 所有 import 必须带 `.js` 后缀 |

### 核心运行时依赖

| 依赖 | 用途 | 版本说明 |
|------|------|---------|
| commander | CLI 框架 | v14 |
| @clack/prompts | 交互式向导 | cord init 专用 |
| chalk | 终端着色 | v5+（纯 ESM，与项目 ESM-first 一致） |
| better-sqlite3 | SQLite 存储 | 同步 API, WAL 模式, native addon |
| @modelcontextprotocol/sdk | MCP Server | ⚠️ 注意包名（非 @anthropic-ai/mcp-sdk） |
| zod | 数据验证 | v3.x（⚠️ 避免 v4，有破坏性变更） |
| unified + remark-parse | Markdown AST | 纯 ESM |
| remark-frontmatter + remark-gfm | remark 插件 | 纯 ESM |
| gray-matter | Frontmatter 解析 | YAML 配置复用 |

### 开发依赖

| 依赖 | 用途 | 版本说明 |
|------|------|---------|
| tsup | 构建打包 | ESM 输出 |
| vitest | 测试框架 | 兼容 Jest API |
| eslint | 静态分析 | ⚠️ v10 仅支持 flat config（无 .eslintrc） |
| prettier | 代码格式化 | — |
| semantic-release | 自动版本管理 | npm provenance 从第一天启用 |

### 关键版本决策点

1. **Zod v3 vs v4** — 锁定 v3.x；v4 存在破坏性变更（`z.object` API 变化）
2. **ESLint ≥ v10** — 已移除 `.eslintrc` 支持，只能使用 flat config（`eslint.config.js`）
3. **MCP SDK 包名** — `@modelcontextprotocol/sdk`（不是 `@anthropic-ai/mcp-sdk`）
4. **chalk v5+** — 纯 ESM 模块，不支持 `require()`；架构文档原指定 picocolors，所有引用处需替换为 chalk
5. **TypeScript 6.0** — 已发布，需评估与 NodeNext 解析的兼容性

## 关键实现规则

### 语言特定规则（TypeScript / ESM）

**ESM 模块要求：**
- 所有 import 路径**必须带 `.js` 后缀**（即使源文件是 `.ts`）：`import { ScanService } from './scan-service.js'`
- 使用 `node:` 前缀引用 Node.js 内置模块：`import { readFileSync } from 'node:fs'`
- 禁止使用 `require()` / `module.exports`

**TypeScript 严格模式：**
- `strict: true` — 无隐式 any、严格 null 检查
- 所有公共 API 方法必须有显式返回类型声明
- 禁止使用 `any` 类型，用 `unknown` + 类型守卫代替

**Import 排序规范（P14）：**
```typescript
// 1. Node.js 内置模块
import { readFileSync } from 'node:fs';
// 2. 第三方依赖
import { z } from 'zod';
// 3. 内部模块（通过 index.ts 门面）
import { ScanService } from '../services/index.js';
// 4. 同级模块
import { formatOutput } from './helpers.js';
```

**跨层引用规则（P6 强制执行）：**
- 跨层引用**必须通过 `index.ts` 门面**，禁止直接 import 内部文件
- Service 层**只依赖接口**（`IGraphRepository`），禁止 import 具体实现（`SqliteGraphRepository`）

**异步 vs 同步模式（P13）：**

| 层 | 模式 | 理由 |
|---|------|------|
| Repository 层 | **同步** | better-sqlite3 同步 API |
| Service 层 | **同步为主**（文件 I/O 用 async） | 数据库操作同步 |
| Scanner 引擎 | **async** | unified/remark 管道是异步的 |
| CLI / MCP 入口 | **async** | Commander action / MCP handler 均 async |

**错误处理（P12）：**
- 所有异常必须是 `CordError` 子类，携带 `code` + `suggestion`
- Service 层禁止 `console.log` / `process.exit`
- MCP Server 的 stdout 只用于 JSON-RPC，日志走 stderr
- 禁止静默吞掉异常

**Service 方法签名（P11）：**
```typescript
// ✅ 输入：单一对象参数，Zod schema 推导类型
async scanDocuments(input: ScanInput): Promise<ScanResult>

// ❌ 禁止散装参数
async scanDocuments(path: string, incremental: boolean): Promise<any>
```

### 框架特定规则（双入口架构 + 适配器模式）

**双入口共享 Service 层（核心架构）：**
```
CLI (Commander.js)  ──→  Service 层  ←──  MCP Server (@modelcontextprotocol/sdk)
         ↓                    ↓                    ↓
    L3 薄壳层            L2 业务逻辑          L3 薄壳层
```
- CLI 和 MCP 入口**都是薄壳**：只负责参数解析 → 调用 Service → 格式化输出
- **零业务逻辑**允许存在于 L3 入口层
- 所有业务逻辑集中在 L2 Service 层

**依赖注入模式（P7）：**
```typescript
// ✅ 构造函数注入接口
class ScanService {
  constructor(private readonly repo: IGraphRepository) {}
}

// ❌ 禁止直接 import 具体实现
import { SqliteGraphRepository } from '../repositories/sqlite-graph-repository.js';
```

**框架适配器模式（Epic 2）：**
- `IFrameworkAdapter` 接口 → `AbstractFrameworkAdapter` 基类 → 具体适配器
- `GenericFrameworkAdapter` 作为兜底（无预设规则，仅基础 frontmatter 扫描）
- `BmadFrameworkAdapter` 作为参考实现（18 种文档类型，v0.1 仅实现 Markdown 16 种，YAML 2 种延至 v0.2；5 层检测；详见 Story 2.3）
- 新增框架适配**不得修改核心模块源码**（NFR8）

**IDE 适配器模式（Epic 5）：**
- `IIdeAdapter` 接口 → 4 种 IDE 适配器（Claude Code / Cursor / VS Code Copilot / Codex CLI）
- 零侵入策略：不修改 IDE 现有配置，只新增 CORD 相关文件；**例外**：`AGENTS.md` 为 NFR12 appendable 例外共享文件（Copilot + Codex CLI 共享），已存在时追加 CORD 专属注释段（<!-- CORD:START --> ... <!-- CORD:END -->），格式冲突时返回 `AGENTS_MD_CONFLICT` 结构化错误，不自动覆盖
- `cord init` 自动检测 IDE 并选择适配器

**MCP Server 关键约束：**
- stdout **专用于 JSON-RPC 通信**，绝不输出日志
- 所有日志 / 调试信息通过 `console.error()` → stderr
- MCP Tool 名使用 snake_case：`analyze_impact`、`query_relations`
- MCP Tool 参数使用 camelCase：`docPath`、`relationType`
- SIGTERM 优雅退出处理

**CLI 关键约束：**
- 命令名 kebab-case：`cord init`、`cord scan`、`cord impact`
- 选项 `--kebab-case`：`--output-format`、`--relation-type`
- 所有命令支持 `--json` 标志输出 JSON 格式
- 错误输出使用 chalk 着色 + CordError 的 suggestion 字段

### 测试规则

**测试框架与组织（P5）：**
- 测试框架：**Vitest**（兼容 Jest API）
- 独立 `tests/` 目录，镜像 `src/` 结构：
```
tests/
├── unit/          # 镜像 src/ 结构
│   ├── services/
│   ├── repositories/
│   ├── scanner/
│   ├── adapters/
│   └── utils/
├── integration/   # 按场景组织
│   ├── cli/
│   ├── mcp/
│   └── flows/
└── fixtures/      # 统一测试数据
    ├── sample-projects/  # 模拟项目目录结构（bmad-project/、generic-project/、empty-project/）
    ├── documents/
    └── configs/
```

**测试命名规范（P16）：**
```typescript
describe('ScanService', () => {
  describe('scanDocuments', () => {
    it('should discover frontmatter references as relations', () => {});
    it('should skip unparseable documents and log warning', () => {});
    it('should throw ScanError when project root is invalid', () => {});
  });
});
```
- describe: `类名` → `方法名`
- it: `should + 行为描述`
- 测试文件名：`{source}.test.ts`

**覆盖率分级要求（D8）：**

| 层 | 目标 | 说明 |
|---|------|------|
| Service + Scanner | ≥ 90% | 核心业务逻辑 |
| Repository | ≥ 85% | 数据访问关键路径 |
| Adapters | ≥ 80% | 适配逻辑需可靠 |
| CLI / MCP 入口 | ≥ 70% | 薄壳，主要是参数转发 |
| **整体** | **≥ 80%** | CI 质量门禁 |

**必须遵守的测试原则：**
- 新增功能**必须附带测试**，覆盖正常路径 + 至少一个异常路径
- Repository 层测试使用**内存 SQLite**（`:memory:`），不依赖文件系统数据库
- Scanner 引擎测试使用 `tests/fixtures/documents/` 下的真实 Markdown 文件
- 集成测试验证跨层调用流程（如 scan → query → impact 完整链路）
- Mock 策略：Service 测试 mock `IGraphRepository` 接口；CLI/MCP 测试 mock Service 层

### 代码质量与风格规则

**命名约定汇总（P1-P4）：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `scan-service.ts`、`errors.ts` |
| 类名 | PascalCase | `ScanService`、`CordError` |
| 函数/方法 | camelCase | `analyzeImpact()`、`queryRelations()` |
| 常量 | SCREAMING_SNAKE_CASE | `RELATION_TYPES`、`MAX_TRAVERSAL_DEPTH` |
| 接口 | `I` 前缀 + PascalCase | `IGraphRepository`、`IFrameworkAdapter` |
| 类型 | PascalCase（无前缀） | `RelationType`、`DocumentNode` |
| Zod Schema | camelCase + `Schema` 后缀 | `documentSchema`、`configSchema` |
| DB 表名 | snake_case 复数 | `documents`、`relations` |
| DB 列名 | snake_case | `doc_id`、`source_path` |
| CLI 命令 | kebab-case | `cord scan`、`cord impact` |
| MCP Tool 名 | snake_case | `analyze_impact`、`query_relations` |
| MCP Tool 参数 | camelCase | `docPath`、`relationType` |

**数据格式转换边界（P8）：**
- DB ↔ Repository 层：snake_case（`doc_id`、`relation_type`）
- Repository → Service 层：转换为 camelCase（`docId`、`relationType`）
- **转换逻辑集中在 Repository 层**，其他层不处理格式转换

**模块导出（P6）：**
- 每个架构层有一个 `index.ts` 作为公共 API 门面
- 跨层引用**只通过 `index.ts`**，禁止直接引用内部文件

**注释规范（P15）：**
- 公共 API **必须**有 JSDoc（含 `@param`、`@returns`、`@throws`）
- 行内注释解释 **WHY**（为什么这样做），不解释 WHAT（代码在做什么）
- 禁止对显而易见的代码添加冗余注释

**ESLint / Prettier：**
- ESLint：flat config（`eslint.config.js`），禁止生成 `.eslintrc`
- Prettier：统一代码格式化
- CI 中 `lint + type-check` 作为 PR 质量门禁

**关系类型值（P9）——9 种固定值：**
```typescript
export const RELATION_TYPES = {
  SYNC_REQUIRED: 'sync_required',
  CONTEXT_FOR: 'context_for',
  LIFECYCLE_BOUND: 'lifecycle_bound',
  CONTAINS: 'contains',
  MUST_CONSISTENT: 'must_consistent',
  SYNC_SUGGESTED: 'sync_suggested',
  DERIVED_FROM: 'derived_from',
  DEPRECATED: 'deprecated',
  REFERENCES: 'references',
} as const;
```

### 开发工作流规则

**目录结构（D5）：**
```
src/
├── cli/            # L3 CLI 入口层（薄壳）
│   ├── commands/   # Commander.js 命令定义
│   └── index.ts
├── mcp/            # L3 MCP Server 入口层（薄壳）
│   ├── tools/      # MCP Tool 定义
│   └── server.ts
├── services/       # L2 Service 层（核心业务逻辑）
├── repositories/   # L1 Repository 层（数据访问）
│   └── migrations/ # SQL 迁移脚本
├── scanner/        # 扫描引擎（策略模式）
│   └── rules/
├── adapters/       # 可插拔适配层
│   ├── framework/  # IFrameworkAdapter + 实现
│   └── ide/        # IIdeAdapter + 实现
├── schemas/        # Zod schema 定义
├── utils/          # 公共工具（logger、errors、config）
└── types/          # 全局类型定义
```

**架构层依赖方向（严格单向）：**
```
L3 入口层（CLI / MCP） → L2 Service 层 → L1 Repository 层
                              ↓
                    Scanner / Adapters（同级调用）
```
- **禁止反向依赖**：L1 不得引用 L2，L2 不得引用 L3
- **禁止同层跨域引用**：CLI 不得直接调用 MCP 内部模块

**数据库迁移（D2）：**
- 迁移脚本存放在 `src/repositories/migrations/`
- 按编号顺序命名：`001-initial-schema.sql`、`002-add-index.sql`（kebab-case，与项目文件命名约定 P2 一致）
- 迁移状态使用 `schema_migrations` 历史表追踪（非单值 schema_version），支持审计和部分回滚
- 应用启动时查询 `schema_migrations` 表已执行版本后，按序执行未执行的迁移脚本
- 迁移在事务中执行，失败可回滚

**配置管理（D6）：**
- 支持 `cord.config.yaml`（推荐）和 `cord.config.json`
- 加载优先级：YAML > JSON（同时存在时 YAML 优先）
- 配置加载后通过 Zod schema 验证
- `cord init` 默认生成 YAML 格式
- 配置字段基线（8 项）：初始 7 项（framework、ide、scanPaths、excludePaths、confidenceThreshold、relationTypes、adapters）+ updateStrategies（Story 4.3 引入，按文档类别配置更新策略，键为 docType，值为 'auto' | 'suggest' | 'log_only'，缺省 suggest，未知 key 宽容处理）

**CI/CD（D7）：**
- GitHub Actions 作为唯一 CI/CD 平台
- PR 检查：`lint` + `type-check` + `test` + `coverage`
- 发布：semantic-release 为唯一发布 owner（自动化版本 + npm publish + GitHub Release）
- Release workflow 权限：必须同时声明 `permissions.id-token: write`（npm provenance OIDC）和 `permissions.contents: write`（GitHub Release / tags 创建）；显式声明任意权限时，未声明权限收缩为 `none`
- 跨平台矩阵：ubuntu / macos / windows（better-sqlite3 native addon 验证）
- npm provenance 从第一天启用

### 关键易错规则

**禁止事项（Anti-Patterns）：**

```typescript
// ❌ Service 层直接操作终端
console.log('Scanning...');  // 禁止——用 Logger
process.exit(1);             // 禁止——抛 CordError，由入口层处理

// ❌ 跨层直接引用内部文件
import { scanDocumentsImpl } from '../services/scan-service.js';
// 应通过：import { ScanService } from '../services/index.js';

// ❌ Repository 返回 camelCase
return { sourcePath: '...' };  // Repository 层应返回 snake_case，再由自己转换

// ❌ Service 返回 snake_case
return { source_path: '...' };  // Service 层应已转换为 camelCase

// ❌ 散装参数代替输入对象
async queryRelations(docPath: string, type?: string, depth?: number)

// ❌ 静默吞掉异常
try { ... } catch (e) { /* 忽略 */ }

// ❌ 抛非 CordError 异常
throw new Error('something wrong');  // 应使用 CordError 子类

// ❌ MCP Server 向 stdout 输出非 JSON-RPC 内容
console.log('debug info');  // stdout 专用于 JSON-RPC，日志用 console.error → stderr

// ❌ 使用 require() 或 .eslintrc
const chalk = require('chalk');  // ESM 项目禁止 require
```

**易忽略的边界情况：**

1. **ESM import 后缀** — 即使源文件是 `.ts`，import 路径必须写 `.js`
2. **better-sqlite3 是同步 API** — Repository 方法不要声明为 async
3. **unified/remark 是异步管道** — Scanner 引擎方法必须是 async
4. **MCP SDK 包名** — `@modelcontextprotocol/sdk`，不是 `@anthropic-ai/mcp-sdk`
5. **chalk v5+ 纯 ESM** — 不支持 `require()`；架构文档原指定 picocolors 的地方均需替换
6. **Zod v3 锁定** — 不要使用 v4 的 API（如 `z.string().brand()` 行为变化）
7. **snake_case ↔ camelCase 边界** — 只在 Repository 层转换，其他层保持各自格式
8. **CordError 必须携带 `code` + `suggestion`** — 错误码格式：`CORD_SCAN_001`
9. **新增框架适配器不得修改核心源码** — NFR8 合规要求

**安全规则：**
- SQLite WAL 模式——数据目录 `.cord/` 应在 `.gitignore` 中
- 配置文件不包含敏感信息，但 `.cord/cord.db` 包含项目结构信息
- npm provenance 从第一天启用，确保供应链安全

---

## 使用指南

**AI Agent 须知：**
- 在实现任何代码之前，先阅读此文件
- 严格遵守所有规则，不得自行变通
- 存疑时选择更严格的选项
- 发现新模式时更新此文件

**维护者须知：**
- 保持此文件精简，聚焦于 Agent 需要的信息
- 技术栈变更时及时更新
- 定期审查，移除已变得显而易见的规则
- 新增规则时确保其具有可操作性

最后更新：2026-04-09
