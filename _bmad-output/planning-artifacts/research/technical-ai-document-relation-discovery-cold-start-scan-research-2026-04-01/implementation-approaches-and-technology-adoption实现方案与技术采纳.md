# Implementation Approaches and Technology Adoption（实现方案与技术采纳）

本节聚焦 CORD 冷启动扫描器的实际实现路径——分阶段交付路线图、开发工作流、测试策略、性能优化、成本管理和风险评估。将前四步的技术栈、集成模式和架构设计转化为可执行的实施计划。

## 1. 分阶段实现路线图

### 1.1 Phase 分解与依赖关系

基于 CORD MVP 路线图（TR5 已规划）和本研究确定的架构，冷启动扫描器的实现分为 4 个递进阶段：

```
Phase A: 规则引擎核心          Phase B: 增量扫描 + CLI
 (MVP 基础)                    (日常可用)
 ┌─────────────┐               ┌─────────────┐
 │ remark 管道  │               │ 增量检测     │
 │ 链接提取     │──────────────→│ chokidar    │
 │ 前置规则     │               │ cord scan   │
 │ SQLite 入库  │               │ --incremental│
 └─────────────┘               └──────┬──────┘
                                      │
Phase C: Embedding 集成         Phase D: LLM + 反馈
 (语义增强)                     (智能增强)
 ┌─────────────┐               ┌─────────────┐
 │ Transformers │               │ LLM Provider│
 │ .js 集成     │──────────────→│ 置信度聚合  │
 │ 相似度计算   │               │ cord review │
 │ Level 2 扫描 │               │ 反馈回路    │
 └─────────────┘               └─────────────┘
```

### 1.2 各 Phase 详细交付物

**Phase A：规则引擎核心（预估 2-3 周）**

| 交付物 | 说明 | 依赖 |
|--------|------|------|
| `cord-relation-analyzer` 插件 | 新增 remark 插件，基于 AST 数据执行规则分析 | TR3 已有插件 |
| `RuleEngine` 类 | 可插拔规则注册/执行引擎 | 无 |
| 5 条内置规则 | link-forward、link-backlink、frontmatter-relations、directory-contains、naming-hierarchy | RuleEngine |
| `ScanService.scanAll()` | 全量扫描编排 | remark 管道 + RuleEngine |
| `SqliteRelationRepository` | 关系 CRUD + 批量 UPSERT | TR1 SQLite 基础 |
| `cord scan` 命令（基础版） | 全量扫描 + 结果输出 | ScanService + Commander.js |
| MCP Tool `cord_scan` | MCP 入口（JSON 输出） | ScanService + MCP SDK |

**Phase B：增量扫描 + CLI 完善（预估 1-2 周）**

| 交付物 | 说明 | 依赖 |
|--------|------|------|
| `ScanService.scanIncremental()` | 增量扫描编排（mtime + content_hash） | Phase A |
| `scan_state` 表管理 | 扫描状态持久化与对比逻辑 | SqliteRelationRepository |
| `FileWatcher` 服务 | chokidar 集成，MCP 常驻模式文件监控 | chokidar v4 |
| `cord scan --incremental` | 增量扫描 CLI 选项 | ScanService |
| `cord scan --dry-run` | 预览模式，不写入数据库 | ScanService |
| 进度展示 | @clack/prompts 进度条 + 扫描报告 | @clack/prompts |

**Phase C：Embedding 集成（预估 2-3 周）**

| 交付物 | 说明 | 依赖 |
|--------|------|------|
| `IEmbeddingProvider` 接口 | 策略模式抽象接口 | 无 |
| `TransformersJsProvider` | Transformers.js + all-MiniLM-L6-v2 | @huggingface/transformers |
| `OllamaProvider` | Ollama REST API 集成 | Ollama（可选） |
| `EmbeddingService` | 文档摘要生成 + 向量计算 + 余弦相似度 | IEmbeddingProvider |
| `EmbeddingStrategy` | Level 2 发现策略 | EmbeddingService |
| `cord scan --level embedding` | Level 2 扫描选项 | StrategyOrchestrator |
| 相似度阈值调参 | 基准测试确定最优阈值（预期 0.7-0.85） | 测试数据集 |

**Phase D：LLM + 反馈回路（预估 2-3 周）**

| 交付物 | 说明 | 依赖 |
|--------|------|------|
| `OpenAIProvider` | OpenAI Embeddings + Chat API | API Key 配置 |
| `LLMService` | LLM 推断编排（数据最小化、结构化输出） | IEmbeddingProvider |
| `LLMStrategy` | Level 3 发现策略 | LLMService |
| `ConfidenceService` | 多源置信度加权聚合 | Phase A-C |
| `cord review` 命令 | 交互式低置信度关系审查 | ConfidenceService + @clack/prompts |
| MCP Tool `cord_confirm_relation` | AI IDE 内关系确认/拒绝 | FeedbackService |
| `BmadFrameworkAdapter` | BMAD-Method 框架适配器（参考实现） | FrameworkRegistry |

_置信度：**HIGH** — 基于 Step 2-4 确认的技术栈和架构设计_

## 2. 开发工作流与工具链

### 2.1 构建与打包

| 工具 | 版本 | 用途 | 配置要点 |
|------|------|------|---------|
| **tsup** | v8.x | TypeScript 构建 | ESM 输出 + 入口分离（CLI / MCP / Core） |
| **TypeScript** | v5.x | 类型系统 | `strict: true`，`moduleResolution: "bundler"` |
| **Node.js** | v20+ LTS | 运行时 | 利用原生 `fetch()`、`crypto.subtle` |
| **pnpm** | v9.x | 包管理 | workspace 支持（未来 monorepo 扩展） |

**tsup 构建配置**：

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { 'mcp-server': 'src/mcp/index.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    sourcemap: true,
  },
  {
    entry: { core: 'src/core/index.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    dts: true,  // 生成类型声明
    sourcemap: true,
  },
]);
```

### 2.2 数据库 Schema 迁移

CORD 采用 **版本化迁移脚本** 管理 SQLite Schema 演进：

```typescript
// 迁移文件结构
// src/infrastructure/migrations/
//   001-initial-schema.ts
//   002-add-scan-level.ts
//   003-add-embedding-cache.ts

interface Migration {
  version: number;
  description: string;
  up(db: Database): void;
  down(db: Database): void;
}

class MigrationRunner {
  constructor(private db: Database) {}

  run(): void {
    // 检查当前版本
    const currentVersion = this.getCurrentVersion();
    // 执行所有待运行的迁移（在事务中）
    const pending = migrations.filter(m => m.version > currentVersion);
    this.db.transaction(() => {
      for (const migration of pending) {
        migration.up(this.db);
        this.setVersion(migration.version);
      }
    })();
  }
}
```

_置信度：**HIGH** — 标准数据库迁移模式，better-sqlite3 事务支持已验证_

## 3. 测试策略

### 3.1 测试金字塔

```
         ╱  E2E Tests  ╲           少量：完整 cord scan 命令端到端
        ╱───────────────╲
       ╱ Integration Tests╲        中等：Service + Repository + SQLite
      ╱─────────────────────╲
     ╱     Unit Tests        ╲     大量：规则引擎、插件、置信度算法
    ╱─────────────────────────╲
```

### 3.2 各层测试策略

| 测试层 | 框架 | 测试对象 | 关键技巧 |
|--------|------|---------|---------|
| **单元测试** | Vitest | 规则引擎、remark 插件、置信度算法、Provider | 模拟 VFile.data、模拟 AST 节点 |
| **集成测试** | Vitest | Service + Repository + SQLite | 使用 `:memory:` SQLite 数据库 |
| **E2E 测试** | Vitest + execa | `cord scan` CLI 命令 | 临时目录 + 测试 Markdown 文件 |
| **性能测试** | Vitest bench | 扫描延迟、批量入库速度 | 生成 100/500/1000 文档的测试数据集 |

**remark 插件单元测试示例**：

```typescript
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { cordLinkExtractor } from '../plugins/cord-link-extractor';

describe('cord-link-extractor', () => {
  const processor = unified()
    .use(remarkParse)
    .use(cordLinkExtractor);

  it('should extract relative markdown links', async () => {
    const file = await processor.process(
      '[See architecture](./docs/architecture.md)'
    );
    expect(file.data.cordLinks).toEqual([
      expect.objectContaining({
        target: 'docs/architecture.md',
        text: 'See architecture',
      })
    ]);
  });

  it('should extract wiki-style links', async () => {
    const file = await processor.process('See [[architecture]]');
    expect(file.data.cordLinks).toEqual([
      expect.objectContaining({
        target: 'architecture',
      })
    ]);
  });

  it('should ignore external URLs', async () => {
    const file = await processor.process(
      '[Google](https://google.com)'
    );
    expect(file.data.cordLinks).toHaveLength(0);
  });
});
```

**规则引擎单元测试示例**：

```typescript
describe('RuleEngine', () => {
  it('should execute rules in priority order', () => {
    const engine = new RuleEngine();
    const executionOrder: string[] = [];

    engine.register({
      id: 'rule-b', priority: 20,
      applies: () => true,
      execute: () => { executionOrder.push('b'); return []; }
    });
    engine.register({
      id: 'rule-a', priority: 10,
      applies: () => true,
      execute: () => { executionOrder.push('a'); return []; }
    });

    engine.execute(mockContext);
    expect(executionOrder).toEqual(['a', 'b']);
  });

  it('should skip non-applicable rules', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'md-only', priority: 1,
      applies: (doc) => doc.path.endsWith('.md'),
      execute: () => [mockCandidate]
    });

    const result = engine.execute({ ...mockContext, sourceDoc: { path: 'readme.txt' } });
    expect(result).toHaveLength(0);
  });
});
```

### 3.3 关系发现准确率评估

**黄金标准测试集**：创建一组人工标注的文档关系对，用于评估各 Level 的发现准确率：

```typescript
// 评估指标
interface DiscoveryMetrics {
  precision: number;  // 发现的关系中有多少是正确的
  recall: number;     // 实际存在的关系中有多少被发现
  f1Score: number;    // 精确率和召回率的调和平均
}

// 评估流程
async function evaluateDiscovery(
  level: 1 | 2 | 3,
  testDocs: TestDocument[],
  goldRelations: GoldRelation[]
): Promise<DiscoveryMetrics> {
  const discovered = await scanService.scanAll({ level, docs: testDocs });
  const truePositives = discovered.filter(d =>
    goldRelations.some(g =>
      g.source === d.sourceId && g.target === d.targetId && g.type === d.type
    )
  );
  const precision = truePositives.length / discovered.length;
  const recall = truePositives.length / goldRelations.length;
  const f1Score = 2 * (precision * recall) / (precision + recall);
  return { precision, recall, f1Score };
}
```

**目标指标**：

| Level | Precision 目标 | Recall 目标 | F1 目标 |
|-------|-------------|-----------|---------|
| Level 1（规则） | ≥ 0.90 | ≥ 0.60 | ≥ 0.72 |
| Level 2（Embedding） | ≥ 0.80 | ≥ 0.80 | ≥ 0.80 |
| Level 3（LLM） | ≥ 0.85 | ≥ 0.90 | ≥ 0.87 |

_说明：Level 1 追求高 Precision（不误报），容忍较低 Recall（允许遗漏）；Level 2/3 追求 Precision 和 Recall 的平衡。_

_置信度：**MEDIUM** — 目标指标为设计预期值，需实际场景基准测试验证_

## 4. 性能优化策略

### 4.1 冷启动扫描性能优化

| 优化策略 | 技术手段 | 预期收益 | 阶段 |
|---------|---------|---------|------|
| **批量 I/O** | `Promise.all()` 并行文件读取，批次大小 20-50 | 文件读取 3-5x 加速 | Phase A |
| **事务批量写入** | `better-sqlite3 transaction()` 包装批量 UPSERT | 入库 10x 加速 | Phase A |
| **懒加载模型** | Embedding 模型首次调用时加载，后续复用 | 避免不必要的模型加载开销 | Phase C |
| **文档摘要缓存** | 仅在内容变更时重新生成摘要+Embedding | 增量扫描跳过未变更文档 | Phase C |
| **Worker Threads** | 计算密集的 Embedding 推理放入 Worker | 不阻塞主线程 I/O | Phase C（可选） |
| **LLM 批量调用** | 多文档对批量发送，单次 API 调用 | 减少网络往返，降低延迟 | Phase D |

### 4.2 性能基准测试计划

```typescript
// vitest bench 性能测试
import { bench, describe } from 'vitest';

describe('Cold Start Scan Performance', () => {
  bench('100 docs — Level 1 (rules only)', async () => {
    await scanService.scanAll({ level: 1, root: testDir100 });
  }, { time: 10000 }); // 目标: < 5s

  bench('100 docs — Level 2 (rules + embedding)', async () => {
    await scanService.scanAll({ level: 2, root: testDir100 });
  }, { time: 30000 }); // 目标: < 15s

  bench('500 docs — Level 1 (rules only)', async () => {
    await scanService.scanAll({ level: 1, root: testDir500 });
  }, { time: 30000 }); // 目标: < 25s

  bench('incremental scan — 1 changed file in 500', async () => {
    await scanService.scanIncremental({ root: testDir500 });
  }, { time: 5000 }); // 目标: < 500ms
});
```

**性能预算**：

| 场景 | 性能预算 | 依据 |
|------|---------|------|
| 100 docs 全量 Level 1 | < 5s | TR1 性能约束：冷启动 < 10s |
| 100 docs 全量 Level 2 | < 15s | 含模型首次加载 ~5s |
| 增量扫描（1 file） | < 500ms | 日常使用可接受延迟 |
| SQLite 查询延迟 | < 50ms | TR1 已验证 |
| CLI 冷启动 | < 200ms | TR5 懒加载优化目标 |

_置信度：**MEDIUM-HIGH** — 性能预算基于各工具已知特征推算，需实测确认_

## 5. 成本优化与资源管理

### 5.1 LLM 调用成本控制

| 控制策略 | 实现方式 | 预期效果 |
|---------|---------|---------|
| **Token 预算** | 每次扫描设定 Token 上限（默认 10K tokens） | 控制单次扫描成本 < $0.01 |
| **渐进调用** | 先 Level 1+2 筛选候选，仅低置信度对发送 LLM | 减少 80%+ LLM 调用量 |
| **摘要化输入** | 仅发送标题+章节+frontmatter，不发送全文 | 单文档 token < 200 |
| **批量处理** | 多文档对合并单次 API 调用 | 减少 API 调用次数 |
| **缓存结果** | LLM 分析结果按 content_hash 缓存 | 内容未变更不重复调用 |

**成本估算**（以 OpenAI GPT-4o-mini 为例）：

| 场景 | 文档数 | 候选对数 | LLM 调用数 | 预估 Token | 预估成本 |
|------|--------|---------|-----------|-----------|---------|
| 小型项目 | 50 | ~100 | ~20 | ~4K | < $0.001 |
| 中型项目 | 200 | ~500 | ~50 | ~10K | < $0.003 |
| 大型项目 | 1000 | ~3000 | ~200 | ~40K | < $0.01 |

_置信度：**MEDIUM** — 成本估算基于 GPT-4o-mini 定价（$0.15/1M input），实际取决于文档复杂度_

### 5.2 模型资源管理

| 资源 | 大小 | 首次下载 | 存储位置 | 管理策略 |
|------|------|---------|---------|---------|
| **all-MiniLM-L6-v2（q8）** | ~22MB | ~5s（宽带） | `~/.cache/huggingface/` | Transformers.js 自动管理 |
| **nomic-embed-text-v1.5** | ~274MB | Ollama pull | Ollama 模型目录 | Ollama 自动管理 |
| **SQLite 数据库** | ~1-10MB | 即时创建 | `.cord/cord.db` | 项目本地，.gitignore |
| **Embedding 缓存** | ~0.5-5MB | 渐进增长 | SQLite 表 | content_hash 索引 |

## 6. npm 分发与跨平台考量

### 6.1 better-sqlite3 跨平台策略

better-sqlite3 包含原生 C++ 绑定，跨平台分发是关键挑战（TR9 待深入研究）：

| 策略 | 说明 | 优劣 |
|------|------|------|
| **prebuild 预编译** | 为 win/mac/linux 预编译二进制 | ✅ 用户零编译；⚠️ CI 矩阵复杂 |
| **node-gyp 现场编译** | 安装时自动编译 | ⚠️ 需要 C++ 编译工具链 |
| **optionalDependencies** | 原生依赖作为可选 | ✅ 安装失败不阻断；⚠️ 需 fallback |

**CORD 推荐**：依赖 better-sqlite3 自身的 prebuild 机制（v11+ 已内置 prebuild-install），覆盖主流平台 + 架构组合。详细分发策略留待 TR9 深入研究。

_置信度：**MEDIUM** — better-sqlite3 prebuild 机制成熟，但具体 CI 配置需 TR9 验证_

## 7. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解策略 |
|---|------|------|------|---------|
| R1 | Embedding 模型精度不足以区分文档关系 | 中 | 高 | Phase C 设立评估关卡，F1 < 0.7 则降级为可选功能 |
| R2 | better-sqlite3 原生依赖导致部分平台安装失败 | 低 | 高 | prebuild 覆盖 + 清晰错误提示 + 安装文档 |
| R3 | Transformers.js 首次加载模型过慢（弱网环境） | 中 | 中 | 提供离线模型包 + 加载进度提示 + 跳过选项 |
| R4 | 命名规则误匹配（false positive） | 中 | 低 | 置信度标注 + 默认 < 0.7 不自动入库，需用户确认 |
| R5 | LLM API 不稳定或响应格式变化 | 低 | 中 | 结构化输出 Schema + 响应校验 + graceful fallback |
| R6 | 大型项目（1000+ docs）扫描性能不达标 | 低 | 高 | 并行批处理 + Worker Threads + 分批扫描 |
| R7 | SQLite 并发写入冲突（CLI + MCP 同时运行） | 低 | 中 | WAL 模式 + 写锁重试 + 单写多读 |

**关键缓解原则**：
- **Phase Gate（阶段门）**：每个 Phase 结束时设评估关卡，不达标则调整方案或降级
- **Graceful Degradation**：任何增强功能失败都不应阻断核心规则扫描
- **用户透明**：所有降级/回退行为通过 CLI 输出或 MCP 通知告知用户

_置信度：**HIGH** — 风险基于 TR1-TR5 和本研究已识别的技术约束_

## 8. 成功指标与 KPI

| KPI | 目标值 | 度量方式 | 阶段 |
|-----|--------|---------|------|
| **Level 1 扫描 F1** | ≥ 0.72 | 黄金标准测试集 | Phase A |
| **Level 2 扫描 F1** | ≥ 0.80 | 黄金标准测试集 | Phase C |
| **100 docs 冷启动延迟** | < 10s | Vitest bench | Phase A |
| **增量扫描延迟** | < 500ms | Vitest bench | Phase B |
| **CLI 冷启动** | < 200ms | 启动到首次输出 | Phase A |
| **测试覆盖率** | ≥ 80% | Vitest coverage | 全阶段 |
| **零运行时崩溃** | 0 次 | E2E 测试通过率 100% | 全阶段 |

---

**实现研究完成日期：** 2026-04-01

---
