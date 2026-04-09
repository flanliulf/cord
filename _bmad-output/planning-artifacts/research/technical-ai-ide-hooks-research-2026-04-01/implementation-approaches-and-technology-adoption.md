# Implementation Approaches and Technology Adoption

> 本章节聚焦于 CORD 触发层的实际落地方案，包括开发路线图、技术实现细节、测试策略、部署方案和风险评估。

## 1. 实现路线图

基于前序研究结论，CORD 触发层的实现应分 4 个阶段递进：

```
Phase 1: MCP 基础层（Week 1-2）
├── 实现 CORD MCP Server（TR2 方案）
├── 定义 6 个核心 MCP Tools
├── 跨 IDE MCP 配置模板
└── MCP Server 单元/集成测试

Phase 2: 指令引导层（Week 3）
├── 各 IDE Rules/Instructions 模板
├── AGENTS.md 通用模板
├── `npx cord init` 命令（检测 + 配置生成）
└── 端到端手动验证（4 个 IDE）

Phase 3: 原生 Hooks 层（Week 4-5）
├── Claude Code Hook 脚本实现
│   ├── PostToolUse (Edit|Write) → 关系更新
│   ├── PreToolUse (Read) → 上下文注入
│   └── SessionStart → 图谱加载
├── Windsurf Hook 脚本实现
│   ├── post_write_code → 关系更新
│   └── post_read_code → 日志记录
├── Hook 去重/节流机制
└── Hook 脚本自动化测试

Phase 4: 优化与打磨（Week 6）
├── 性能基准测试
├── 跨平台兼容性验证（macOS / Linux / Windows WSL）
├── `npx cord init` 交互式体验优化
└── 文档与使用指南
```

---

## 2. 核心实现细节

### 2.1 Hook 脚本实现方案

**文件结构（随 npm 包分发）：**
```
cord/
├── src/
│   ├── mcp-server/          # MCP Server 实现
│   ├── cli/                 # CLI 命令实现
│   ├── core/                # 核心域逻辑
│   └── adapters/            # IDE 适配器
├── hooks/                   # Hook 脚本模板
│   ├── claude-code/
│   │   ├── post-edit.sh     # PostToolUse Hook
│   │   ├── pre-read.sh      # PreToolUse Hook
│   │   └── session-start.sh # SessionStart Hook
│   ├── windsurf/
│   │   ├── post-write.sh    # post_write_code Hook
│   │   └── post-read.sh     # post_read_code Hook
│   └── common/
│       └── cord-hook-lib.sh # 共享工具函数
├── templates/               # 配置模板
│   ├── claude-code/
│   │   ├── settings.json.tmpl
│   │   └── claude-md.snippet.tmpl
│   ├── cursor/
│   │   ├── mcp.json.tmpl
│   │   └── cord-relations.mdc.tmpl
│   ├── windsurf/
│   │   ├── hooks.json.tmpl
│   │   └── cord-relations.md.tmpl
│   ├── copilot/
│   │   ├── mcp.json.tmpl
│   │   └── cord-relations.instructions.md.tmpl
│   └── agents-md.snippet.tmpl
└── package.json
```

### 2.2 Hook 共享库实现

```bash
#!/bin/bash
# hooks/common/cord-hook-lib.sh — 跨 IDE Hook 共享工具函数

# 去重/节流：检查文件是否在最近 N 秒内已处理
cord_should_process() {
  local file_path="$1"
  local debounce_seconds="${2:-5}"
  local lock_dir="/tmp/cord-hooks"
  local lock_file="$lock_dir/$(echo "$file_path" | md5sum | cut -d' ' -f1)"

  mkdir -p "$lock_dir"

  if [ -f "$lock_file" ]; then
    local last_time=$(cat "$lock_file")
    local now=$(date +%s)
    if (( now - last_time < debounce_seconds )); then
      return 1  # 跳过：仍在节流窗口内
    fi
  fi

  date +%s > "$lock_file"
  return 0  # 允许处理
}

# 安全地从 stdin 读取 JSON
cord_read_input() {
  cat
}

# 提取文件路径（兼容 Claude Code 和 Windsurf 格式）
cord_extract_file_path() {
  local input="$1"
  # Claude Code: .tool_input.file_path
  local path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  if [ -z "$path" ]; then
    # Windsurf: .tool_info.file_path
    path=$(echo "$input" | jq -r '.tool_info.file_path // empty' 2>/dev/null)
  fi
  echo "$path"
}

# 检查是否为 Markdown 文件
cord_is_markdown() {
  local file_path="$1"
  [[ "$file_path" == *.md ]] || [[ "$file_path" == *.mdx ]]
}

# 静默调用 CORD CLI（异步，不阻塞）
cord_update_async() {
  local file_path="$1"
  local cord_bin="${CORD_BIN:-npx cord}"
  nohup $cord_bin update-relations "$file_path" > /dev/null 2>&1 &
}

# 获取文档上下文（同步，用于 additionalContext）
cord_get_context() {
  local file_path="$1"
  local format="${2:-brief}"
  local cord_bin="${CORD_BIN:-npx cord}"
  $cord_bin get-context "$file_path" --format="$format" 2>/dev/null || echo ""
}
```

### 2.3 `npx cord init` 命令实现

```typescript
// src/cli/commands/init.ts — 核心逻辑伪代码

import { TriggerStrategyResolver } from '../adapters/trigger-strategy-resolver';

export async function initCommand(options: InitOptions) {
  const projectPath = options.projectPath || process.cwd();

  // 1. 检测 IDE 环境
  const resolver = new TriggerStrategyResolver();
  const detectedStrategies = resolver.resolve(projectPath);

  console.log('🔍 检测到的 AI IDE 配置：');
  for (const strategy of detectedStrategies) {
    console.log(`  ✅ ${strategy.name} (${strategy.getAutomationLevel()})`);
  }

  // 2. 初始化 CORD 数据库
  await initDatabase(path.join(projectPath, '.cord', 'cord.db'));

  // 3. 为每个检测到的 IDE 生成配置
  for (const strategy of detectedStrategies) {
    const configs = strategy.generateConfig(projectPath);
    await writeConfigFiles(configs, projectPath);
    console.log(`  ✅ ${strategy.name} 配置已生成`);
  }

  // 4. 生成通用 AGENTS.md 片段
  await generateAgentsMdSnippet(projectPath);

  // 5. 复制 Hook 脚本并设置执行权限
  if (detectedStrategies.some(s => s.supportsHooks())) {
    await copyHookScripts(projectPath, detectedStrategies);
    console.log('  ✅ Hook 脚本已部署');
  }

  console.log('\n🚀 CORD 已就绪！');
}
```

---

## 3. 测试策略

### 3.1 测试金字塔

```
          ╱╲
         ╱  ╲          E2E 测试
        ╱ E2E╲         各 IDE 中的真实 Hook 触发（手动验证）
       ╱──────╲
      ╱        ╲       集成测试
     ╱ 集成测试  ╲      MCP Server + Hook 脚本 + CORD Core 协同
    ╱────────────╲
   ╱              ╲    单元测试
  ╱   单元测试     ╲    策略模式、配置生成、文件过滤、去重逻辑
 ╱──────────────────╲
```

### 3.2 各层测试方案

| 测试层 | 测试对象 | 工具 | 覆盖目标 |
|--------|----------|------|----------|
| **单元测试** | Strategy 类、ConfigGenerator、FileFilter、Debouncer | Vitest | 核心逻辑 100% |
| **Hook 脚本测试** | Bash 脚本输入/输出行为 | bats-core (Bash testing) | 各事件类型的正确处理 |
| **MCP 集成测试** | MCP Server Tool 调用 → CORD Core → SQLite | Vitest + @modelcontextprotocol/sdk test utils | 工具调用端到端 |
| **配置生成测试** | `cord init` 输出的各 IDE 配置文件 | Vitest + snapshot testing | 配置模板正确性 |
| **E2E 验证** | 在真实 IDE 中触发 Hook → 验证关系更新 | 手动测试 checklist | 4 个 IDE 各一轮 |

### 3.3 Hook 脚本测试示例（bats-core）

```bash
#!/usr/bin/env bats
# tests/hooks/test-post-edit.bats

setup() {
  export CORD_BIN="echo"  # Mock CORD CLI
  source hooks/common/cord-hook-lib.sh
}

@test "should process markdown files" {
  local input='{"tool_input":{"file_path":"/project/docs/readme.md"}}'
  local file_path=$(cord_extract_file_path "$input")
  cord_is_markdown "$file_path"
  [ $? -eq 0 ]
}

@test "should skip non-markdown files" {
  local input='{"tool_input":{"file_path":"/project/src/app.ts"}}'
  local file_path=$(cord_extract_file_path "$input")
  cord_is_markdown "$file_path"
  [ $? -ne 0 ]
}

@test "should debounce repeated calls for same file" {
  local file="/project/docs/readme.md"
  cord_should_process "$file" 5
  [ $? -eq 0 ]  # 第一次：允许

  cord_should_process "$file" 5
  [ $? -ne 0 ]  # 第二次（5s 内）：跳过
}

@test "should extract file path from Windsurf format" {
  local input='{"tool_info":{"file_path":"/project/docs/api.md"}}'
  local result=$(cord_extract_file_path "$input")
  [ "$result" = "/project/docs/api.md" ]
}
```

---

## 4. 部署与分发方案

### 4.1 npm 包结构

```json
{
  "name": "cord",
  "bin": {
    "cord": "./dist/cli/index.js",
    "cord-mcp-server": "./dist/mcp-server/index.js"
  },
  "files": [
    "dist/",
    "hooks/",
    "templates/"
  ],
  "scripts": {
    "build": "tsup src/cli/index.ts src/mcp-server/index.ts --format esm",
    "test": "vitest run",
    "test:hooks": "bats tests/hooks/"
  }
}
```

**关键分发决策：**

| 决策 | 选择 | 理由 |
|------|------|------|
| **Hook 脚本分发** | 随 npm 包分发模板，`cord init` 复制到项目 | 用户可自定义，不依赖 node_modules 路径 |
| **MCP Server 启动** | `npx cord-mcp-server` | 各 IDE 的 MCP 配置标准方式 |
| **CLI 入口** | `npx cord <command>` | 无需全局安装 |
| **配置模板** | Handlebars 模板 → 静态文件 | 简单可靠，易于维护 |

### 4.2 跨平台兼容性

| 平台 | Bash Hook | Node.js Hook | 验证方案 |
|------|-----------|-------------|----------|
| **macOS** | ✅ 原生 | ✅ | CI matrix |
| **Linux** | ✅ 原生 | ✅ | CI matrix |
| **Windows WSL** | ✅ WSL Bash | ✅ | 手动验证 |
| **Windows 原生** | ❌ 需 Git Bash | ✅ | Claude Code 使用 `shell: "bash"` |

**Windows 兼容策略：**
- Claude Code Hook 配置中设置 `"shell": "bash"`（默认行为）
- Windsurf 在 Windows 上可能需要调整脚本路径
- 如果检测到 Windows 环境，`cord init` 生成 Node.js 版本的 Hook 脚本作为替代

---

## 5. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解策略 |
|---|------|------|------|----------|
| **R1** | Hook 脚本执行延迟影响 AI 响应速度 | 🟡 中 | 🟡 中 | 使用 `async: true`（Claude Code）；保持脚本执行 < 100ms；重操作异步化 |
| **R2** | `jq` 未安装导致 Hook 脚本失败 | 🟡 中 | 🟢 低 | `cord init` 检测 `jq` 可用性并提示安装；提供 Node.js 备选脚本 |
| **R3** | 并发编辑导致 SQLite 写冲突 | 🟢 低 | 🟡 中 | WAL 模式 + better-sqlite3 重试机制（TR1 已确定） |
| **R4** | Cursor/Copilot 的 AI 未遵循 Rules/Instructions 指引 | 🟠 高 | 🟡 中 | 接受降级现实；Rules 仅是"建议"非"强制"；MCP Tool 始终可手动调用 |
| **R5** | IDE 更新导致 Hooks API 变更 | 🟡 中 | 🟡 中 | 关注 IDE changelog；Hook 脚本保持最小化依赖；版本矩阵测试 |
| **R6** | Windows 原生环境 Bash 不可用 | 🟡 中 | 🟢 低 | 提供 Node.js 版本 Hook 脚本；Claude Code Windows 默认使用 bash shell |
| **R7** | `npx cord` 启动延迟影响 Hook 性能 | 🟠 高 | 🟡 中 | 全局安装 `npm i -g cord`；或使用绝对路径 `$CORD_BIN` 避免 npx 解析 |

**R7 深入分析 — `npx` 冷启动延迟问题：**

`npx cord update-relations` 每次调用会经历包解析和 Node.js 启动过程，典型延迟 300-800ms。对于 Hook 场景，这可能成为性能瓶颈。

**缓解方案优先级：**

| 方案 | 延迟 | 实现成本 | 推荐 |
|------|------|---------|------|
| **A: 全局安装** `npm i -g cord` 后使用 `cord` 直接命令 | ~50ms | 零（用户操作） | 🟢 推荐高频用户 |
| **B: 绝对路径** `cord init` 检测并写入 `CORD_BIN` 环境变量 | ~50ms | 低 | 🟢 推荐默认 |
| **C: 常驻进程** CORD 作为后台服务，Hook 仅发信号 | ~5ms | 高 | 🟡 V2 考虑 |
| **D: 直接 SQLite 操作** Hook 脚本直接读写数据库 | ~10ms | 高（绕过核心域） | ❌ 不推荐 |

---

## 6. 成功指标与 KPI

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| **Hook 触发成功率** | ≥ 99% | Hook 日志分析 |
| **Hook 执行延迟（P95）** | < 200ms | 脚本内计时 |
| **MCP Tool 响应时间（P95）** | < 500ms | MCP Server 日志 |
| **`cord init` 配置生成正确率** | 100% | 自动化测试覆盖 |
| **跨 IDE MCP 兼容率** | 4/4 IDE | E2E 验证矩阵 |
| **Rules/Instructions AI 遵循率** | ≥ 70%（Cursor/Copilot） | 手动观察统计 |
| **用户安装到首次使用时间** | < 3 分钟 | 用户反馈 |
