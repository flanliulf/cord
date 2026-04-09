# Implementation Approaches and Technology Adoption

> 本章节聚焦于 CORD 指令文件适配层的具体实现路径，包括开发路线图、核心代码实现、测试策略、部署方案和风险评估。

## 1. 实现路线图

CORD 指令文件适配层的实现应整合到 TR4 已规划的 Phase 2（`cord init` + 指令模板）中，细化为以下子阶段：

```
Phase 2A: 核心基础设施（3-4 天）
├── CordInstructionModel 数据模型定义
├── gray-matter 集成与 Frontmatter 解析/生成
├── InstructionFormatterFactory 抽象工厂
├── 基础 Formatter 接口与测试骨架
└── 版本标记解析/嵌入工具

Phase 2B: 各 IDE Formatter 实现（4-5 天）
├── ClaudeCodeFormatter（paths frontmatter + .md）
├── CursorFormatter（description/alwaysApply/globs frontmatter + .mdc）
├── CopilotFormatter（applyTo/excludeAgent frontmatter + .instructions.md）
├── WindsurfFormatter（trigger/globs frontmatter + .md）
├── AgentsMdFormatter（标记区块合并）
└── 各 Formatter 单元测试 + 快照测试

Phase 2C: cord init 指令层集成（3-4 天）
├── IDE 检测器（目录探测 + 二级检测）
├── 交互式配置流程（@clack/prompts — TR5 已选定）
├── MCP 配置注入（JSON 合并）
├── 升级/卸载流程
└── 端到端集成测试

Phase 2D: 指令模板与 i18n（2-3 天）
├── CORD 指令内容模板（默认英文）
├── 中文模板
├── 模板版本管理
└── 文档与使用指南
```

**总工时：12-16 天**（含测试），可与 TR4 Phase 2 的 MCP 配置部分并行。

---

## 2. 核心代码实现

### 2.1 项目文件结构

```
cord/
├── src/
│   ├── cli/
│   │   └── commands/
│   │       └── init.ts                    # cord init 命令入口
│   ├── instruction/                       # 指令文件适配层（TR7 核心产出）
│   │   ├── model.ts                       # CordInstructionModel 定义
│   │   ├── formatter-factory.ts           # InstructionFormatterFactory
│   │   ├── formatters/
│   │   │   ├── base-formatter.ts          # 基础 Formatter（模板方法）
│   │   │   ├── claude-code-formatter.ts   # Claude Code 适配器
│   │   │   ├── cursor-formatter.ts        # Cursor 适配器
│   │   │   ├── copilot-formatter.ts       # Copilot 适配器
│   │   │   ├── windsurf-formatter.ts      # Windsurf 适配器
│   │   │   └── agents-md-formatter.ts     # AGENTS.md 适配器
│   │   ├── detector/
│   │   │   └── ide-detector.ts            # IDE 环境检测
│   │   ├── merger/
│   │   │   ├── json-merger.ts             # MCP 配置 JSON 合并
│   │   │   └── agents-md-merger.ts        # AGENTS.md 标记区块合并
│   │   └── templates/
│   │       ├── cord-relations.en.md       # 英文指令模板
│   │       ├── cord-relations.zh.md       # 中文指令模板
│   │       └── template-loader.ts         # 模板加载器
│   └── ...
├── tests/
│   ├── instruction/
│   │   ├── formatters/
│   │   │   ├── claude-code-formatter.test.ts
│   │   │   ├── cursor-formatter.test.ts
│   │   │   ├── copilot-formatter.test.ts
│   │   │   ├── windsurf-formatter.test.ts
│   │   │   └── agents-md-formatter.test.ts
│   │   ├── detector/
│   │   │   └── ide-detector.test.ts
│   │   ├── merger/
│   │   │   ├── json-merger.test.ts
│   │   │   └── agents-md-merger.test.ts
│   │   └── __snapshots__/                 # 快照测试基线
│   └── ...
└── ...
```

### 2.2 Formatter 核心实现（伪代码）

```typescript
// src/instruction/formatters/cursor-formatter.ts
import matter from 'gray-matter';
import { BaseFormatter } from './base-formatter';
import type { CordInstructionModel, FormattedOutput } from '../model';

export class CursorFormatter extends BaseFormatter {
  readonly targetIDE = 'cursor';
  readonly fileExtension = '.mdc';

  getTargetPath(projectPath: string): string {
    return path.join(projectPath, '.cursor', 'rules', 'cord-relations.mdc');
  }

  detect(projectPath: string): boolean {
    return existsSync(path.join(projectPath, '.cursor'));
  }

  format(ir: CordInstructionModel): FormattedOutput {
    // 构建 Cursor 特定的 Frontmatter
    const frontmatter: Record<string, any> = {};

    if (ir.triggerMode === 'file_match' && ir.filePatterns.length > 0) {
      frontmatter.alwaysApply = false;
      frontmatter.globs = ir.filePatterns; // 数组格式，Cursor 原生支持
    } else if (ir.triggerMode === 'always') {
      frontmatter.alwaysApply = true;
    }

    if (ir.description) {
      frontmatter.description = ir.description;
    }

    // 使用 gray-matter 生成完整文件
    const content = matter.stringify(
      this.injectVersionComment(ir.content, ir.version),
      frontmatter
    );

    return {
      filePath: this.getTargetPath(''),
      content,
      isNewFile: true,
      mergeStrategy: 'create',
    };
  }
}
```

```typescript
// src/instruction/formatters/copilot-formatter.ts
export class CopilotFormatter extends BaseFormatter {
  readonly targetIDE = 'copilot';
  readonly fileExtension = '.instructions.md';

  getTargetPath(projectPath: string): string {
    return path.join(projectPath, '.github', 'instructions',
                     'cord-relations.instructions.md');
  }

  detect(projectPath: string): boolean {
    const githubDir = path.join(projectPath, '.github');
    if (!existsSync(githubDir)) return false;
    // 二级检测
    return (
      existsSync(path.join(githubDir, 'copilot-instructions.md')) ||
      existsSync(path.join(githubDir, 'instructions'))
    );
  }

  format(ir: CordInstructionModel): FormattedOutput {
    const frontmatter: Record<string, any> = {};

    if (ir.filePatterns.length > 0) {
      // Copilot 使用逗号分隔的字符串格式
      frontmatter.applyTo = ir.filePatterns.join(',');
    }

    if (ir.excludeAgents && ir.excludeAgents.length > 0) {
      frontmatter.excludeAgent = ir.excludeAgents[0]; // Copilot 仅支持单值
    }

    const content = matter.stringify(
      this.injectVersionComment(ir.content, ir.version),
      frontmatter
    );

    return {
      filePath: this.getTargetPath(''),
      content,
      isNewFile: true,
      mergeStrategy: 'create',
    };
  }
}
```

### 2.3 IDE 检测器实现

```typescript
// src/instruction/detector/ide-detector.ts
import { existsSync } from 'fs';
import path from 'path';

export interface DetectedIDE {
  name: string;
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  formatterKey: string;
}

export class IDEDetector {
  detect(projectPath: string): DetectedIDE[] {
    return [
      this.detectClaudeCode(projectPath),
      this.detectCursor(projectPath),
      this.detectCopilot(projectPath),
      this.detectWindsurf(projectPath),
      this.detectGemini(projectPath),
    ];
  }

  private detectClaudeCode(projectPath: string): DetectedIDE {
    const exists = existsSync(path.join(projectPath, '.claude'));
    return {
      name: 'Claude Code',
      detected: exists,
      confidence: exists ? 'high' : 'low',
      reason: exists ? '.claude/ 目录已存在' : '未检测到 .claude/ 目录',
      formatterKey: 'claude-code',
    };
  }

  private detectCopilot(projectPath: string): DetectedIDE {
    const githubDir = path.join(projectPath, '.github');
    if (!existsSync(githubDir)) {
      return {
        name: 'GitHub Copilot',
        detected: false,
        confidence: 'low',
        reason: '未检测到 .github/ 目录',
        formatterKey: 'copilot',
      };
    }

    // 二级检测
    const hasCopilotFiles =
      existsSync(path.join(githubDir, 'copilot-instructions.md')) ||
      existsSync(path.join(githubDir, 'instructions'));

    return {
      name: 'GitHub Copilot',
      detected: true,
      confidence: hasCopilotFiles ? 'high' : 'medium',
      reason: hasCopilotFiles
        ? 'Copilot 指令文件已存在'
        : '.github/ 存在但无 Copilot 指令文件',
      formatterKey: 'copilot',
    };
  }

  // detectCursor, detectWindsurf, detectGemini 类似...
}
```

---

## 3. 测试策略

### 3.1 测试金字塔

```
          ╱╲
         ╱  ╲          E2E 手动验证
        ╱ E2E╲         各 IDE 中加载生成文件 → AI 遵循指令
       ╱──────╲
      ╱        ╲       集成测试
     ╱ 集成测试  ╲      cord init → 检测 → 生成 → 写入 → 验证
    ╱────────────╲
   ╱              ╲    快照测试
  ╱   快照测试     ╲    各 Formatter 输出 → 基线快照对比
 ╱────────────────╲
╱                  ╲   单元测试
╱   单元测试       ╲   IR 转换、Glob 格式转换、标记区块合并
╱────────────────────╲
```

### 3.2 各层测试方案

| 测试层 | 测试对象 | 工具 | 覆盖目标 |
|--------|----------|------|----------|
| **单元测试** | IR 数据模型、Glob 格式转换、版本标记解析 | Vitest | 数据转换 100% |
| **快照测试** | 各 Formatter 的输出文件内容 | Vitest + `toMatchSnapshot()` | 格式正确性 100% |
| **Merger 测试** | AGENTS.md 标记区块合并、JSON MCP 配置合并 | Vitest | 合并场景 100% |
| **IDE 检测测试** | IDEDetector 在各种目录结构下的检测结果 | Vitest + 临时目录 | 检测准确性 |
| **集成测试** | `cord init` 完整流程（检测 → 生成 → 写入） | Vitest + 临时项目目录 | 端到端流程 |
| **E2E 验证** | 在真实 IDE 中加载生成的指令文件 | 手动测试 checklist | 4 IDE 各一轮 |

### 3.3 快照测试示例

```typescript
// tests/instruction/formatters/cursor-formatter.test.ts
import { describe, it, expect } from 'vitest';
import { CursorFormatter } from '../../../src/instruction/formatters/cursor-formatter';
import type { CordInstructionModel } from '../../../src/instruction/model';

describe('CursorFormatter', () => {
  const formatter = new CursorFormatter();

  const baseIR: CordInstructionModel = {
    id: 'cord-relations',
    version: '1.0.0',
    cordVersion: '>=0.1.0',
    content: '当你修改了 Markdown 文档时...',
    filePatterns: ['**/*.md', '**/*.mdx', 'docs/**/*'],
    scope: 'project',
    versionControlled: true,
    description: 'CORD 文档关系维护',
    triggerMode: 'file_match',
  };

  it('should generate correct .mdc file with glob frontmatter', () => {
    const result = formatter.format(baseIR);
    expect(result.content).toMatchSnapshot();
  });

  it('should generate alwaysApply frontmatter for always trigger mode', () => {
    const alwaysIR = { ...baseIR, triggerMode: 'always' as const };
    const result = formatter.format(alwaysIR);
    expect(result.content).toContain('alwaysApply: true');
    expect(result.content).toMatchSnapshot();
  });

  it('should detect Cursor when .cursor/ exists', () => {
    // 使用临时目录模拟
    expect(formatter.detect('/fake/project/with/.cursor')).toBe(true);
  });
});
```

### 3.4 AGENTS.md Merger 测试矩阵

| 测试场景 | 输入 | 预期输出 |
|----------|------|----------|
| AGENTS.md 不存在 | 无文件 | 新建含 CORD 标记区块的文件 |
| AGENTS.md 存在，无 CORD 区块 | 用户内容 | 末尾追加 CORD 标记区块 |
| AGENTS.md 存在，有 CORD 区块 | 用户内容 + 旧 CORD 区块 | 替换 CORD 区块，保留用户内容 |
| AGENTS.md 存在，卸载 | 用户内容 + CORD 区块 | 删除 CORD 区块，保留用户内容 |
| AGENTS.md 仅有 CORD 区块 | CORD 区块 | 卸载后文件为空或仅有换行 |
| 标记区块损坏（仅有 BEGIN） | 部分标记 | 追加新区块，不处理损坏标记 |

---

## 4. 部署与分发

### 4.1 指令模板随 npm 包分发

```json
{
  "name": "cord",
  "files": [
    "dist/",
    "templates/"
  ]
}
```

指令模板文件存储在 `templates/` 目录，`cord init` 从 npm 包中读取模板内容，通过 Formatter 转换后写入用户项目。

### 4.2 `cord init` 子命令设计

基于 TR5 确定的 Commander.js v14 框架：

```typescript
// src/cli/commands/init.ts
import { Command } from 'commander';

export const initCommand = new Command('init')
  .description('Initialize CORD for the current project')
  .option('--lang <language>', 'Instruction language (en/zh)', 'en')
  .option('--ide <ides...>', 'Specify IDEs (claude-code,cursor,copilot,windsurf)')
  .option('--no-agents-md', 'Skip AGENTS.md generation')
  .option('--upgrade', 'Upgrade existing CORD instructions')
  .option('--uninstall', 'Remove all CORD instruction files')
  .option('--dry-run', 'Show what would be generated without writing')
  .action(async (options) => {
    // 实现逻辑...
  });
```

**子命令选项说明：**

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--lang` | 指令内容语言 | `en`（英文） |
| `--ide` | 指定目标 IDE（跳过检测） | 自动检测 |
| `--no-agents-md` | 不生成 AGENTS.md 片段 | 生成 |
| `--upgrade` | 升级已有 CORD 指令 | 全新安装 |
| `--uninstall` | 移除所有 CORD 指令文件 | — |
| `--dry-run` | 预览输出不实际写入 | 实际写入 |

---

## 5. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解策略 |
|---|------|------|------|----------|
| **R1** | gray-matter 无法正确解析 Cursor `.mdc` 格式 | 🟡 中 | 🟡 中 | `.mdc` 本质是带 YAML frontmatter 的 Markdown；如有问题可自定义分隔符或降级为手动解析 |
| **R2** | 各 IDE 更新指令文件格式（新增/移除 frontmatter 字段） | 🟡 中 | 🟡 中 | 各 Formatter 松耦合，单独更新不影响其他；关注 IDE changelog |
| **R3** | AGENTS.md 标记区块被用户误编辑导致升级失败 | 🟢 低 | 🟢 低 | 容错处理：标记损坏时追加新区块而非覆盖；提供 `--force` 选项 |
| **R4** | Glob 模式语法在各 IDE 间行为不一致 | 🟡 中 | 🟡 中 | IR 使用最通用的 Glob 子集（`**/*.md` 风格）；避免使用 brace expansion 等高级语法 |
| **R5** | 用户项目中 `.github/` 存在但非 Copilot 配置 | 🟠 高 | 🟢 低 | 二级检测 + 交互式确认（已在 IDE 检测器中实现） |
| **R6** | MCP 配置 JSON 合并覆盖用户自定义配置 | 🟢 低 | 🟠 高 | 仅添加/更新 `cord` 条目；读取 → 合并 → 写入原子操作；备份机制 |
| **R7** | 指令内容更新后 AI 遵循率下降 | 🟡 中 | 🟡 中 | A/B 测试不同指令措辞；收集用户反馈；参考各 IDE 官方最佳实践 |

---

## 6. 依赖清单

| 依赖 | 用途 | 类型 | 版本 |
|------|------|------|------|
| **gray-matter** | YAML Frontmatter 解析/生成 | 运行时 | ^4.x |
| **@clack/prompts** | 交互式 CLI 提示 | 运行时 | TR5 已选定 |
| **commander** | CLI 命令框架 | 运行时 | TR5 已选定 (v14) |
| **picocolors** | 终端颜色输出 | 运行时 | TR5 已选定 |
| **vitest** | 测试框架 | 开发时 | TR5 已选定 |

**新增依赖仅 `gray-matter` 一个**（其余均为 TR5 已选定的技术栈），最小化依赖增长。

---
