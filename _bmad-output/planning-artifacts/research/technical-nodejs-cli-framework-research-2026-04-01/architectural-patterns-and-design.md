# Architectural Patterns and Design

## 系统架构模式：分层 + 命令模式

### CORD CLI 推荐分层架构

```
┌─────────────────────────────────────────────┐
│              入口层 (Entry Points)            │
│  bin/cord.js (CLI)    src/mcp/index.ts (MCP) │
├─────────────────────────────────────────────┤
│              命令层 (Command Layer)           │
│  src/cli/commands/    src/mcp/tools/         │
│  Commander 子命令      MCP Tool 注册          │
├─────────────────────────────────────────────┤
│              服务层 (Service Layer)           │
│  src/services/                               │
│  RelationService, ScanService, GraphService  │
├─────────────────────────────────────────────┤
│              数据层 (Repository Layer)        │
│  src/repository/                             │
│  SQLiteRepository (better-sqlite3)           │
├─────────────────────────────────────────────┤
│              基础设施层 (Infrastructure)       │
│  src/config/   src/logger/   src/utils/      │
└─────────────────────────────────────────────┘
```

**架构关键约束：**

| 约束 | 说明 | 原因 |
|------|------|------|
| **命令层 → 服务层** | 命令层只调用服务层，不直接操作数据库 | 保持 CLI/MCP 命令的薄封装，便于测试 |
| **服务层不感知调用者** | Service 不知道是 CLI 还是 MCP 在调用它 | 保证两个入口的行为一致性 |
| **数据层只暴露接口** | Repository Pattern 封装所有 SQL | TR1 已验证此模式，便于未来数据库迁移 |
| **基础设施层被所有层依赖** | config/logger/utils 是公共基础 | 配置和日志需要全局可访问 |

---

## 设计原则与最佳实践

### CLI 领域核心设计原则

| 原则 | 应用于 CORD CLI | 具体实践 |
|------|----------------|---------|
| **Unix 哲学：做一件事并做好** | 每个子命令专注一个职责 | `cord scan` 只做扫描、`cord relation add` 只做添加 |
| **最小惊讶原则** | 命令行为可预测 | `cord scan` 不会自动修改数据库，`--dry-run` 预览模式 |
| **渐进式信息展示** | 默认简洁、详细可选 | 默认摘要 → `--verbose` 详细 → `--json` 完整数据 |
| **快速失败** | 尽早验证输入 | 在命令执行前验证路径、配置、数据库状态 |
| **幂等性** | 重复执行安全 | `cord init` 重复运行不会破坏已有配置（合并策略） |
| **可组合性** | 可管道串联 | `cord relation list --json \| jq '.[] \| .source'` |

### Commander.js 命令模式（Command Pattern）

Commander.js 天然实现了命令模式：

```typescript
// src/cli/index.ts — 主程序
import { Command } from 'commander';

const program = new Command();
program
  .name('cord')
  .description('Context-Oriented Relation for Documents')
  .version(version);

// 注册子命令组
program.addCommand(createRelationCommand());
program.addCommand(createScanCommand());
program.addCommand(createGraphCommand());
program.addCommand(createConfigCommand());
program.addCommand(createInitCommand());
program.addCommand(createStatusCommand());

// 全局选项
program
  .option('--json', '以 JSON 格式输出')
  .option('-q, --quiet', '静默模式')
  .option('-v, --verbose', '详细输出')
  .option('--no-color', '禁用颜色');

await program.parseAsync();
```

```typescript
// src/cli/commands/relation.ts — 子命令组
export function createRelationCommand(): Command {
  const relation = new Command('relation')
    .description('管理文档关系');

  relation
    .command('add <source> <target>')
    .description('添加文档关系')
    .option('-t, --type <type>', '关系类型', 'references')
    .action(async (source, target, opts) => {
      // 薄封装：参数解析 → 调用 Service → 格式化输出
      const result = await relationService.add(source, target, opts.type);
      outputFormatter.print(result, program.opts());
    });

  relation
    .command('list')
    .description('列出所有关系')
    .action(async () => { /* ... */ });

  return relation;
}
```

_Source: [GitHub - tj/commander.js](https://github.com/tj/commander.js)_

---

## 可扩展性与性能模式

### 懒加载（Lazy Import）优化启动速度

CLI 工具的冷启动速度直接影响用户体验（目标 < 200ms）。关键优化策略：

```typescript
// ❌ 反模式：顶层导入所有命令（拖慢每个命令的启动）
import { scanCommand } from './commands/scan';
import { graphCommand } from './commands/graph';
import { relationCommand } from './commands/relation';

// ✅ 推荐模式：动态导入（只在执行时加载对应命令）
program
  .command('scan')
  .description('扫描文档关系')
  .action(async (...args) => {
    const { scanAction } = await import('./commands/scan');
    return scanAction(...args);
  });
```

**性能影响估算：**

| 模式 | 启动时间（预估） | 说明 |
|------|----------------|------|
| 全量导入 | ~300-500ms | 加载所有命令 + better-sqlite3 + 全部 services |
| 懒加载命令 | ~80-150ms | 只加载 Commander + 命令注册（无实际导入） |
| 懒加载 + SQLite 延迟初始化 | ~50-100ms | 数据库连接延迟到首次查询时 |

**better-sqlite3 延迟初始化模式：**

```typescript
// src/repository/database.ts
let _db: Database | null = null;

export function getDatabase(): Database {
  if (!_db) {
    _db = new Database(getDbPath());
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}
```

### 优雅关闭（Graceful Shutdown）

CLI 需要正确处理中断信号，特别是在 SQLite 写操作进行中时：

```typescript
// src/cli/index.ts
function setupShutdown() {
  const cleanup = () => {
    const db = getDatabaseIfOpen();
    if (db) {
      db.close();  // better-sqlite3 同步关闭，保证数据完整性
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);   // Ctrl+C
  process.on('SIGTERM', cleanup);  // 系统终止
}
```

---

## 参考架构案例分析

### 案例 1：Vite CLI（cac 框架）

| 维度 | 分析 |
|------|------|
| **框架** | 使用 cac（非 Commander），但命令模式相同 |
| **命令数量** | 4 个主命令（dev、build、optimize、preview） |
| **全局选项** | `--config`、`--base`、`--logLevel`、`--mode`、`--debug` |
| **架构特点** | 全局选项清理函数 `cleanGlobalCLIOptions()` 避免向下传递 |
| **CORD 借鉴** | 全局选项设计、异步 action handler + 错误处理模式 |

_Source: [GitHub - vitejs/vite cli.ts](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/cli.ts)_

### 案例 2：create-vue（交互式脚手架）

| 维度 | 分析 |
|------|------|
| **模式** | 默认交互式提示，支持 CLI flag 跳过提示 |
| **提示库** | 使用交互式 prompts 库 |
| **flag 覆盖** | `--typescript`、`--router`、`--bare` 可跳过交互 |
| **CORD 借鉴** | `cord init` 应同时支持交互模式和 flag 模式（CI 友好） |

_Source: [GitHub - vuejs/create-vue](https://github.com/vuejs/create-vue)_

---

## CORD CLI 完整目录结构设计

基于以上架构分析，CORD 项目推荐的完整目录结构：

```
cord/
├── bin/
│   └── cord.js                    # CLI 入口（#!/usr/bin/env node）
├── src/
│   ├── cli/                       # CLI 命令层
│   │   ├── index.ts               # Commander 程序定义 + 全局选项
│   │   ├── commands/              # 子命令目录
│   │   │   ├── init.ts            # cord init（交互式初始化）
│   │   │   ├── scan.ts            # cord scan（文档扫描）
│   │   │   ├── relation.ts        # cord relation <add|remove|list|search>
│   │   │   ├── graph.ts           # cord graph <show|export>
│   │   │   ├── config.ts          # cord config <get|set>
│   │   │   └── status.ts          # cord status（项目状态总览）
│   │   └── formatters/            # 输出格式化
│   │       ├── table.ts           # 表格格式化（cli-table3）
│   │       ├── json.ts            # JSON 格式化
│   │       └── output.ts          # 统一输出分发器
│   ├── mcp/                       # MCP Server 层
│   │   ├── index.ts               # MCP Server 入口
│   │   └── tools/                 # MCP Tool 注册
│   ├── services/                  # 共享业务逻辑层
│   │   ├── relation-service.ts
│   │   ├── scan-service.ts
│   │   ├── graph-service.ts
│   │   └── config-service.ts
│   ├── repository/                # 数据访问层
│   │   ├── database.ts            # SQLite 连接管理（延迟初始化）
│   │   ├── relation-repo.ts
│   │   └── document-repo.ts
│   ├── config/                    # 配置管理
│   │   └── cord-config.ts         # .cord/config.yaml 读写
│   ├── logger/                    # 日志（picocolors）
│   │   └── index.ts
│   └── utils/                     # 公共工具
├── tsup.config.ts                 # 构建配置
├── package.json                   # bin + main + types
└── .cord/                         # 运行时目录（用户项目中）
    ├── config.yaml
    └── cord.db
```

---

## 架构决策记录（ADR）摘要

| ADR # | 决策 | 选择 | 理由 |
|-------|------|------|------|
| ADR-1 | CLI 框架 | Commander.js v14 | 行业标杆、TypeScript 内置、零依赖、Vite/Vue 验证 |
| ADR-2 | 架构模式 | 分层 + 命令模式 | CLI/MCP 共享 Service 层、关注点分离 |
| ADR-3 | 启动优化 | 懒加载 + 延迟 DB 初始化 | 目标 < 200ms 冷启动 |
| ADR-4 | 输出策略 | 双模式（人类可读 + JSON） | Unix 哲学可组合性 |
| ADR-5 | 交互式提示 | @clack/prompts | 美观 UI、`cord init` 向导最佳体验 |
| ADR-6 | 颜色库 | picocolors | 轻量、CJS+ESM、性能 2x chalk |
| ADR-7 | 构建工具 | tsup | esbuild 加速、external 排除原生模块 |
