# Integration Patterns Analysis

## CLI ↔ MCP Server 集成模式

CORD 项目的核心集成挑战在于：**CLI 工具和 MCP Server 共存于同一个 npm 包中**，共享底层的 SQLite 数据层和业务逻辑层。

### 共享架构模式：Dual Entry Point（双入口）

```
cord (npm package)
├── bin/cord.js          ← CLI 入口（npx cord ...）
├── src/cli/             ← CLI 命令层（Commander）
├── src/mcp/             ← MCP Server 入口（Stdio Transport）
├── src/services/        ← 共享业务逻辑层
├── src/repository/      ← 共享数据访问层（better-sqlite3）
└── package.json
    ├── "bin": { "cord": "./bin/cord.js" }        ← CLI
    └── "scripts": { "mcp": "node dist/mcp/..." } ← MCP Server
```

**关键设计原则：**

| 原则 | 说明 |
|------|------|
| **共享 Service 层** | CLI 命令和 MCP Tool 调用同一套 `services/` 层，避免逻辑重复 |
| **独立入口** | CLI（`bin/cord.js`）和 MCP Server（`src/mcp/index.ts`）各自独立启动 |
| **数据库复用** | 两者共享同一个 SQLite 数据库文件（`.cord/cord.db`） |
| **互不依赖** | CLI 运行不需要 MCP Server；MCP Server 不需要 CLI |

_Source: TR2 架构建议（`technical-mcp-server-typescript-sdk-research-2026-03-31.md`）_

### CLI 命令 ↔ MCP Tool 命名映射

TR2 确定 MCP Tool 使用 `.` 分隔的命名规范（`relation.add`、`document.scan`）。CLI 子命令需要与之保持语义一致性：

| MCP Tool 名称 | CLI 命令 | 说明 |
|---------------|----------|------|
| `relation.add` | `cord relation add` | 添加文档关系 |
| `relation.remove` | `cord relation remove` | 删除文档关系 |
| `relation.search` | `cord relation search` | 搜索关系 |
| `relation.list` | `cord relation list` | 列出关系 |
| `document.scan` | `cord scan` | 扫描单个文档 |
| `document.scan_all` | `cord scan --all` | 全量扫描 |
| `graph.get` | `cord graph show` | 查看关系图 |
| `graph.export` | `cord graph export` | 导出关系图 |
| `config.get` / `config.set` | `cord config [get\|set]` | 配置管理 |
| — | `cord init` | 初始化项目（CLI 独有） |
| — | `cord status` | 项目状态总览（CLI 独有） |

**映射规则：**
- MCP Tool 的 `.` 分组 → CLI 的子命令分组（`cord <group> <action>`）
- 高频操作提升为顶级命令（`cord scan` 而非 `cord document scan`）
- CLI 独有命令（`init`、`status`）无需在 MCP 侧暴露

_Source: TR2 CORD 命名规范建议_

---

## CLI ↔ 配置系统集成模式

### 配置文件发现策略

CORD 需要一个分层配置系统：

```
优先级（从高到低）：
1. CLI 命令行参数        --db-path ./custom.db
2. 环境变量              CORD_DB_PATH=./custom.db
3. 项目级配置文件        .cord/config.yaml (或 .cordrc)
4. 全局配置              ~/.config/cord/config.yaml
5. 内置默认值            .cord/cord.db
```

**cosmiconfig（v9.0.1）** 是 Node.js 生态中配置文件发现的事实标准：
- 自动搜索 `package.json` 属性、`.cordrc`、`.cordrc.json`、`.cordrc.yaml`、`cord.config.js` 等
- 向上遍历目录树直到找到配置
- TypeScript 配置文件支持（v9+）
- ESLint、Prettier、Stylelint、Babel 等均使用 cosmiconfig

**CORD 推荐方案：** 直接使用 `.cord/config.yaml` 作为项目级配置目录，无需 cosmiconfig。原因：
1. CORD 已有 `.cord/` 目录约定（存放数据库和缓存）
2. 配置路径固定，无需复杂的文件发现
3. 减少一个运行时依赖

_Source: [npm registry - cosmiconfig](https://registry.npmjs.org/cosmiconfig/latest)_

---

## CLI ↔ SQLite 数据库集成模式

### better-sqlite3 原生模块与 npx 兼容性

| 集成维度 | 方案 |
|---------|------|
| **安装时编译** | better-sqlite3 使用 `prebuild-install` 预编译二进制，首次 `npm install` 时自动下载对应平台的 `.node` 文件 |
| **npx 首次执行** | `npx cord init` 首次运行时触发 `npm install`，prebuild 下载约 2-5 秒 |
| **全局安装** | `npm i -g cord` 后 prebuild 仅下载一次，后续执行无额外开销 |
| **CI 环境** | prebuild 覆盖主流平台（Linux x64/arm64、macOS x64/arm64、Windows x64），无需本地编译 |
| **构建配置** | tsup 需配置 `external: ['better-sqlite3']` 排除原生模块，避免 esbuild 尝试打包 `.node` 文件 |

**tsup 配置示例：**

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/cli/index.ts', 'src/mcp/index.ts'],
  format: ['esm'],
  target: 'node18',
  external: ['better-sqlite3'],
  clean: true,
  splitting: true,  // 共享代码自动拆分
});
```

---

## CLI ↔ AI IDE 集成模式

### 三层集成架构（来自 TR4）

TR4 确定了 CORD 与 AI IDE 的三层分级集成架构：

| 层级 | 方式 | 覆盖 IDE | CLI 角色 |
|------|------|---------|---------|
| **L1** | MCP Server | 所有支持 MCP 的 IDE | CLI 负责 MCP Server 的安装配置（`cord init`） |
| **L2** | 指令引导（CLAUDE.md 等） | 所有 IDE | CLI 生成/更新 IDE 指令文件（`cord init --ide claude`） |
| **L3** | 原生 Hooks | Claude Code | CLI 本身即为原生命令行接口 |

**`cord init` 命令的 IDE 配置生成流程：**

```
cord init
  ├── 检测项目环境（git root、已有 .cord/）
  ├── 交互式配置（@clack/prompts）
  │   ├── 选择目标 IDE（Claude Code / Cursor / VS Code / 多选）
  │   └── 确认配置选项
  ├── 生成 .cord/ 目录结构
  ├── 初始化 SQLite 数据库
  └── 生成 IDE 配置文件
      ├── Claude Code → .mcp.json + CLAUDE.md 片段
      ├── Cursor → .cursor/mcp.json + .cursorrules 片段
      └── VS Code → .vscode/mcp.json
```

_Source: TR4 AI IDE Hooks 研究（`technical-ai-ide-hooks-research-2026-04-01.md`）_

---

## CLI 输出协议：人类可读 + 机器可读双模式

现代 CLI 工具普遍采用「默认人类可读、`--json` 机器可读」的双输出模式：

```bash
# 人类可读模式（默认）
$ cord relation list
┌──────────────┬────────────┬────────────┐
│ Source       │ Relation   │ Target     │
├──────────────┼────────────┼────────────┤
│ README.md    │ references │ INSTALL.md │
│ guide.md     │ extends    │ api.md     │
└──────────────┴────────────┴────────────┘

# 机器可读模式
$ cord relation list --json
[
  {"source": "README.md", "relation": "references", "target": "INSTALL.md"},
  {"source": "guide.md", "relation": "extends", "target": "api.md"}
]
```

**实现策略：**

| 模式 | 输出工具 | 使用场景 |
|------|---------|---------|
| **人类可读** | picocolors（颜色）+ cli-table3（表格）+ ora（spinner） | 终端交互 |
| **JSON** | `JSON.stringify()` + stdout | 管道、脚本、CI/CD |
| **Quiet** | 仅输出关键信息或退出码 | 自动化脚本 |

**全局选项设计：**

```
--json          以 JSON 格式输出
--quiet, -q     静默模式
--verbose, -v   详细输出
--no-color      禁用颜色
```

---

## CLI 错误处理与退出码集成

| 退出码 | 含义 | 场景 |
|--------|------|------|
| `0` | 成功 | 正常完成 |
| `1` | 一般错误 | 业务逻辑错误、文件不存在 |
| `2` | 参数错误 | 无效选项、缺少必需参数 |
| `3` | 配置错误 | `.cord/` 未初始化、配置文件损坏 |
| `126` | 权限错误 | 数据库文件权限不足 |

**Commander.js 集成：** Commander 自动处理 `--help`（退出码 0）和未知选项（退出码 1），并支持 `.exitOverride()` 自定义退出行为——便于测试和嵌入场景。

---

## 集成安全模式

| 维度 | 方案 |
|------|------|
| **数据库安全** | SQLite 文件权限 600（仅用户可读写），无网络暴露 |
| **配置安全** | 不在配置文件中存储敏感信息；API Key 等通过环境变量传递 |
| **依赖安全** | 最小化运行时依赖，减少供应链攻击面 |
| **输入校验** | CLI 参数 + MCP Tool 输入双重校验（Commander 选项校验 + Zod schema） |
