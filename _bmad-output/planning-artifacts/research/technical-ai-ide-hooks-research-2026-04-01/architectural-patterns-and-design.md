# Architectural Patterns and Design

> 本章节从架构设计角度分析 CORD 触发层应采用的设计模式、架构原则和关键决策。

## 1. 核心架构模式：端口-适配器模式（Hexagonal Architecture）

CORD 触发层的核心挑战在于：**同一套业务逻辑需要适配 4 种截然不同的 IDE 集成机制**。这完美契合 **端口-适配器（六边形架构）** 模式的适用场景。

```
                     ┌─────────────────────────────┐
                     │     CORD Core Domain         │
                     │  ┌───────────────────────┐   │
                     │  │  RelationEngine        │   │
                     │  │  DocumentParser (TR3)   │   │
   ┌──────────┐     │  │  SQLiteRepository (TR1) │   │     ┌──────────┐
   │ Inbound  │────►│  └───────────────────────┘   │◄────│ Outbound │
   │  Ports   │     │                               │     │  Ports   │
   └──────────┘     └─────────────────────────────┘     └──────────┘
        ▲                                                      ▲
        │                                                      │
   ┌────┴────────────────────────┐            ┌───────────────┴────────┐
   │      Inbound Adapters       │            │    Outbound Adapters    │
   │                              │            │                         │
   │  ┌─ MCP Server Adapter ──┐  │            │  ┌─ SQLite Adapter ──┐  │
   │  │  (所有 IDE 通用)       │  │            │  │  (better-sqlite3)  │  │
   │  └───────────────────────┘  │            │  └────────────────────┘  │
   │  ┌─ CLI Adapter ─────────┐  │            │  ┌─ FileSystem Adapter ┐ │
   │  │  (npx cord <cmd>)     │  │            │  │  (文件读写/监听)     │ │
   │  └───────────────────────┘  │            │  └────────────────────┘  │
   │  ┌─ Hook Event Adapter ──┐  │            │  ┌─ Notification ─────┐  │
   │  │  (Hook stdin JSON →    │  │            │  │  Adapter           │  │
   │  │   Command dispatch)    │  │            │  │  (stdout JSON)     │  │
   │  └───────────────────────┘  │            │  └────────────────────┘  │
   └──────────────────────────────┘            └─────────────────────────┘
```

**设计决策理由：**
- **核心域不依赖任何 IDE 特定 API** — RelationEngine 只通过端口接口交互
- **新 IDE 适配仅需添加 Adapter** — 不修改核心逻辑
- **测试友好** — 核心域可独立测试，无需启动 MCP Server 或 IDE

### 适配器职责清单

| Adapter | 职责 | 入口 |
|---------|------|------|
| **MCP Server Adapter** | 接收 MCP Tool 调用，转发到 Core | Stdio Transport |
| **CLI Adapter** | 解析命令行参数，调用 Core API | `npx cord <command>` |
| **Hook Event Adapter** | 解析 Hook stdin JSON，过滤 & 分发 | Shell 脚本 → CLI |

_置信度：🟢 高 — 端口-适配器模式是跨平台工具的经典架构选择_

---

## 2. 触发层设计模式：策略模式（Strategy Pattern）

CORD 的触发层需要根据 IDE 环境动态选择不同的触发策略。采用 **策略模式** 封装各 IDE 的触发行为差异：

```typescript
// 触发策略接口（Port）
interface TriggerStrategy {
  name: string;
  isAvailable(): boolean;          // 检测当前环境是否支持
  getAutomationLevel(): AutomationLevel;
  generateConfig(projectPath: string): ConfigFiles;
}

// 自动化级别枚举
enum AutomationLevel {
  FULL_AUTO = 'full_auto',       // Layer 3: 原生 Hooks
  AI_GUIDED = 'ai_guided',       // Layer 2: Rules + MCP
  MANUAL = 'manual',             // Layer 1: MCP only
  CLI_FALLBACK = 'cli_fallback'  // Layer 4: CLI 兜底
}

// 具体策略实现（Adapters）
class ClaudeCodeStrategy implements TriggerStrategy {
  name = 'claude-code';
  isAvailable() { return existsSync('.claude/'); }
  getAutomationLevel() { return AutomationLevel.FULL_AUTO; }
  generateConfig(projectPath) {
    return {
      hooks: generateClaudeHooksConfig(),
      rules: generateClaudeMdSnippet(),
      mcp: generateClaudeMcpConfig()
    };
  }
}

class WindsurfStrategy implements TriggerStrategy {
  name = 'windsurf';
  isAvailable() { return existsSync('.windsurf/'); }
  getAutomationLevel() { return AutomationLevel.FULL_AUTO; }
  generateConfig(projectPath) {
    return {
      hooks: generateWindsurfHooksConfig(),
      rules: generateWindsurfRulesConfig(),
      mcp: generateWindsurfMcpConfig()
    };
  }
}

class CursorStrategy implements TriggerStrategy {
  name = 'cursor';
  isAvailable() { return existsSync('.cursor/'); }
  getAutomationLevel() { return AutomationLevel.AI_GUIDED; }
  generateConfig(projectPath) {
    return {
      rules: generateCursorRulesConfig(),
      mcp: generateCursorMcpConfig()
    };
  }
}

class CopilotStrategy implements TriggerStrategy {
  name = 'copilot';
  isAvailable() { return existsSync('.github/'); }
  getAutomationLevel() { return AutomationLevel.AI_GUIDED; }
  generateConfig(projectPath) {
    return {
      instructions: generateCopilotInstructionsConfig(),
      mcp: generateCopilotMcpConfig()
    };
  }
}
```

**策略选择器：**
```typescript
class TriggerStrategyResolver {
  private strategies: TriggerStrategy[];

  resolve(projectPath: string): TriggerStrategy[] {
    return this.strategies
      .filter(s => s.isAvailable())
      .sort((a, b) =>
        automationOrder(a.getAutomationLevel()) -
        automationOrder(b.getAutomationLevel())
      );
  }
}
```

_置信度：🟢 高 — 策略模式是处理"同一操作多种实现"的标准方案_

---

## 3. Hook 事件处理模式：责任链模式（Chain of Responsibility）

当 Hook 被触发时，事件需经过多个处理步骤。采用 **责任链模式** 实现 Hook 脚本内部的事件处理流水线：

```
Hook stdin JSON 输入
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  FileFilter   │────►│  Debouncer   │────►│ RelationUpd  │────►│  Responder   │
│  (.md only)   │     │  (去重/节流)  │     │ (更新关系)    │     │ (JSON 输出)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
     │ 不匹配           │ 重复事件             │ 更新失败           │ 成功
     ▼                  ▼                     ▼                  ▼
   exit 0             exit 0             exit 0 + log        exit 0 + JSON
   (静默跳过)          (静默跳过)          (静默记录)           (上下文注入)
```

**关键设计决策：**

| 决策 | 选择 | 理由 |
|------|------|------|
| **失败策略** | 静默失败（exit 0） | Hook 失败不应阻断 AI 工作流 |
| **去重策略** | 文件级节流（同一文件 5s 内只处理一次） | 连续编辑时避免重复更新 |
| **异步策略** | 后台执行（`async: true`） | 不阻塞 Claude 的下一步操作 |
| **超时策略** | 更新 30s / 查询 5s | 平衡完整性和响应速度 |

---

## 4. 配置生成模式：模板方法模式（Template Method）

`npx cord init` 命令需要为不同 IDE 生成配置文件。采用 **模板方法模式** 统一生成流程，各 IDE 仅覆盖差异部分：

```typescript
abstract class IDEConfigGenerator {
  // 模板方法 — 定义统一流程
  generate(projectPath: string): void {
    this.detectEnvironment(projectPath);
    this.generateMcpConfig(projectPath);       // 所有 IDE 都需要
    this.generateRulesConfig(projectPath);      // 各 IDE 格式不同
    if (this.supportsHooks()) {
      this.generateHooksConfig(projectPath);    // 仅 Claude Code + Windsurf
      this.generateHookScripts(projectPath);
    }
    this.generateAgentsMdSnippet(projectPath);  // 通用兜底
  }

  // 抽象方法 — 各 IDE 实现差异
  abstract generateMcpConfig(path: string): void;
  abstract generateRulesConfig(path: string): void;
  abstract supportsHooks(): boolean;
  // 可选覆盖
  generateHooksConfig(path: string): void {}
  generateHookScripts(path: string): void {}
}
```

---

## 5. 跨 IDE 兼容性架构决策

### 5.1 核心架构决策记录（ADR）

**ADR-TR4-001: Hook 脚本语言选择**

| 选项 | 优势 | 劣势 | 结论 |
|------|------|------|------|
| **Bash** | 零依赖，Claude Code + Windsurf 原生支持 | Windows 兼容性差，复杂逻辑难写 | ✅ 推荐（主方案） |
| **Node.js** | 跨平台，可复用 CORD 核心代码 | 需安装 Node.js，启动较慢 | 🟡 备选（复杂场景） |
| **Python** | Windsurf 文档示例用 Python | 额外依赖 | ❌ 不推荐 |

**决策：** 优先使用 Bash 脚本（简单逻辑），复杂场景通过 `node -e` 或 `npx cord` 委托给 Node.js。

**ADR-TR4-002: Hook 触发粒度**

| 选项 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| **文件级触发** | 每个被修改的文件独立触发 | 精确，资源占用小 | 连续编辑同一文件时重复触发 |
| **批量触发** | 收集一段时间内的变更后批量处理 | 效率高 | 实现复杂，需要状态管理 |
| **会话级触发** | 仅在 Stop/SessionEnd 时统一处理 | 最少资源消耗 | 实时性差，用户无法即时看到更新 |

**决策：** 文件级触发 + 去重节流（debounce 5s），兼顾实时性和效率。

**ADR-TR4-003: MCP Tool vs Hook 职责边界**

| 职责 | 由 Hook 承担 | 由 MCP Tool 承担 |
|------|-------------|-----------------|
| 文件修改后自动更新关系 | ✅ | ❌ |
| 读取前注入关联上下文 | ✅ (Claude Code) | ❌ |
| 查询文档关系 | ❌ | ✅ |
| 手动添加/删除关系 | ❌ | ✅ |
| 全项目扫描 | ❌ | ✅ |
| 可视化关系图谱 | ❌ | ✅ |

**原则：** Hook 负责"被动响应事件"（自动化），MCP Tool 负责"主动查询和操作"（交互式）。

### 5.2 安全架构考量

| 安全维度 | Claude Code | Windsurf | Cursor/Copilot |
|----------|------------|----------|----------------|
| **Hook 执行权限** | 用户权限级别 | 用户权限级别 | N/A |
| **输入验证** | Hook 脚本需自行验证 stdin JSON | Hook 脚本需自行验证 stdin JSON | N/A |
| **沙盒隔离** | ❌ 无（Shell 直接执行） | ❌ 无（Shell 直接执行） | N/A |
| **Secret 保护** | Hook 不应记录敏感内容 | Transcript 可能包含敏感数据 | N/A |
| **策略管控** | 组织策略可禁用本地 Hook | 系统级 Hook 不可绕过 | N/A |

**CORD 安全原则：**
- Hook 脚本仅调用 CORD CLI，不执行任何其他操作
- Hook 脚本不记录文件内容到日志
- Hook 脚本通过 exit 0 静默失败，不泄露错误信息
- MCP Server 仅读写 `.cord/cord.db`，不访问其他数据

---

## 6. 可扩展性架构

当未来出现新 AI IDE 时，CORD 的扩展路径：

```
新 IDE 出现（如 Trae、Void、Zed AI）
       │
       ▼
  该 IDE 支持原生 Hooks?
  ├── ✅ → 实现 TriggerStrategy + HooksConfig + HookScripts
  │        (参考 ClaudeCodeStrategy / WindsurfStrategy)
  │
  └── ❌ → 该 IDE 支持 MCP?
       ├── ✅ → 实现 TriggerStrategy + McpConfig + RulesConfig
       │        (参考 CursorStrategy / CopilotStrategy)
       │
       └── ❌ → 该 IDE 支持 AGENTS.md 或类似指令文件?
            ├── ✅ → 仅生成指令文件 + CLI 兜底
            └── ❌ → CLI 兜底方案
```

**扩展成本评估：**

| 新 IDE 类型 | 需要新增的代码量 | 估计工作量 |
|-------------|-----------------|------------|
| 支持 Hooks + MCP | 1 Strategy + 3 Config Templates + 2 Hook Scripts | ~2-3 天 |
| 仅支持 MCP | 1 Strategy + 2 Config Templates | ~1 天 |
| 仅支持指令文件 | 1 Strategy + 1 Template | ~半天 |
| 无自动化能力 | 仅 CLI 文档 | ~2 小时 |

_Source: 基于 Gang of Four 设计模式与六边形架构原则，结合 CORD 项目实际需求_
