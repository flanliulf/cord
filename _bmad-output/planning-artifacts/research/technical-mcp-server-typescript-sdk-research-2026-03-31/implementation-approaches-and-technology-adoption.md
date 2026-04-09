# Implementation Approaches and Technology Adoption

## 技术采纳策略

### SDK 版本选择路径

| 时间点 | 策略 | 理由 |
|--------|------|------|
| **MVP 阶段（现在）** | 使用 **v1.x**（`@modelcontextprotocol/sdk`） | 稳定生产版本，完整文档，社区验证 |
| **v2 稳定后（预计 2026 Q2-Q3）** | 评估迁移到 v2 | v2 拆分包结构更清晰，Standard Schema 更灵活 |
| **v1 EOL 前** | 完成迁移 | v1 在 v2 发布后至少维护 6 个月 |

**迁移风险评估：**

| 维度 | 风险等级 | 说明 |
|------|---------|------|
| API 兼容性 | 🟡 中 | v2 API 整体相似，但包导入路径变化 |
| Schema 迁移 | 🟢 低 | Zod v3 → v4 平滑升级；v2 也支持其他 Schema 库 |
| Transport 变化 | 🟢 低 | Stdio 无变化；SSE 被移除但 CORD 不使用 |
| 依赖变化 | 🟡 中 | 单包 → 多包，需调整构建配置 |

### better-sqlite3 跨平台策略

**当前状态（v12.8.0, 2026-03-13）：**
- 178,000+ 项目使用
- 提供 Node.js LTS 版本的**预编译二进制文件**（prebuild）
- C++ 原生绑定（67.9% JS / 31.8% C++）

**跨平台支持矩阵：**

| 平台 | 预编译可用 | 备注 |
|------|-----------|------|
| macOS (Intel) | ✅ | 主流开发环境 |
| macOS (Apple Silicon) | ✅ | M1/M2/M3 原生支持 |
| Linux (x64) | ✅ | CI/CD 和服务器环境 |
| Linux (ARM64) | ✅ | 树莓派等嵌入式场景 |
| Windows (x64) | ✅ | 需确保 VS Build Tools 或预编译匹配 |

**npm 分发的关键挑战：**

当 CORD 作为 npm 包分发（`npx cord-mcp`）时，`better-sqlite3` 的原生 C++ 绑定需要：
1. 用户机器上有匹配的预编译二进制，或
2. 本地编译（需要 Python + C++ 编译工具链）

**缓解策略：**
- `better-sqlite3` 对主流 LTS Node.js 提供 prebuild → 大多数用户免编译
- `package.json` 中声明 `engines.node` 限定支持版本
- README 提供各平台安装故障排查指南
- 后续 TR9（npm 分发研究）将深入此话题

_Source: [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)_

## 开发工作流与工具链

### 本地开发工作流

```
1. 编写/修改 TypeScript 代码
      ↓
2. 编译: tsc (或 tsx 直接运行)
      ↓
3. 本地测试: MCP Inspector
      ↓
4. IDE 集成测试: Claude Code / Cursor
      ↓
5. 单元/集成测试: Vitest
      ↓
6. 提交代码
```

**MCP Inspector — 开发首选调试工具：**

```bash
# 测试本地开发中的 CORD server
npx @modelcontextprotocol/inspector node ./build/index.js

# 测试已发布的 npm 包
npx @modelcontextprotocol/inspector npx cord-mcp
```

Inspector 提供：
- ✅ 可视化 Tool/Resource/Prompt 列表
- ✅ 交互式 Tool 执行测试（自定义输入）
- ✅ 查看 Resource 内容
- ✅ 测试 Prompt 模板（自定义参数）
- ✅ 查看日志和通知流
- ✅ Transport 选择（Stdio / HTTP）

**开发迭代推荐模式：**

| 阶段 | 工具 | 说明 |
|------|------|------|
| 核心开发 | MCP Inspector | 快速验证 Tool 行为，无需完整 IDE |
| 集成测试 | Claude Code | 验证真实 AI IDE 场景 |
| 回归测试 | Vitest | 自动化测试套件 |
| 发布前验证 | `npx cord-mcp` | 模拟用户安装体验 |

_Source: [MCP Inspector Documentation](https://modelcontextprotocol.io/docs/tools/inspector)_

### 项目初始化模板

```bash
# 1. 初始化项目
mkdir cord-mcp && cd cord-mcp
npm init -y

# 2. 安装核心依赖
npm install @modelcontextprotocol/sdk zod@3 better-sqlite3
npm install -D @types/node @types/better-sqlite3 typescript vitest

# 3. 配置 TypeScript (tsconfig.json)
# → 如架构模式章节所述

# 4. 配置 package.json
# → type: "module", bin, scripts

# 5. 创建项目结构
mkdir -p src/{tools,resources,prompts,repository,services,utils}
```

**依赖清单：**

| 包名 | 用途 | 类型 |
|------|------|------|
| `@modelcontextprotocol/sdk` | MCP Server/Client SDK | production |
| `zod@3` | Schema 定义与验证 | production |
| `better-sqlite3` | SQLite 数据库驱动 | production |
| `typescript` | TypeScript 编译器 | devDependency |
| `@types/node` | Node.js 类型定义 | devDependency |
| `@types/better-sqlite3` | better-sqlite3 类型定义 | devDependency |
| `vitest` | 测试框架 | devDependency |

## 调试与故障排查

### 常见问题清单

| 问题 | 症状 | 解决方案 |
|------|------|---------|
| **stdout 污染** | Server 连接后立即断开 | 移除所有 `console.log()`，改用 `console.error()` |
| **工作目录不确定** | 相对路径文件找不到 | 使用绝对路径；环境变量传递路径 |
| **环境变量丢失** | Server 无法读取配置 | 通过 IDE 配置的 `env` 字段显式传递 |
| **协议版本不匹配** | 初始化失败 | 确认 SDK 版本与 Client 支持的协议版本兼容 |
| **能力协商失败** | 运行时调用报错 | 检查 `initialize` 交换中双方声明的 capabilities |
| **Zod 版本冲突** | TS2589 类型错误 | `npm ls zod` 检查，使用 resolutions 统一版本 |
| **SQLite 锁定** | 数据库操作超时 | 确认 WAL 模式启用；检查是否有其他进程锁定 |
| **prebuild 缺失** | better-sqlite3 安装编译失败 | 使用 LTS Node.js 版本；安装 C++ 编译工具链 |

### 日志策略

```typescript
// 结构化日志 → stderr (不干扰 Stdio JSON-RPC)
function logToStderr(level: string, message: string, context?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  };
  console.error(JSON.stringify(entry));
}

// MCP 协议内日志 → 通过 notifications/message 发送给 Client
// 需声明 logging 能力
await server.sendLoggingMessage({
  level: "info",
  data: "扫描完成: 发现 42 个文档关系",
});
```

**日志输出双通道：**

| 通道 | 方式 | 查看者 |
|------|------|--------|
| **stderr** | `console.error()` / 日志库 | 开发者（终端/日志文件） |
| **MCP 协议** | `sendLoggingMessage()` | AI IDE / LLM |

_Source: [MCP Debugging Guide](https://modelcontextprotocol.io/docs/tools/debugging)_

## 风险评估与缓解

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| **v2 SDK 破坏性变更** | 🟡 中 | 需要迁移代码 | 使用 v1.x 稳定版；关注 v2 changelog；保持松耦合 |
| **better-sqlite3 跨平台编译失败** | 🟡 中 | 部分用户安装困难 | 限定 LTS Node.js；提供详细排查文档；TR9 深入研究 |
| **MCP 规范演进** | 🟢 低 | 新功能需要适配 | SDK 封装了规范差异；关注 `listChanged` 通知 |
| **IDE 兼容性碎片化** | 🟡 中 | 需维护多套配置文档 | 优先 Stdio + Tools（全 IDE 通用）；提供 `cord init` 命令 |
| **单进程 SQLite 性能** | 🟢 低 | 大规模项目可能慢 | WAL 模式；索引优化；Repository Pattern 可替换数据层 |
