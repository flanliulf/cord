# Implementation Approaches and Technology Adoption

## 依赖引入策略

### 核心依赖 vs 可选依赖

| 包名 | 角色 | 安装策略 | 大小估算 | 理由 |
|------|------|---------|---------|------|
| **无新增核心依赖** | DSL 生成 | — | 0 | MermaidDSLBuilder 是纯字符串操作，零依赖 |
| `@mermaid-js/mermaid-cli` | SVG/PNG 渲染 | `optionalDependencies` | ~300MB+ (含 Puppeteer + Chromium) | 仅 `--format svg/png` 时需要，大多数用户只需 DSL 文本 |
| `mermaid` | DSL 语法验证 | `optionalDependencies` | ~2MB | 可选：用于 `mermaid.parse()` 验证 DSL 合法性 |

**关键设计决策**：可视化模块**不增加核心包的任何新依赖**。DSL 生成是纯 TypeScript 字符串操作，完全内置于 CORD 核心。

### 安装体验设计

```bash
# 最小安装 — 只有 DSL 文本输出
npm install -g cord

# 完整安装 — 支持 SVG/PNG 渲染
npm install -g cord
npm install -g @mermaid-js/mermaid-cli

# 按需使用 — 不安装 mermaid-cli，通过 npx 临时调用
cord graph show --format mermaid > graph.mmd
npx mmdc -i graph.mmd -o graph.svg
```

## 实现路线图

### Phase V1：DSL 生成核心（3-4 天）

| 任务 | 优先级 | 依赖 | 产出 |
|------|--------|------|------|
| `MermaidDSLBuilder` 类实现 | P0 | 无 | 类型安全的 DSL 构建器 |
| `MermaidGenerator` 服务实现 | P0 | MermaidDSLBuilder | GraphData → Mermaid DSL 转换 |
| 关系类型 → 边样式映射表 | P0 | MermaidGenerator | 7 种关系类型的完整映射 |
| 文档类型 → 节点形状映射表 | P0 | MermaidGenerator | 文档/目录/配置等类型映射 |
| 单元测试（Vitest） | P0 | 上述全部 | DSL 输出快照测试 |

**验收标准**：给定 GraphData，生成语法正确的 Mermaid DSL 文本

### Phase V2：视图策略引擎（3-4 天）

| 任务 | 优先级 | 依赖 | 产出 |
|------|--------|------|------|
| `ViewStrategy` 接口定义 | P0 | Phase V1 | 策略模式基础 |
| `GlobalViewStrategy` 实现 | P0 | ViewStrategy | 全局视图查询 + 自动布局选择 |
| `LocalViewStrategy` 实现 | P0 | ViewStrategy | N 跳邻居查询 |
| `PathViewStrategy` 实现 | P1 | ViewStrategy | 两点间路径查询 |
| `DirectoryCollapser` 实现 | P1 | GlobalViewStrategy | L1 降级策略 |
| `ViewStrategyEngine` 组装 | P0 | 上述全部 | 策略引擎入口 |
| 集成测试 | P0 | 上述全部 | 策略选择 + 查询正确性 |

**验收标准**：三种视图均能正确查询并生成 DSL

### Phase V3：CLI + MCP 集成（2-3 天）

| 任务 | 优先级 | 依赖 | 产出 |
|------|--------|------|------|
| `VisualizationService` 实现 | P0 | Phase V2 | 统一可视化服务（共享层） |
| `cord graph show` CLI 命令 | P0 | VisualizationService | Commander.js 子命令 |
| `cord graph export` CLI 命令 | P1 | VisualizationService | 文件输出命令 |
| `graph.show` MCP Tool | P0 | VisualizationService | MCP Tool 注册 |
| `graph.export` MCP Tool | P1 | VisualizationService | MCP Tool 注册 |
| `MermaidRenderer` 可选渲染器 | P2 | mermaid-cli | SVG/PNG 文件输出 |
| E2E 测试 | P0 | 上述全部 | CLI 命令完整性 |

**验收标准**：`cord graph show` 输出正确 Mermaid DSL，MCP Tool 返回正确结果

### Phase V4：降级 + 缓存 + 主题（2-3 天）

| 任务 | 优先级 | 依赖 | 产出 |
|------|--------|------|------|
| 四级降级策略完整实现 | P1 | Phase V2 | L0-L3 自动降级 |
| `GraphShardingEngine` 实现 | P1 | 降级策略 | L3 分片输出 |
| 三级缓存系统 | P1 | Phase V3 | 查询/DSL/渲染缓存 |
| CORD 预定义主题 | P2 | Phase V1 | default/dark/minimal 主题 |
| 关系类型色彩编码 | P2 | Phase V1 | 颜色 classDef 映射 |

**验收标准**：200+ 节点项目不报错，有缓存命中日志

## 测试策略

### 四层测试金字塔

```
                    ┌─────────┐
                    │  E2E    │ cord graph show → stdout 验证
                   ┌┴─────────┴┐
                   │ Integration │ Service + Repository + SQLite
                  ┌┴─────────────┴┐
                  │   Unit Tests   │ DSLBuilder / Generator / Strategy
                 ┌┴─────────────────┴┐
                 │   Snapshot Tests    │ DSL 输出 + SVG 渲染快照
                 └────────────────────┘
```

| 测试层 | 工具 | 覆盖目标 | 数量预估 |
|-------|------|---------|---------|
| **Unit** | Vitest | MermaidDSLBuilder 方法、映射规则、边界条件 | 30-40 用例 |
| **Snapshot** | Vitest toMatchSnapshot | DSL 输出格式稳定性、防止回归 | 15-20 快照 |
| **Integration** | Vitest + 内存 SQLite | ViewStrategy 查询 + DSL 生成全链路 | 10-15 用例 |
| **E2E** | Vitest + execa | `cord graph show` CLI 命令完整行为 | 5-8 用例 |

### DSL 快照测试示例

```typescript
// tests/unit/mermaid-dsl-builder.test.ts
import { describe, it, expect } from 'vitest';
import { MermaidDSLBuilder } from '../src/services/visualization/mermaid-dsl-builder';

describe('MermaidDSLBuilder', () => {
  it('should generate basic flowchart', () => {
    const dsl = new MermaidDSLBuilder()
      .graph('LR')
      .node('a', 'doc-a.md', 'markdown')
      .node('b', 'doc-b.md', 'markdown')
      .edge('a', 'b', 'reference', '引用')
      .build();

    expect(dsl).toMatchSnapshot();
  });

  it('should apply correct edge style for each relation type', () => {
    const builder = new MermaidDSLBuilder().graph('TB');
    const relations: RelationType[] = [
      'composition', 'reference', 'dependency',
      'authority', 'consistency', 'implements', 'extends'
    ];
    relations.forEach((rel, i) => {
      builder.edge(`n${i}`, `n${i + 1}`, rel, rel);
    });
    expect(builder.build()).toMatchSnapshot();
  });

  it('should handle subgraph nesting for directories', () => {
    const dsl = new MermaidDSLBuilder()
      .graph('TB')
      .subgraphStart('docs', '📁 docs/')
        .node('a', 'arch.md', 'markdown')
        .subgraphStart('api', '📁 docs/api/')
          .node('b', 'rest.md', 'markdown')
        .subgraphEnd()
      .subgraphEnd()
      .edge('a', 'b', 'reference')
      .build();

    expect(dsl).toMatchSnapshot();
  });

  it('should escape special characters in labels', () => {
    const dsl = new MermaidDSLBuilder()
      .graph('TB')
      .node('a', 'file "with" quotes.md', 'markdown')
      .build();

    expect(dsl).not.toContain('"with"'); // 应被转义
    expect(dsl).toMatchSnapshot();
  });
});
```

### 降级策略测试

```typescript
// tests/integration/degradation.test.ts
describe('Degradation Strategy', () => {
  it('should use L0 for small graphs', async () => {
    const graphData = createTestGraph({ nodes: 30, edges: 50 });
    const result = await engine.generate(graphData);
    expect(result.degradationLevel).toBe(0);
  });

  it('should auto-collapse directories at L1', async () => {
    const graphData = createTestGraph({ nodes: 100, edges: 300 });
    const result = await engine.generate(graphData);
    expect(result.degradationLevel).toBe(1);
    expect(result.dsl).toContain('subgraph');
    expect(result.collapsedDirectories).toBeGreaterThan(0);
  });

  it('should filter weak relations at L2', async () => {
    const graphData = createTestGraph({ nodes: 150, edges: 450 });
    const result = await engine.generate(graphData);
    expect(result.degradationLevel).toBe(2);
    expect(result.filteredEdgeCount).toBeLessThan(graphData.edges.length);
  });

  it('should shard into multiple diagrams at L3', async () => {
    const graphData = createTestGraph({ nodes: 300, edges: 800 });
    const result = await engine.generate(graphData);
    expect(result.degradationLevel).toBe(3);
    expect(result.shards.length).toBeGreaterThan(1);
    expect(result.overview).toBeDefined();
  });
});
```

## 目录结构

衔接 TR5 已确定的项目目录结构，可视化模块的位置：

```
src/
├── services/
│   ├── visualization/              ← 新增：可视化模块
│   │   ├── index.ts                # VisualizationService（公共 API）
│   │   ├── mermaid-dsl-builder.ts  # MermaidDSLBuilder（Builder 模式）
│   │   ├── mermaid-generator.ts    # MermaidGenerator（GraphData → DSL）
│   │   ├── mermaid-renderer.ts     # MermaidRenderer（DSL → SVG/PNG，可选）
│   │   ├── view-strategy-engine.ts # ViewStrategyEngine（策略引擎入口）
│   │   ├── strategies/
│   │   │   ├── global-view.ts      # GlobalViewStrategy
│   │   │   ├── local-view.ts       # LocalViewStrategy
│   │   │   └── path-view.ts        # PathViewStrategy
│   │   ├── degradation/
│   │   │   ├── directory-collapser.ts  # L1 目录折叠
│   │   │   ├── relation-filter.ts      # L2 关系过滤
│   │   │   └── graph-sharding.ts       # L3 分片输出
│   │   ├── themes/
│   │   │   └── cord-themes.ts      # 预定义主题
│   │   └── cache/
│   │       └── graph-cache.ts      # 三级缓存
│   ├── relation-service.ts         # 已有
│   ├── scan-service.ts             # 已有
│   └── config-service.ts           # 已有
├── cli/commands/
│   └── graph.ts                    # cord graph <show|export|path> ← 新增
├── mcp/tools/
│   └── graph-tools.ts              # graph.show / graph.export ← 新增
tests/
├── unit/
│   ├── mermaid-dsl-builder.test.ts
│   ├── mermaid-generator.test.ts
│   └── view-strategies.test.ts
├── integration/
│   ├── visualization-service.test.ts
│   └── degradation.test.ts
└── e2e/
    └── graph-commands.test.ts
```

## 风险评估与缓解

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| **Mermaid maxEdges 限制** | 🔴 高（中大型项目必触发） | 🔴 高 | 四级降级策略（ADR-V5） |
| **Puppeteer 安装失败** | 🟡 中（企业防火墙/CI） | 🟡 中 | DSL 默认输出 + 优雅降级提示 |
| **Mermaid 语法变更** | 🟢 低（v11 语法稳定） | 🟡 中 | 快照测试检测回归 + 版本锁定 |
| **ELK 布局性能** | 🟡 中（500+ 节点场景） | 🟡 中 | L1 目录折叠先于 ELK 启动 |
| **DSL 特殊字符转义** | 🟡 中 | 🟢 低 | 转义函数 + 边界测试用例 |
| **跨平台 Puppeteer** | 🟡 中（Linux ARM 等） | 🟡 中 | 作为 optionalDep + npx 降级 |

## 成功指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **DSL 生成速度** | < 50ms（100 节点） | Vitest bench |
| **SVG 渲染速度** | < 3s（100 节点，含 Puppeteer 启动） | E2E 计时 |
| **缓存命中率** | > 80%（连续操作） | 日志统计 |
| **测试覆盖率** | > 85%（可视化模块） | Vitest coverage |
| **降级成功率** | 100%（无渲染报错） | 压力测试 |
| **核心包体积影响** | < 5KB（纯 DSL 代码） | `npm pack` |

## 与已有 TR 研究的集成矩阵

| 前置 TR | 本研究依赖点 | 集成方式 |
|---------|------------|---------|
| **TR1** (SQLite) | `RelationRepository` 接口 | ViewStrategy.query() 调用 Repository |
| **TR2** (MCP Server) | `graph.show` / `graph.export` Tool | VisualizationService 注入 MCP Tool |
| **TR3** (remark/unified) | `cord graph show` → ` ```mermaid ` 代码块 | 纯文本嵌入，无 AST 管道依赖 |
| **TR4** (IDE Hooks) | 三层集成（MCP/指令/Hooks） | MCP Tool 返回 DSL → AI 渲染 |
| **TR5** (CLI 框架) | `cord graph` Commander.js 子命令 | CLI 命令层调用 VisualizationService |
| **TR6** (冷启动扫描) | `cord scan` 更新关系 → 缓存失效 | 扫描时间戳触发缓存刷新 |
| **TR7** (全局指令兼容) | 指令文件嵌入关系图快照 | DSL 文本注入 CLAUDE.md 等文件 |
