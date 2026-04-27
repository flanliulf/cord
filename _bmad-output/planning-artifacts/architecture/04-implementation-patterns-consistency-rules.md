# Implementation Patterns & Consistency Rules

## Pattern Categories Defined

**Critical Conflict Points Identified:** 5 大类 16 个冲突点，确保多个 AI Agent 写出兼容一致的代码。

## Naming Patterns

**P1. 数据库命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 表名 | snake_case 复数 | `documents`、`relations`、`sync_states` |
| 列名 | snake_case | `doc_id`、`source_path`、`relation_type`、`created_at` |
| 外键 | `{referenced_table}_id` | `source_doc_id`、`target_doc_id` |
| 索引 | `idx_{table}_{columns}` | `idx_relations_source_doc_id`、`idx_documents_path` |
| 主键 | `id`（每表统一） | `documents.id`、`relations.id` |

**P2. 代码命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `scan-service.ts`、`sqlite-graph-repository.ts`、`errors.ts` |
| 类名 | PascalCase | `ScanService`、`SqliteGraphRepository`、`CordError` |
| 函数/方法 | camelCase | `analyzeImpact()`、`queryRelations()`、`getDocumentById()` |
| 变量 | camelCase | `docPath`、`relationType`、`scanResult` |
| 常量 | SCREAMING_SNAKE_CASE | `RELATION_TYPES`、`MAX_TRAVERSAL_DEPTH`、`DEFAULT_CONFIDENCE` |
| 接口 | `I` 前缀 + PascalCase | `IGraphRepository`、`IFrameworkAdapter`、`IScanRule` |
| 类型 | PascalCase（无前缀） | `RelationType`、`DocumentNode`、`ScanResult` |
| 类型常量值 | snake_case 字符串字面量 | `'sync_required'`、`'context_for'`（`RELATION_TYPES as const` 推导的字符串联合类型） |
| Zod Schema | camelCase + `Schema` 后缀 | `documentSchema`、`relationSchema`、`configSchema` |

**P3. CLI 命令命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 命令名 | kebab-case 单词 | `cord init`、`cord scan`、`cord query`、`cord impact` |
| 选项长名 | `--kebab-case` | `--output-format`、`--relation-type`、`--max-depth` |
| 选项短名 | 单字母 `-x` | `-f`（format）、`-t`（type）、`-d`（depth） |

**P4. MCP Tool 命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| Tool 名 | snake_case（意图驱动） | `analyze_impact`、`query_relations`、`sync_docs`、`init_graph` |
| 参数名 | camelCase | `docPath`、`relationType`、`maxDepth` |

## Structure Patterns

**P5. 测试文件组织：独立 `tests/` 目录**

测试文件统一存放在项目根目录的 `tests/` 下，镜像 `src/` 目录结构：

```
tests/
├── unit/
│   ├── services/
│   │   ├── scan-service.test.ts
│   │   ├── query-service.test.ts
│   │   └── impact-service.test.ts
│   ├── repositories/
│   │   └── graph-repository.test.ts
│   ├── scanner/
│   │   ├── pipeline.test.ts
│   │   └── rules/
│   ├── adapters/
│   │   └── framework/
│   │       └── bmad/
│   └── utils/
│       ├── errors.test.ts
│       └── logger.test.ts
├── integration/
│   ├── cli/
│   │   └── init-command.test.ts
│   ├── mcp/
│   │   └── tools.test.ts
│   └── flows/
└── fixtures/
    ├── sample-projects/      # 模拟项目目录结构（bmad-project/、generic-project/、empty-project/）
    ├── documents/            # 测试用 Markdown 文档
    └── configs/              # 测试用配置文件
```

- 单元测试：`tests/unit/` 镜像 `src/` 结构
- 集成测试：`tests/integration/` 按场景组织
- 测试数据：`tests/fixtures/` 统一存放
- 测试文件命名：`{source}.test.ts`

**P6. 模块导出模式：**

每个架构层有一个 `index.ts` 作为公共 API 门面：

```typescript
// src/services/index.ts — Service 层公共 API
export { ScanService } from './scan-service.js';
export { QueryService } from './query-service.js';
export { ImpactService } from './impact-service.js';
```

跨层引用**必须通过 index.ts**，禁止直接引用内部文件。

**P7. 依赖注入模式：**

Service 层通过构造函数注入 Repository：

```typescript
// ✅ 正确：构造函数注入
class ScanService {
  constructor(private readonly repo: IGraphRepository) {}
}

// ❌ 错误：直接 import 具体实现
import { SqliteGraphRepository } from '../repositories/sqlite-graph-repository.js';
```

## Format Patterns

**P8. 内部数据传递格式：**

| 维度 | 规则 | 说明 |
|------|------|------|
| Service 返回值 | camelCase TypeScript 接口 | `{ docId, sourcePath, relationType }` |
| DB ↔ Repository | snake_case（与 DB 列名一致） | `{ doc_id, source_path, relation_type }` |
| 转换边界 | Repository 层负责 snake ↔ camelCase | 映射逻辑集中在 Repository 层 |

**P9. 关系类型值格式：**

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

**P10. JSON 快照导出格式：**

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "2026-04-07T10:00:00Z",
  "project": "cord-project-name",
  "documents": [],
  "relations": []
}
```

- 所有日期时间：ISO 8601 字符串
- JSON 字段：camelCase
- null 值：保留（不省略键）

## Communication & Process Patterns

**P11. Service 方法签名规范：**

```typescript
// ✅ 正确：输入用 Zod schema 类型，输出用明确的返回类型
async scanDocuments(input: ScanInput): Promise<ScanResult>

// ❌ 错误：散装参数
async scanDocuments(path: string, incremental: boolean, framework?: string): Promise<any>
```

所有 Service 方法：
- 输入：单一对象参数，类型由 Zod schema 推导
- 输出：明确的 TypeScript 类型（`Promise<T>` 或同步 `T`）
- 不抛非 `CordError` 的异常

**P12. 错误处理流程：**

```
Service 层 → throw CordError 子类（携带 code + suggestion）
    ↓
CLI 入口 → catch → chalk 格式化输出 → process.exit(1)
MCP 入口 → catch → 转换为 MCP 标准错误响应
```

**绝不：**
- Service 层直接 `console.log` 或 `process.exit`
- MCP 层直接输出到 stdout（stdout 是 JSON-RPC 通道）
- 吞掉异常不处理

**P13. 异步 vs 同步模式：**

| 层 | 模式 | 理由 |
|---|------|------|
| Repository 层 | **同步** | better-sqlite3 是同步 API |
| Service 层 | **同步为主**（文件 I/O 用 async） | 数据库操作同步，文件读写可能需要 async |
| Scanner 引擎 | **async** | unified/remark 处理管道是异步的 |
| CLI 入口 | **async** | Commander action 支持 async，可调用任何 Service |
| MCP 入口 | **async** | MCP SDK handler 是 async |

## Quality Patterns

**P14. 导入排序：**

```typescript
// 1. Node.js 内置模块
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 2. 第三方依赖
import { z } from 'zod';
import { Command } from 'commander';

// 3. 内部模块（按层级从外到内）
import { ScanService } from '../services/index.js';
import { CordError } from '../utils/errors.js';

// 4. 同级模块
import { formatOutput } from './helpers.js';
```

**P15. 注释规范：**

```typescript
// ✅ 公共 API 必须有 JSDoc
/**
 * 分析文档变更的影响范围
 * @param input - 影响分析输入参数
 * @returns 受影响文档列表及建议动作
 * @throws {QueryError} 当文档不存在时
 */
async analyzeImpact(input: ImpactInput): Promise<ImpactResult> { ... }

// ✅ 复杂逻辑用行内注释解释 WHY，不解释 WHAT
// 使用 BFS 而非 DFS，因为影响分析需要按距离排序结果
const affected = this.bfsTraverse(docId, maxDepth);

// ❌ 错误：解释显而易见的代码
// 获取文档 ID
const docId = input.docId;
```

**P16. 测试命名规范：**

```typescript
describe('ScanService', () => {
  describe('scanDocuments', () => {
    it('should discover frontmatter references as relations', () => { ... });
    it('should skip unparseable documents and log warning', () => { ... });
    it('should throw ScanError when project root is invalid', () => { ... });
  });
});
```

- describe: 类名 → 方法名
- it: `should + 行为描述`
- 测试文件名：`{source}.test.ts`

**P17. CordConfig 配置字段重要规则：**

cord.config.yaml / cord.config.json 共 8 个项（均可选）：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| framework | string | 自动检测 | 框架类型 |
| ide | string | 自动检测 | IDE 类型 |
| scanPaths | string[] | adapter 预设 | 扫描路径 |
| excludePaths | string[] | `["src/","node_modules/",".git/","dist/"]` | 排除路径 |
| confidenceThreshold | number | 0.50 | 影响分析最低置信度阈值 |
| relationTypes | Record<RelationType, {enabled: boolean}> | 全部启用 | 9 个内置类型启用/禁用 |
| adapters | string[] | [] | 启用的框架适配模块 |
| updateStrategies | Record<docType, UpdateStrategy> | {} | Story 4.3 引入，未配置的 docType 回退到 `suggest` |

```typescript
type UpdateStrategy = 'auto' | 'suggest' | 'log_only';
// 'auto': 自动更新  'suggest': 生成建议后人工确认  'log_only': 仅记录不触发
// 未知 key 宽容处理：回退到 suggest，记录 debug 日志但不报错
```

## CLI 入口规则（来源：Story 1-2 CR 历史）

**P19. ESM CLI entrypoint 守卫三步归一化（CR-CLI-01）：**

⚠️ 禁止使用以下写法作为 entrypoint 守卫：
- `` `file://${process.argv[1]}` ``（字符串拼接，空格路径失效）
- `pathToFileURL(process.argv[1]).href`（无判空，`argv[1]` 缺失时崩溃）

✅ 必须使用三步归一化写法：

```ts
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Step 1: 判空 — argv[1] 缺失时（stdin/--eval/--input-type=module）静默跳过
const entryArg = process.argv[1];
if (entryArg) {
  let entryUrl: string;
  try {
    // Step 2: realpathSync 解析 symlink 真实路径（与 import.meta.url 对齐）
    // Step 3: pathToFileURL 处理 RFC 3986 百分号编码（空格 → %20）
    entryUrl = pathToFileURL(realpathSync(entryArg)).href;
  } catch {
    entryUrl = pathToFileURL(entryArg).href; // 兜底：realpathSync 失败时回退
  }
  if (import.meta.url === entryUrl) {
    runCli();
  }
}
```

**根因**：`import.meta.url` 始终是 Node.js 解析后的真实文件 file URL（含 RFC 3986 编码）；`process.argv[1]` 可能是 symlink 路径且未编码。两侧不做归一化在特殊路径（含空格、symlink）下必然静默失效（exitcode=0，无输出）。

**P20. CLI 入口文件副作用隔离（CR-CLI-02）：**

- `src/cli/index.ts` 等 CLI 入口文件**禁止**在模块顶层执行 `program.parse()` 或任何会调用 `process.exit()` 的代码
- 所有 CLI 执行逻辑必须封装在函数中，并由 entrypoint 守卫（P19）保护
- 无副作用的 CLI helper（如 `applyVerboseFlag`）必须提取到独立模块（如 `src/cli/verbose.ts`），测试直接导入 helper，不导入 CLI 入口

```ts
// ✅ 正确结构：
export function createProgram(): Command { ... }
export function runCli(program = createProgram()): void {
  program.parse(process.argv);
  applyVerboseFlag(program.opts(), process.env);
}
// entrypoint 守卫（P19 三步写法）
const entryArg = process.argv[1];
// ...

// ❌ 禁止：顶层直接执行
const program = new Command();
program.parse(process.argv);  // 任何导入都会触发，破坏可测试性
```

**P21. Commander.js `preAction` 钩子使用约束（CR-CLI-03）：**

- 禁止在**没有任何 `.action()` 或 subcommand action 注册**的情况下，依赖 `preAction` 处理全局选项（如 `--verbose`）
- `preAction` 只在 Commander 执行某个 action handler 之前触发；无 action 时该钩子永不触发
- 替代方案：在 `program.parse()` 之后同步读取 `program.opts()` 处理全局选项；或在引入首条 subcommand 时改用 `program.hook('preAction', ...)`

## 覆盖率配置规则（来源：Story 1-2 CR 历史）

**P22. coverage.exclude 必须显式枚举（CR-COV-01）：**

⚠️ **禁止**使用 blanket glob（如 `src/**/index.ts`）作为覆盖率排除规则——此类写法会将含业务逻辑的文件（如 `src/cli/index.ts`）一并排除，导致 coverage gate 形同虚设。

✅ **只排除**纯 re-export barrel 文件（零业务逻辑），逐一显式列举：

```ts
// vitest.config.ts — ✅ 正确：显式枚举纯 barrel 文件
coverage: {
  exclude: [
    'src/**/*.d.ts',
    // 仅排除纯 re-export barrel 文件（无业务逻辑）：
    'src/adapters/index.ts', 'src/adapters/framework/index.ts', 'src/adapters/ide/index.ts',
    'src/mcp/index.ts', 'src/repositories/index.ts', 'src/scanner/index.ts',
    'src/schemas/index.ts', 'src/services/index.ts', 'src/types/index.ts', 'src/utils/index.ts',
    // ⚠️ 含业务逻辑的文件（src/cli/index.ts 等）禁止出现在此列表中
  ],
}
```

**P23. Story 级覆盖率 AC 优先于架构 D8 分级（CR-COV-02）：**

架构 D8 表定义了各层覆盖率**最低下限**。若单 Story 的 AC 明文要求更高覆盖率（如某 Story 要求整体 ≥ 90%），以 Story AC 为准，该 Story 验收时不可用 D8 下限豁免。

## Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. **跨层引用必须通过 index.ts 门面**，禁止直接 import 内部文件
2. **Service 层禁止直接引用具体 Repository 实现**，只依赖 `IGraphRepository` 接口
3. **CLI/MCP 入口层是薄壳**，只负责参数解析 → 调用 Service → 格式化输出，不含业务逻辑
4. **所有用户输入必须经过 Zod schema 验证**，在进入 Service 层之前
5. **所有错误必须是 CordError 子类**，携带 `code` 和 `suggestion`
6. **MCP Server 的 stdout 只用于 JSON-RPC**，所有日志/调试信息走 stderr
7. **数据库列名用 snake_case，TypeScript 代码用 camelCase**，Repository 层负责转换
8. **新增功能必须附带测试**，覆盖正常路径 + 至少一个异常路径

**Anti-Patterns（禁止事项）：**

```typescript
// ❌ Service 层直接操作终端
console.log('Scanning...');  // 禁止
process.exit(1);             // 禁止

// ❌ 跨层直接引用内部文件
import { scanDocumentsImpl } from '../services/scan-service.js';  // 禁止，应通过 index.ts

// ❌ Repository 返回 camelCase 或 Service 返回 snake_case
return { source_path: '...' };  // Repository 层：✅ 正确
return { source_path: '...' };  // Service 层：❌ 错误，应已转换为 sourcePath

// ❌ 散装参数代替输入对象
async queryRelations(docPath: string, type?: string, depth?: number)  // 禁止

// ❌ 吞掉异常
try { ... } catch (e) { /* 静默忽略 */ }  // 禁止

// ❌ CLI 入口顶层执行 parse（CR-CLI-02）
const program = new Command();
program.parse(process.argv);  // 顶层执行，任何导入都会触发副作用

// ❌ CLI entrypoint 守卫字符串拼接（CR-CLI-01）
if (import.meta.url === `file://${process.argv[1]}`) { ... }  // 空格路径静默失效

// ❌ CLI entrypoint 守卫无判空调用（CR-CLI-01）
if (import.meta.url === pathToFileURL(process.argv[1]).href) { ... }  // argv[1] 缺失时崩溃

// ❌ coverage.exclude blanket glob（CR-COV-01）
exclude: ['src/**/index.ts']  // 误伤含业务逻辑的 src/cli/index.ts
```

**P18. AGENTS.md 共享文件处理规则（NFR12 appendable 例外）：**

`AGENTS.md` 是 Copilot 与 Codex CLI 共享的指令文件，属于 NFR12 零侵入策略的显式例外，必须按以下规则处理：

| 场景 | 行为 |
|------|------|
| 文件不存在 | **create-if-absent**：创建文件，写入 CORD 所需内容 |
| 文件已存在，格式兼容 | **preserve-if-exists**：保留原内容，以 `<!-- CORD:START -->...<!-- CORD:END -->` 注释边界追加 CORD 专属配置段 |
| 文件已存在，格式冲突 | **explicit-conflict**：返回 `AGENTS_MD_CONFLICT` 结构化错误，不自动覆盖；非 TTY 场景同样适用 |

```typescript
// ✅ 正确：AGENTS.md 追加 CORD 配置段（注释边界保护）
const existing = fs.readFileSync('AGENTS.md', 'utf-8');
const cordSection = `\n<!-- CORD:START -->\n${cordContent}\n<!-- CORD:END -->\n`;
fs.writeFileSync('AGENTS.md', existing + cordSection);

// ❌ 禁止：直接覆盖已有 AGENTS.md
fs.writeFileSync('AGENTS.md', newContent);  // 禁止（会丢失用户原有内容）
```

测试断言要求：必须覆盖 create-if-absent / preserve-if-exists / explicit-conflict 三个分支（见 Story 5.3 共享文件处理契约）。
