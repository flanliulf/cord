---
project_name: 'CORD'
user_name: 'Fancyliu'
date: '2026-05-24'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 150
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
| Node.js | 运行时 | `>=20`；tsup target 为 `node20` |
| TypeScript | 开发语言 | `^5.8.3`；严格模式, ESNext target, NodeNext 模块解析 |
| ESM | 模块系统 | `"type": "module"`, 所有 import 必须带 `.js` 后缀 |
| tsup | 构建打包 | `^8.5.1`；ESM 输出；入口为 `src/index.ts`、`src/cli/index.ts`、`src/mcp/server.ts` |

### 核心运行时依赖

| 依赖 | 用途 | 版本说明 |
|------|------|---------|
| commander | CLI 框架 | `^14.0.3` |
| @clack/prompts | 交互式向导 | `^1.2.0`；`cord init` 专用 |
| chalk | 终端着色 | `^5.4.1`；纯 ESM，与项目 ESM-first 一致 |
| better-sqlite3 | SQLite 存储 | `^12.8.0`；同步 API, WAL 模式, native addon |
| @modelcontextprotocol/sdk | MCP Server | `^1.29.0`；⚠️ 注意包名（非 @anthropic-ai/mcp-sdk） |
| zod | 数据验证 | `^3.24.2`；⚠️ 锁定 v3，避免 v4 语义漂移 |
| zod-to-json-schema | JSON Schema 生成 | `^3.25.2`；MCP schema 生成辅助 |
| unified + remark-parse | Markdown AST | `^11.0.5` / `^11.0.0`；纯 ESM |
| remark-frontmatter + remark-gfm | remark 插件 | `^5.0.0` / `^4.0.1`；纯 ESM |
| gray-matter | Frontmatter 解析 | `^4.0.3`；YAML 配置复用 |

### 开发依赖

| 依赖 | 用途 | 版本说明 |
|------|------|---------|
| vitest | 测试框架 | `^4.1.3`；Node environment；V8 coverage |
| eslint | 静态分析 | `^10.2.0`；⚠️ v10 仅支持 flat config（无 .eslintrc） |
| typescript-eslint | TypeScript lint | `^8.58.1` |
| prettier | 代码格式化 | `^3.8.1` |
| semantic-release | 自动版本管理 | `^25.0.3`；npm provenance 从第一天启用 |
| @semantic-release/git | Release commit | `^10.0.1`；必须包含 `package-lock.json` |

### 关键版本决策点

1. **Zod v3 vs v4** — 锁定 v3.x；v4 存在破坏性变更（`z.object` API 变化）
2. **ESLint ≥ v10** — 已移除 `.eslintrc` 支持，只能使用 flat config（`eslint.config.js`）
3. **MCP SDK 包名** — `@modelcontextprotocol/sdk`（不是 `@anthropic-ai/mcp-sdk`）
4. **chalk v5+** — 纯 ESM 模块，不支持 `require()`；架构文档原指定 picocolors，所有引用处需替换为 chalk
5. **TypeScript 版本** — 当前使用 `^5.8.3`；升级到新主版本前必须重新验证 NodeNext 解析、tsup dts 输出与测试编译

## 关键实现规则

### 语言特定规则（TypeScript / ESM）

- 项目是 ESM-first：所有相对 import 必须写运行时 `.js` 后缀，即使源文件是 `.ts`。
- Node 内置模块必须使用 `node:` 前缀，例如 `node:fs`、`node:path`、`node:url`。
- 禁止使用 `require()` / `module.exports`；chalk v5、unified、remark 依赖均按 ESM 使用。
- TypeScript 严格模式开启：禁止 `any`，公共 API 与跨层方法必须声明显式返回类型。
- schema 类型以 Zod v3 为准：对外验证入口必须通过 `validateWithCordError` 或等价包装，把 `ZodError` 转为 `CordError` 子类。
- 含 `.default()` / `.transform()` 的 helper 泛型必须保留 input/output 差异，避免用会把 Input 固定为 Output 的窄泛型。
- 互斥可选字符串字段必须使用 `trim().min(1).optional()` + `refine` 双重约束；空字符串不能被当成“未提供”绕过互斥校验。
- Repository 层因 better-sqlite3 保持同步 API；Scanner、CLI action、MCP handler 保持 async。
- 错误必须使用 `CordError` 子类并携带稳定 `code`、`suggestion`、结构化 context；Service 层不得 `console.log` 或 `process.exit`。
- MCP Server stdout 专用于 JSON-RPC；所有日志、debug、诊断信息只能写 stderr。
- 测试中构造缺字段对象时使用显式对象字面量，禁止 `_` 解构丢字段触发 lint。

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
- Repository mapper 遇到 metadata JSON 损坏或枚举越界时必须抛 `StorageError`，并携带稳定 `code`、`suggestion` 与 `table/id/column` 等结构化 context；禁止继续抛普通 `Error` 让上层依赖字符串匹配
- Service 层禁止 `console.log` / `process.exit`
- MCP Server 的 stdout 只用于 JSON-RPC，日志走 stderr
- 禁止静默吞掉异常

**Schema 契约（CR-SCHEMA-01）：**

- `DocumentNode.createdAt` / `updatedAt` 必须是 ISO 8601 datetime 字符串
- `DocumentNode.path` 必须是 normalized project-relative POSIX path；禁止绝对路径、Win32/UNC 路径、反斜杠与 `..` 逃逸
- `ScanInput.projectRoot` 必须是跨平台绝对路径，允许 POSIX / Win32 absolute 形式

**Service 方法签名（P11）：**

```typescript
// ✅ 输入：单一对象参数，Zod schema 推导类型
async scanDocuments(input: ScanInput): Promise<ScanResult>

// ❌ 禁止散装参数
async scanDocuments(path: string, incremental: boolean): Promise<any>
```

### 框架特定规则（双入口架构 + 适配器模式）

- CLI 与 MCP 都是 L3 薄入口：只做参数解析、调用 Service、格式化输出；业务逻辑必须在 L2 Service。
- L3 入口不得直接访问 Repository；L2 Service 只依赖 `IGraphRepository` 等接口，不 import 具体实现。
- 跨层引用必须通过各层 `index.ts` 门面；禁止 CLI 直接引用 MCP 内部模块或 Repository 内部实现。
- MCP Tool 的 input/output schema 以 `src/mcp/tools/schemas.ts` 命名 Zod schema 为共享契约源，必须镜像 CLI JSON / Service DTO，不得为 MCP 裁剪字段。
- MCP Tool 名使用 snake_case，参数使用 camelCase；当前工具面覆盖 `init_graph`、`query_relations`、`analyze_impact`、`sync_docs`、`add_relation`、`remove_relation`、`deprecate_relation`。
- `sync_docs.reason` 直接复用 `AnalyzeImpactResult.suggestedAction`，`action` 只能由 `updateStrategy` 推导，避免第二套建议语义。
- Framework adapter 使用 `IFrameworkAdapter -> AbstractFrameworkAdapter -> 具体适配器`；新增适配器不得修改核心 scanner/service 源码。
- Framework/BMAD discovery 是 best-effort：单个路径 `lstat/readdir/readFile` 异常只能跳过当前路径，不得中断整个扫描，也不得顺手把同步接口改成 async。
- IDE adapter 使用 `IIdeAdapter`；`cord init` 零侵入写入 CORD 文件，不覆盖 IDE 既有配置。
- `AGENTS.md` 是 Copilot + Codex CLI 共享指令文件，属于 NFR12 appendable 例外：不存在则创建，存在则只追加 `<!-- CORD:START -->...<!-- CORD:END -->` 段，冲突返回 `AGENTS_MD_CONFLICT`。
- Claude Code 初始化需要同时生成 MCP 配置、hooks 与 4 个 schema-linked skills；hooks/skills 生成必须与实际 MCP/CLI schema 保持一致（CR-IDE-01）。
- `cord init` 默认生成 YAML 配置，并保留 `updateStrategies` 示例；配置 schema 变更必须先裁决契约再实现。

**CLI 关键约束：**
- 命令名 kebab-case：`cord init`、`cord scan`、`cord impact`
- 选项 `--kebab-case`：`--output-format`、`--relation-type`
- 所有命令支持 `--json` 标志输出 JSON 格式
- 错误输出使用 chalk 着色 + CordError 的 suggestion 字段

**CLI 入口文件约束（CR-CLI-01/02/03/04/05，来源：Story 1-2、2-5 CR 历史）：**

- **禁止**在 `src/cli/index.ts` 等入口模块的顶层直接执行 `program.parse()`；所有 `parse()` / `process.exit()` 调用必须封装在函数内，并由 entrypoint 守卫保护（CR-CLI-02）
- **若 Commander 树中存在任何 `async` action，`runCli()` 必须为 `async` 并使用 `await program.parseAsync(process.argv)`；entrypoint 守卫必须以 `void runCli().catch(reportUnhandledCliError)` 或等效方式兜底未捕获异步错误**（CR-CLI-04）
- **CLI 退出码契约的最终 owner 是真实入口 `runCli()`**：不能只在单个 command factory 中处理 `ConfigError` / parse error；入口级测试必须直接覆盖这些路径（CR-CLI-04）
- **ESM entrypoint 守卫必须使用三步归一化写法**（CR-CLI-01）：
  ```ts
  import { realpathSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  const entryArg = process.argv[1];
  if (entryArg) {
    let entryUrl: string;
    try { entryUrl = pathToFileURL(realpathSync(entryArg)).href; }
    catch { entryUrl = pathToFileURL(entryArg).href; }
    if (import.meta.url === entryUrl) { void runCli().catch(reportUnhandledCliError); }
  }
  ```
  ⚠️ 禁止使用 `` `file://${process.argv[1]}` `` 或无判空的 `pathToFileURL(process.argv[1]).href`
- **CLI helper 函数**（如 `applyVerboseFlag`）必须抽到独立的无副作用模块（如 `src/cli/verbose.ts`），测试直接导入 helper，不导入入口文件（CR-BP-01）
- **禁止依赖 Commander `preAction` 处理全局选项**（如 `--verbose`），除非已注册至少一个 `.action()`；无 action 时改用 `parse()` 之后 `program.opts()` 同步处理（CR-CLI-03）
- **`--verbose` / debug 级别必须在 async action 执行前生效**：真实入口应在 `parseAsync` 前处理 root-level `-v` / `--verbose` 或使用可靠的 pre-action 机制，并保留入口级 action 内 debug 输出回归测试（CR-CLI-05）

**Query / CLI 边界约束（CR-QUERY-01/02/03，来源：Story 3-1 CR 历史）：**

- **所有会触发默认 Service / Repository 初始化或文件系统副作用的 CLI 命令，必须先完成输入校验与路径归一化，再调用 `serviceFactory()` 或创建数据目录**（CR-QUERY-01）
- **凡是以 project-root 相对路径作为仓储查询契约的命令，CLI 层必须先把 `./...`、绝对路径等输入归一化为 project-relative POSIX path，并显式拒绝 `''`、`'..'`、`'../...'` 这类项目根外路径；拒绝必须发生在 service 初始化之前，并返回稳定 `ConfigError`**（CR-QUERY-02）
  - 对原始路径文本必须先做 `trim()` 等标准化，再执行 `resolve()` / `relative()`、project-root 边界判断与 schema 校验；禁止先做边界判断、再依赖 schema 或 Service 隐式清理空白
  - 回归测试至少覆盖：带前后空白的项目外相对路径输入、带前后空白的项目外绝对路径输入，都必须在 `serviceFactory()` 前稳定返回 `ConfigError`
  - 跨平台回归必须覆盖 win32 语义：至少验证跨盘符路径（如 `D:\outside.json`）与 UNC 路径（如 `\\server\share\outside.json`）会在入口层被拒绝；若 `relative(projectRoot, input)` 结果仍为绝对路径，必须判定为 project-root 外路径并在 `serviceFactory()` 前返回 `ConfigError`
- **若默认 Service 封装了带 `close()` 的 Repository / 连接资源，Service 层必须显式转发生命周期方法；禁止让入口层的 `finally { service?.close?.(); }` 在默认实现上退化为空调用**（CR-QUERY-03）

**只读命令 / 健康检查规则（CR-STATUS-01/02/03，来源：Story 3-5 CR 历史 + TODO-028 治理）：**

- **CR-STATUS-01：声明为观测型的 status / health 命令不得因读取而初始化存储**
  - 适用范围：`status`、`query`、`impact`、`export`、health check、diagnostic summary 等只读/观测命令
  - 若持久化存储不存在，必须返回“未初始化”或空状态；禁止为读取创建 `.cord`、数据库文件或隐式执行迁移；`query` / `impact` / `export` 默认 CLI 路径必须先检查 `.cord/cord.db` 是否存在，再创建 repository
  - 若命令语义需要区分“未初始化”和“已初始化但空图谱”，必须在结果字段或文本输出中显式保留该边界
  - 回归测试至少覆盖：未初始化项目执行只读命令后不创建 `.cord/cord.db`，且返回稳定状态载荷
  - 输入错误和配置错误必须在默认 service / repository 初始化前完成校验；`export` 的 `projectName` 配置错误不得先读取 repository 或创建 `.cord`

- **CR-STATUS-02：健康检查统计必须来自同一持久化快照**
  - 文档数、关系数、按类型分布、过时关系、孤立节点、悬空边、迁移版本等对外展示字段，必须由单次 repository transaction 或等价 snapshot 一致派生
  - `StatusService` 是持久化图谱库存与健康快照：`relationCount`、`relationsByType`、`staleRelations`、`orphanedNodes`、`danglingEdges` 均使用 active + deprecated 全量关系口径；`status='deprecated'` 是状态位，不重写 `relationType`
  - 禁止用前序数组读取计算派生指标，再用后续独立 count 查询回填总数，形成混合口径
  - 图健康判断中，只有双端都存在的关系才能证明节点 connected；dangling relation 只能计入异常指标，不能降低 `orphanedNodes`
  - 回归测试至少覆盖：fake repository 在二次 count 查询时返回不同口径时，status 输出仍来自同一快照；文档唯一关系为 dangling 时仍计入 `orphanedNodes`

- **CR-STATUS-03：资源清理失败不得覆盖 status 主结果**
  - 任何 `finally` 中的 `close()` / `dispose()` / `release()` 都属于 best-effort cleanup；清理失败不得覆盖已经写出的成功输出、原始错误 payload 或 exit code
  - 若需要上报 cleanup failure，只能作为附加诊断信息，不能替换主流程错误
  - 回归测试至少覆盖：成功路径 cleanup 抛错仍保持 exitCode 0 和原输出；失败路径 cleanup 抛错仍保留原始业务错误

**导出快照可靠性规则（CR-EXPORT-01/02/03，来源：TODO-029/030/031 治理）：**

- **CR-EXPORT-01：JSON 快照排序必须使用显式二进制字符串比较**
  - `documents` 与 `relations` 的稳定排序禁止依赖默认 `localeCompare()`；必须使用 `<` / `>` 等 locale-independent binary comparator，避免不同 Node / ICU / locale 环境生成无意义 git diff
  - 回归测试至少覆盖大小写、数字段和非 ASCII 路径/ID 的排序稳定性

- **CR-EXPORT-02：快照写入必须使用同目录临时文件 + 原子 rename**
  - 导出写入必须先写目标文件同级临时文件，再 `rename()` 到最终路径；临时写失败时必须保留既有快照，并 best-effort 清理临时文件
  - 已存在的输出文件允许被原子替换；禁止用“拒绝覆盖”替代导出命令的 git 审阅快照刷新语义
  - 回归测试至少覆盖：已有快照被原子覆盖、临时写失败时旧快照仍保留

- **CR-EXPORT-03：导出输出路径必须同时做词法边界与物理边界校验**
  - CLI `--output snapshots/` 或以路径分隔符结尾的目录形态输入，必须解析为 `snapshots/cord-snapshot.json`
  - CLI 层必须在 `serviceFactory()` 前拒绝 project-root 词法外逃逸，包括 POSIX `../...`、win32 跨盘符、win32 UNC 跨 root；若 `relative(projectRoot, input)` 结果仍是绝对路径，视为 project-root 外
  - 对已存在的输出祖先目录，CLI 还必须通过 `realpath` 校验物理位置，拒绝指向 project-root 外的 symlink 目录；测试至少覆盖 win32 UNC projectRoot 内部路径、目录形态输出和 symlink 物理逃逸

**Query / Traversal 语义规则（CR-QUERY-05/06/07，CR-PERF-01，来源：Story 3-2、3-3 CR 历史）：**

- **CR-QUERY-05：图遍历必须分离“可扩展边”与“可输出边”**
  - 适用范围：所有基于关系图的 BFS / DFS 查询
  - `type`、标签或展示过滤等结果语义只控制输出，不默认裁剪遍历；除非需求明确声明“过滤即截断路径”
  - 可扩展边必须由路径有效性语义决定，例如 `includeDeprecated`、方向、深度或状态约束，而不是由最终展示过滤直接决定
  - 回归测试至少覆盖：`depth + type` 场景下，经非匹配中间边仍可抵达深层匹配关系

- **CR-QUERY-06：既不输出也不扩展的非匹配边必须在端点解析前跳过**
  - 先计算 `hopDistance`、`shouldOutput`、`shouldExpand` 等派生条件，再决定是否解析 relation 另一端文档
  - 当 `!shouldOutput && !shouldExpand` 时，必须直接跳过；禁止先解析端点再因过滤条件丢弃
  - 回归测试至少覆盖：匹配有效边与非匹配缺失端点边并存时，过滤查询返回匹配结果，而不是被无关坏边阻断

- **CR-QUERY-07：受影响文档集合类分析必须自有定向遍历语义**
  - 适用范围：impact / affected-doc / downstream propagation 这类输出“文档集合”的分析服务
  - 若路径资格依赖 `status`、`confidence`、方向等传播语义，必须在扩展前判断；禁止先执行通用双向查询再对结果做后过滤
  - Impact 的 relationType 级传播方向必须由 `src/types/relations.ts` 中的显式矩阵定义；v0.1 所有内置 relationType 均按 source -> target 传播，且仅 `status='active'` 可传播。`derived_from` 表示目标文档从源文档派生，`contains` 表示源文档逻辑包含目标文档，二者都不反向传播
  - 结果若按文档计数，必须按 impacted document 聚合去重；`totalCount` 等基数字段必须与去重后的文档集合一致
  - 源文档不得因自环、回源环或多路径回流出现在自身结果中；若同一文档可经多条路径命中且需保留关系元数据，必须定义稳定候选优先级
  - 回归测试至少覆盖：反向边不误报、低置信桥接边不继续扩展、自环/回源环不回写源文档、多路径命中同一文档只计一次

- **CR-PERF-01：性能 AC 必须让规模差异进入被测热路径，必要时补真实仓储路径验证**
  - 性能回归/扩展性测试必须证明数据规模变化会改变实际访问的节点、边或底层查询成本；禁止只扩大图总量却仍测量常数大小局部子图
  - 若内存仓储、预建索引或 mock 无法代表真实查询成本，必须补至少一条真实 repository 路径验证，覆盖实际 `getRelationsByDocId`、索引或 IO 行为
  - 主单元测试优先使用确定性证据（如访问计数、SQLite `EXPLAIN QUERY PLAN` / 索引命中）证明热路径；环境敏感的 wall-clock / p95 benchmark 应移出 release-blocking 单元套件或仅作为可选 benchmark
  - 环境敏感但不影响运行时正确性的 benchmark 抖动可作为 CR TODO 跟踪，但不得替代当前 Story 的热路径验证

### Repository 层开发规则（来源：Story 1-4、2-5 CR 历史）

**CR-REPO-01：update 方法禁止接受不可变字段**
- 所有 `update*` 接口签名必须使用 `Omit<Partial<EntityType>, 'id' | 'createdAt' | 'updatedAt'>`，排除不可变字段
- 实现层解构丢弃不可变字段，显式透传 `existing.createdAt`（避免 spread merge 覆盖）
- 返回值必须与 DB 持久态完全一致，禁止返回「看似更新成功但实未写库」的值
```typescript
// ✅ 正确
updateDocument(id: string, updates: Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode

// ❌ 禁止：允许传入不可变字段
updateDocument(id: string, updates: Partial<DocumentNode>): DocumentNode
```

**CR-REPO-02：Mapper 层必须对 DB 值做运行时防御校验**
- JSON 字段：`try/catch` + 含 `{ cause }` 的上下文错误，禁止裸 `JSON.parse(raw) as T`
- 枚举字段：白名单 `assertEnum<T>(value, VALID_SET, context)` 校验，禁止裸 `as EnumType`
- DB 层 `CHECK` 约束必须与 TS 枚举白名单保持对称（两处必须同步更新）
```typescript
// ✅ 正确：带上下文的防御校验
function parseJsonMetadata(raw, context): Record<string, unknown> | undefined {
  try { return JSON.parse(raw); } catch (err) { throw new Error(`...`, { cause: err }); }
}
function assertEnum<T extends string>(value: string, valid: Set<string>, context: string): T {
  if (!valid.has(value)) throw new Error(`[mappers] Invalid value "${value}" for ${context}`);
  return value as T;
}

// ❌ 禁止：裸断言，脏数据会让整个查询链路崩溃
return { relationType: row.relation_type as RelationType };
```

**CR-REPO-03：构建产物中的静态资源必须内联为 TS 模块（禁止运行时 readFileSync）**
- 迁移 SQL 等构建时已知的静态文本：以 TS 模块字符串常量内联，编译时绑定
- tsup 仅打包 TS/JS 文件，`.sql`/`.json` 等资源文件不会出现在 `dist/` 中
- 见「数据库迁移（D2）」中的 CR-REPO-03 条目
```typescript
// ✅ 正确：内联为 TS 模块常量
export const MIGRATION_001_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (...)`;

// ❌ 禁止：运行时文件系统读取，dist/ 中不存在该文件
const sql = readFileSync(join(fileURLToPath(import.meta.url), '..', '001.sql'), 'utf-8');
```

**CR-REPO-04：唯一索引维度必须与接口 source 语义契约对齐**
- 当接口暴露了「按 source 区分保留/删除」能力（如 `excludeSources` 参数），唯一索引必须包含 `source` 维度
- DB `CHECK` 约束的枚举值必须与 TS 类型白名单完全一致，不得只改一处

**CR-REPO-05：批量写入必须先计算可持久化 workset，再进入事务**
- 涉及 documents / relations / sync_states 等多阶段批量写入时，必须先在事务外过滤不可持久化项，并为被跳过项记录 warning
- 事务内只处理已经验证过的完整 workset；若发现端点映射或写入计划失配，必须抛错回滚，禁止用普通 `return` 提前结束 transaction callback
- 对外暴露的统计字段（如 discovered / written counts）必须与过滤后的实际写入策略一致，不能返回“计划总数”却只提交部分结果

### Scanner / 增量扫描开发规则（来源：Story 2-6 CR 历史）

**CR-SCAN-01：生命周期重绑定必须满足双向唯一最优，歧义时降级为 delete + add**
- 适用范围：所有基于 `contentHash`、路径、basename 等弱身份信号推断 rename / move / merge 的逻辑
- **禁止**使用数组顺序、FIFO `shift()`、字典序 tiebreaker 等非语义排序直接决定既有 `docId` 与新路径的绑定关系
- 只有 stored 侧与 current 侧都形成**唯一最优匹配**时，才允许认定为 rename / move；可使用同目录、同 basename、basename 编辑距离、路径距离等语义信号做评分
- 若第一名与第二名并列，或多候选下无法形成双向唯一最优匹配，必须保守降级为 delete + add，禁止静默强配对
- 相关测试必须同时覆盖两类场景：
  - 存在稳定路径信号时可正确消歧
  - 真正歧义时降级为 delete + add，而不是错误更新 `docId`

**CR-SCAN-02：人工修正必须落成扫描保护可识别的持久化信号**
- 适用范围：`RelationService`、`ScanService`、增量扫描/重建的数据保护逻辑、人工修正相关 API
- 当业务要求“人工修正优先于自动扫描”时，必须把人工语义写成跨流程可复用的持久化信号（如 `source='manual'` 或等价标记），禁止只在调用约定、临时内存态或局部 metadata 分支里隐含表达
- 删边保护、写回冲突处理、rebuild 警告等路径必须消费同一套人工修正判定标准，禁止一处按 `source`、另一处按临时状态，导致收敛保护语义漂移
- 回归测试必须覆盖真实 service mutation 路径：先由扫描生成自动关系，再调用手动修正 API，再执行增量扫描/重建，断言人工修正仍被保留

**CR-SCAN-03：批内候选裁剪必须先比较来源优先级，再比较置信度**
- 适用范围：所有进入持久化前的关系 dedupe / merge / 候选裁剪逻辑
- 对同一业务键的候选关系，必须先比较业务来源优先级（如 `manual > framework_preset > auto_scan`），仅在同来源内再比较 `confidence` 或其他次级启发式
- 禁止让前置裁剪与最终持久化使用两套不同的优先级规则；若最终写入依赖 `getRelationSourcePriority()`，前置 dedupe 必须复用同一函数或等价实现
- 同批次冲突测试必须覆盖“低优先级候选 confidence 更高”的逆向场景，确保业务优先级不会在进入最终写入逻辑前被提前截断

**CR-SCAN-04：框架/BMAD 文件发现的局部 fs 异常必须非致命**
- 适用范围：`AbstractFrameworkAdapter.discoverDocuments()`、BMAD detector skills/frontmatter 候选遍历
- `lstatSync()` / `readdirSync()` / `readFileSync()` 这类局部路径异常只能导致当前路径或当前文件被跳过；不得让权限错误、删除竞态、不可读目录或“文件伪装成目录”直接中断整个框架检测/文档发现
- 当前 `IFrameworkAdapter.discoverDocuments()` 仍保持同步接口；禁止为处理局部异常顺手升级为 async discovery API，异步化属于独立接口级 Story
- 回归测试至少覆盖：framework discovery 跳过不可读目录、BMAD skills 路径不可读不抛、BMAD frontmatter 候选目录不可读不抛

**CR-SCAN-05：Markdown 链接规则必须通用过滤非文件 URI scheme**
- Markdown link 自动关系只接受本地/项目内路径引用；凡匹配 URI scheme（如 `http:`, `https:`, `mailto:`, `tel:`, `file:`, `vscode:`, 自定义 `custom+scheme:`）的引用必须跳过
- 禁止只维护 `http://` / `https://` 白名单式过滤；回归测试必须覆盖 URI 文本恰好能匹配本地文件名时仍不生成关系

**CR-SCAN-06：BMAD frontmatter 检测只接受独立分隔符行**
- BMAD detector 的 YAML frontmatter 仅在开头 `---` 行和后续独立 `---` 结束行之间提取，必须支持 LF 与 CRLF
- `---not-a-delimiter`、尾随文本或非独立结束标记不得被当作合法 frontmatter 结束点，避免误报 `bmad-frontmatter` 信号

**CR-SCAN-07：BMAD frontmatter 候选必须优先扫描高价值路径**
- BMAD detector 受 `MAX_FRONTMATTER_FILES` 等预算约束时，frontmatter 候选遍历必须优先检查 `_bmad-output/`、`docs/`、项目根 Markdown 等高价值路径，再检查任意深层路径
- 回归测试必须覆盖：根目录存在超过预算的 Markdown 噪声文件时，`docs/` 或 `_bmad-output/` 中的 BMAD frontmatter 仍可被检测到

### 测试规则

- 测试框架为 Vitest，`globals: false`，Node environment；测试文件统一放在 `tests/**/*.test.ts`。
- 单元测试镜像 `src/` 层级；集成测试按 `cli/`、`mcp/`、`flows/` 场景组织。
- 覆盖率 provider 为 V8；整体阈值为 lines/functions/branches/statements 均 `80`。
- `coverage.exclude` 只能显式枚举纯 re-export barrel 文件；禁止 `src/**/index.ts` 这类 blanket glob，`src/cli/index.ts` 必须留在覆盖率门禁内。
- Story AC 覆盖率要求优先于架构分层下限；若 Story 明确要求更高阈值，按 Story 执行。
- Service 测试 mock `IGraphRepository` 接口；CLI/MCP 测试 mock Service 层；Repository 测试使用内存 SQLite。
- CLI 命令测试必须按层分工：command factory 覆盖参数转发/格式化，真实 `runCli()` 入口覆盖 parse error、业务 `ConfigError`、runtime error 与 exit code。
- MCP 测试必须覆盖 schema 冻结、工具列表、结构化 content 与 CLI JSON DTO 字段同构。
- 新增错误码、suggestion 或 JSON 错误载荷时，必须在对应层补契约测试。
- 测试 helper 生成时间戳、序列号等单调数据时使用“固定基准值 + 数值偏移”，并覆盖 9->10 或 99->100 等跨位数边界。
- 性能/扩展性 AC 不靠环境敏感 wall-clock 作为主证据；优先验证真实热路径访问计数、索引命中或真实 repository 查询行为。
- Epic flow 测试用于锁定跨层用户路径，例如 scan -> query -> impact、MCP core tools、IDE init、hooks/skills、README/CLI/MCP docs 对齐。

### 代码质量与风格规则

- 文件名使用 kebab-case；类名 PascalCase；函数/方法 camelCase；常量 SCREAMING_SNAKE_CASE。
- 接口继续使用 `I` 前缀，例如 `IGraphRepository`、`IFrameworkAdapter`、`IIdeAdapter`；类型别名不加前缀。
- Zod schema 使用 camelCase + `Schema` 后缀；验证函数使用 `validateXxx` 命名。
- DB 表/列保持 snake_case 复数/字段名；Service/CLI/MCP 对外 DTO 使用 camelCase；snake_case <-> camelCase 转换只在 Repository mapper 边界处理。
- 每个架构层通过 `index.ts` 暴露公共 API；跨层 import 只走门面，避免直接绑定内部文件。
- 公共 API 必须有 JSDoc；行内注释只解释非显然的 WHY，不解释代码表面行为。
- ESLint 使用 flat config；禁止新增 `.eslintrc`；格式化以 Prettier 为准。
- 关系类型固定为 9 种：`sync_required`、`context_for`、`lifecycle_bound`、`contains`、`must_consistent`、`sync_suggested`、`derived_from`、`deprecated`、`references`。
- Relation status 与 relationType 分离：`status='deprecated'` 是状态位，不得把业务关系类型重写成 `deprecated` 来表达废弃。
- JSON snapshot 排序必须用显式二进制字符串比较，禁止默认 `localeCompare()`。
- 写文件类操作涉及可审阅快照时，优先使用同目录临时文件 + 原子 rename；失败时保留旧文件并 best-effort 清理临时文件。

### 开发工作流规则

- 源码按 `src/cli`、`src/mcp`、`src/services`、`src/repositories`、`src/scanner`、`src/adapters`、`src/schemas`、`src/types`、`src/utils` 分层组织。
- 依赖方向严格单向：L3 CLI/MCP -> L2 Service -> L1 Repository；禁止反向依赖和同层跨域引用。
- 迁移脚本位于 `src/repositories/migrations/`；运行时迁移 SQL 必须内联为 TS 模块字符串常量，不能依赖 dist 中存在 `.sql` 文件。
- migration 子步骤必须独立幂等；部分迁移数据库也必须能自愈到完整目标 schema。
- v0.1 pre-release 阶段允许重写既有 migration；首个稳定 release 后切换为只增不改的增量迁移模式。
- 配置支持 `cord.config.yaml` 与 `cord.config.json`，同时存在时 YAML 优先；加载后必须通过 Zod schema 验证。
- `cord init` 默认生成 YAML；示例配置必须包含 `updateStrategies` 注释示例。
- 配置字段或对外 JSON 字段变更必须先完成产品/架构契约裁决，再实现代码和测试；禁止临时 fallback 替代未裁决契约。
- PR/本地质量门禁使用实际脚本：`npm run lint`、`npm run type-check`、`npm test`、`npm run test:coverage`、`npm run build`。
- 发布由 semantic-release 统一负责；release workflow 必须保留 npm provenance/OIDC 所需权限，并确保 `package-lock.json` 随版本提交同步。
- Rule Document Registry 是规则变更门禁：确认/修改/新增规则、约定或豁免时，必须同步 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md`。
- Story/CR 工作流中的新增规则必须当轮沉淀到镜像文档；不得只留在 CR summary 或 TODO 中。

### 关键易错规则

- 不要在 Service 层 `console.log` / `process.exit`；入口层负责输出与退出码，Service 层抛 `CordError`。
- 不要在 MCP Server stdout 输出任何非 JSON-RPC 内容；debug/log 必须走 stderr。
- 不要用 `require()`、`.eslintrc`、无 `.js` 后缀 import，或错误 MCP 包名 `@anthropic-ai/mcp-sdk`。
- 不要为 MCP Tool 另建裁剪版 DTO；CLI JSON、Service DTO、MCP schema 必须保持同构。
- 不要在只读命令中初始化 `.cord/cord.db`；status/query/impact/export 未初始化时返回稳定空状态或未初始化状态。
- 不要在默认 Service 包装资源后忘记转发 `close()`；入口层 cleanup 失败也不得覆盖主流程结果或错误。
- 不要把路径校验放到 service/repository 初始化之后；project-root 边界、Win32 跨盘符、UNC、symlink 物理逃逸必须先拒绝。
- 不要用 `localeCompare()` 生成可审阅 JSON snapshot 排序；不要用非原子写覆盖既有 snapshot。
- 不要让人工关系被扫描覆盖：manual > framework_preset > auto_scan 必须在批内裁剪和最终持久化使用同一优先级。
- 不要把生命周期 rename/move 歧义强行匹配；只有双向唯一最优才可复用 docId，否则降级为 delete + add。
- 不要让 local fs 异常中断 framework/BMAD discovery；单路径失败只能跳过当前路径。
- 不要把 `status='deprecated'` 误建模为 relationType；状态位和业务关系类型必须分离。
- 不要改动用户未明确要求的文件；如需同步 Rule Document Registry 之外的文件，先获得明确许可。

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

最后更新：2026-05-24
