# Technology Stack Analysis

本节从 CORD 冷启动扫描器的技术需求出发，对「基于规则的关系发现」「LLM/Embedding 辅助的关系发现」「框架文档结构识别」三大方向所涉及的编程语言、框架、库、工具与平台进行全面技术栈分析。所有结论均经 Web 搜索验证，并标注来源与置信度。

## 1. 文档解析与链接提取层（规则引擎基础设施）

### 1.1 核心解析引擎：remark / unified.js（已确认 — TR3）

CORD 在 TR3 中已确认采用 **remark / unified.js** 生态作为文档解析引擎。该生态为规则化关系发现提供了坚实基础：

| 维度 | 评估 | 说明 |
|------|------|------|
| AST 结构 | ✅ mdast | 完整的 Markdown AST，覆盖链接、引用、标题、代码块等所有节点类型 |
| 插件化扩展 | ✅ 极佳 | unified 管道模型支持链式插件，CORD 可无缝嵌入自定义插件 |
| Frontmatter 解析 | ✅ remark-frontmatter + remark-parse-yaml | gray-matter 风格的 YAML frontmatter 解析 |
| 链接提取 | ✅ mdast link/linkReference/imageReference | 原生支持相对链接、锚点引用、图片引用 |
| 性能 | ✅ 高效 | 纯 JavaScript，单文件解析 <5ms（中等 Markdown） |
| VFile 数据总线 | ✅ VFile.data | 插件间通过 VFile.data 传递结构化数据（TR3 已设计） |

_置信度：**HIGH** — TR3 已完成 7 维度评估（6✅ 1🟡），生态成熟度经过验证_

### 1.2 关键 remark 生态插件评估

**remark-validate-links（v13）**
- **功能**：验证 Markdown 中的链接和图片是否指向仓库中的现有文件和标题
- **核心能力**：同文件标题链接验证、跨文件引用验证、Git 仓库感知（支持 GitHub/GitLab/Bitbucket）、错别字检测与建议
- **配置项**：`repository`（Git 远程 URL）、`root`（Git 根目录）、`skipPathPatterns`（排除模式）、`urlConfig`（自定义托管配置）
- **CORD 适用性**：🟡 部分适用 — 可作为链接有效性检查的参考实现，但它仅做验证，不做关系提取和分类
- **关键差距**：不提供反向链接分析（backlink analysis），不输出关系图谱数据
- _Source: [remark-validate-links GitHub](https://github.com/remarkjs/remark-validate-links)_

**remark-wiki-link（v1.0+）**
- **功能**：解析和渲染 `[[Wiki Links]]` 为锚点元素，支持别名 `[[Real Page:Page Alias]]`
- **核心能力**：AST 节点包含 `value`（页面名）、`data.alias`（显示文本）、`data.permalink`（计算后的 URL slug）、`data.exists`（页面是否存在）
- **配置项**：`permalinks`（已有页面列表）、`pageResolver`（页面名 → permalink 映射）、`hrefTemplate`（permalink → href 转换）
- **CORD 适用性**：🟡 参考价值 — `[[wiki-link]]` 语法是一种显式关系声明方式，CORD 可参考其 AST 节点设计
- **关键洞见**：`data.exists` 布尔标记模式可借鉴——CORD 可在链接节点上附加关系元数据
- _Source: [remark-wiki-link GitHub](https://github.com/landakram/remark-wiki-link)_

**生态空白确认**：经过全面搜索，**不存在**现成的 remark 插件能直接实现 CORD 所需的「反向链接分析」「关系类型分类」「置信度评分」功能。CORD 必须自行开发专用插件。

_置信度：**HIGH** — 通过 npm/GitHub 直接验证_

### 1.3 Frontmatter 元数据解析

| 工具 | 版本 | 说明 | CORD 适用性 |
|------|------|------|-------------|
| **gray-matter** | v4.x | 最流行的 frontmatter 解析库，支持 YAML/TOML/JSON/Coffee | ✅ 已在 remark 生态中广泛使用 |
| **remark-frontmatter** | v5.x | remark 插件，解析 frontmatter 为 AST 节点 | ✅ TR3 已确认采用 |
| **js-yaml** | v4.x | gray-matter 底层 YAML 解析器 | ✅ 间接依赖 |

CORD 的 frontmatter 关系声明语法设计需要在这些工具之上构建自定义解析逻辑（如 `cord-relations` 字段定义）。

_置信度：**HIGH** — 成熟稳定库_

## 2. LLM 与 Embedding 技术栈（语义关系发现）

### 2.1 三级方案总览

CORD 的 Local-First 架构约束下，LLM 辅助方案需要支持三级降级：

```
Level 3: 云端 LLM（最高准确率，需网络/API Key/付费）
    ↓ 降级
Level 2: 本地 Embedding（中等准确率，离线可用，需首次下载模型）
    ↓ 降级
Level 1: 纯规则（基础准确率，零依赖，即开即用）
```

### 2.2 本地 Embedding 推理引擎

**Transformers.js v3（@huggingface/transformers）**

这是 CORD 本地 Embedding 的首选方案：

| 维度 | 评估 | 说明 |
|------|------|------|
| 运行环境 | ✅ Node.js + 浏览器 | 纯 JavaScript，无原生编译依赖 |
| 模型格式 | ONNX Runtime | 通过 Hugging Face Optimum 转换 |
| 量化支持 | ✅ fp32/fp16/q8/q4 | q8 为 WASM 默认，q4 最激进压缩 |
| GPU 加速 | 🟡 WebGPU（实验性） | Node.js 场景主要用 CPU/WASM |
| 支持模型数 | 100+ 架构 | BERT、MiniLM、nomic-embed 等均支持 |
| 离线能力 | ✅ 完全支持 | 模型首次下载后离线可用 |
| 隐私保护 | ✅ 数据不离开设备 | 符合 Local-First 原则 |

```typescript
// CORD Embedding 推理示例
import { pipeline } from '@huggingface/transformers';

const extractor = await pipeline('feature-extraction',
  'Xenova/all-MiniLM-L6-v2', // 22MB，384 维
  { dtype: 'q8' }
);

const embeddings = await extractor('文档摘要文本', {
  pooling: 'mean',
  normalize: true
});
// → Float32Array[384]
```

- _Source: [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)_

_置信度：**HIGH** — 官方文档直接验证_

**Ollama（本地 LLM 运行时）**

| 维度 | 评估 | 说明 |
|------|------|------|
| 部署模型 | REST API | `http://localhost:11434` |
| Embedding 支持 | ✅ `/api/embeddings` | 支持 nomic-embed-text 等 |
| 模型管理 | ✅ `ollama pull` | 自动下载/管理模型文件 |
| LLM 推理 | ✅ `/api/generate` | 支持全文 LLM 分析（Level 3 本地替代） |
| 额外依赖 | ⚠️ 需安装 Ollama | 非 npm 包，需系统级安装 |
| 资源占用 | ⚠️ 较高 | Embedding 模型 ~300MB，LLM 模型 2-7GB+ |

**CORD 定位**：Ollama 作为 Level 2.5 可选增强——当用户已安装 Ollama 时，提供更高质量的 Embedding（nomic-embed-text 768 维 vs MiniLM 384 维）和本地 LLM 推理能力。

_置信度：**HIGH** — 广泛使用的本地 LLM 运行时_

### 2.3 Embedding 模型对比

| 模型 | 维度 | 大小（q8） | 推理引擎 | MTEB 排名 | 离线 | 适用场景 |
|------|------|-----------|----------|-----------|------|---------|
| **all-MiniLM-L6-v2** | 384 | ~22MB | Transformers.js | 中等 | ✅ | CORD 默认选择——轻量快速 |
| **nomic-embed-text-v1.5** | 768 | ~274MB | Ollama / Transformers.js | 较高 | ✅ | 可选增强——更高语义精度 |
| **bge-small-en-v1.5** | 384 | ~33MB | Transformers.js | 中上 | ✅ | 替代方案——英文场景优化 |
| **text-embedding-3-small** | 1536 | 云端 | OpenAI API | 高 | ❌ | Level 3 云端——最高精度 |
| **text-embedding-3-large** | 3072 | 云端 | OpenAI API | 最高 | ❌ | Level 3 云端——研究级精度 |

**CORD 推荐策略**：
- **MVP 默认**：all-MiniLM-L6-v2（22MB，秒级加载，384 维足够文档相似性计算）
- **增强选项**：检测到 Ollama → 自动升级到 nomic-embed-text-v1.5
- **云端选项**：用户配置 API Key → 启用 OpenAI text-embedding-3-small

_置信度：**MEDIUM-HIGH** — 模型性能数据基于 MTEB 排行榜和社区基准测试，具体 CORD 场景需实测验证_

### 2.4 云端 LLM 服务（Level 3）

| 服务 | 模型 | 定价（Input/Output） | 延迟 | 关系提取能力 |
|------|------|---------------------|------|-------------|
| **OpenAI** | GPT-4o-mini | $0.15/$0.60 /1M tokens | ~1-3s | 高——结构化 JSON 输出 |
| **Anthropic** | Claude 3.5 Haiku | $0.25/$1.25 /1M tokens | ~1-2s | 高——工具调用原生支持 |
| **Google** | Gemini 2.0 Flash | 免费层可用 | ~1-3s | 中高——长上下文优势 |

**CORD 定位**：云端 LLM 仅作为可选的 Level 3 增强，用于：
- 复杂隐含关系推断（如"这份架构文档实际上约束了这三个 Story 的实现方案"）
- 关系类型智能分类（从 9 种类型中选择最准确的类型）
- 批量扫描时的语义理解增强

_置信度：**HIGH** — 主流云服务定价和能力公开可查_

### 2.5 Microsoft GraphRAG 评估

**GraphRAG** 是微软开源的知识图谱构建框架，使用 LLM 从非结构化文本中提取实体和关系：

| 维度 | 评估 | 说明 |
|------|------|------|
| 核心思路 | LLM 驱动关系提取 | 使用 GPT-4 级别模型进行实体/关系/社区检测 |
| 输出质量 | ✅ 高 | 结构化的知识图谱，支持社区摘要 |
| 成本 | ❌ 极高 | 官方标注为"expensive operation"，大量 LLM 调用 |
| 语言 | Python | 非 Node.js 原生 |
| 离线能力 | ❌ | 依赖云端 LLM API |
| CORD 适用性 | 🟡 思路参考 | 其分层社区检测思路可借鉴，但实现路径不适合 CORD 的 Local-First + Node.js 约束 |

**关键借鉴**：GraphRAG 的「分层社区检测」思路——从文档群中识别出主题社区（topic clusters），可用纯规则方式部分实现（目录结构 + 命名模式 → 文档社区）。

_Source: [Microsoft GraphRAG GitHub](https://github.com/microsoft/graphrag)_
_置信度：**HIGH** — 官方仓库和文档验证_

## 3. 文件系统与增量扫描层

### 3.1 文件发现与监控

| 工具 | 版本 | 功能 | CORD 适用性 |
|------|------|------|-------------|
| **fast-glob** | v3.x | 高性能 glob 匹配，支持 `.gitignore` 规则 | ✅ 冷启动文件发现首选 |
| **chokidar** | v4.x | 跨平台文件监控，基于 `fs.watch` | ✅ 增量模式文件变更监听 |
| **picomatch** | v4.x | 轻量级 glob 匹配引擎（fast-glob 底层） | ✅ 命名模式规则引擎 |
| **ignore** | v6.x | `.gitignore` 规则解析器 | ✅ 排除 node_modules 等无关目录 |

**冷启动扫描文件发现流程**：
```
fast-glob('**/*.md', { ignore: gitignoreRules })
  → 文件列表
  → 并行/批量 remark 解析
  → 关系提取
  → SQLite 入库
```

_置信度：**HIGH** — 成熟稳定的 Node.js 工具_

### 3.2 增量扫描策略

| 策略 | 实现方式 | 优势 | 劣势 |
|------|---------|------|------|
| **文件 mtime 对比** | `fs.stat()` mtime vs SQLite documents.updated_at | 简单高效，零额外依赖 | 无法检测 mtime 回退、移动操作 |
| **内容哈希对比** | 文件内容 SHA-256 vs SQLite documents.content_hash | 精确，可检测真正的内容变更 | 需要读取全文件计算哈希 |
| **Git diff 集成** | `git diff --name-only HEAD~1` | 精确，可检测重命名/移动 | 依赖 Git，非 Git 项目不可用 |
| **chokidar 实时监控** | 文件系统事件监听 | 实时，无需手动触发 | 仅适合 MCP Server 常驻模式 |

**CORD 推荐组合**：
- **冷启动**：全量扫描（fast-glob + remark 全量解析）
- **CLI 手动触发**：mtime + content_hash 双重检查
- **MCP Server 常驻**：chokidar 实时监控 + 事件驱动增量更新

_置信度：**HIGH** — 标准 Node.js 文件操作方案_

## 4. 数据存储与索引层（已确认 — TR1）

### 4.1 SQLite + better-sqlite3（核心存储）

TR1 已确认的三表设计为关系发现提供了存储基础：

| 表 | 用途 | 与关系发现的关联 |
|----|------|----------------|
| **documents** | 文档注册表 | 扫描结果入库，content_hash 用于增量检测 |
| **relations** | 关系图谱 | 发现的关系写入，含 type、confidence、source（rule/llm/user）|
| **sync_state** | 同步状态 | 追踪关系变更、标记需要用户确认的关系 |

### 4.2 SQLite FTS5（全文搜索扩展）

| 维度 | 评估 | 说明 |
|------|------|------|
| 内置支持 | ✅ SQLite 标准扩展 | better-sqlite3 开箱支持 FTS5 |
| 中文分词 | 🟡 需自定义 tokenizer | 默认 tokenizer 不支持 CJK 分词 |
| 性能 | ✅ 极快 | 百万级文档全文搜索 <50ms |
| CORD 用途 | 🟡 可选增强 | 文档内容关键词匹配可作为规则引擎的补充信号 |

**CORD 定位**：FTS5 作为 Phase 2+ 增强，为纯规则引擎提供「关键词共现分析」能力——当两篇文档共享大量专有术语时，推断可能存在关系。

_置信度：**HIGH** — SQLite 官方特性_

## 5. 命名模式与目录结构分析

### 5.1 模式匹配工具

| 工具 | 功能 | CORD 用途 |
|------|------|----------|
| **path** (Node.js 内置) | 路径解析、目录提取 | 目录层级关系推断 |
| **picomatch** | Glob 模式匹配 | 文件命名规则引擎 |
| **minimatch** | Glob 模式匹配（npm 内置） | 备选方案 |
| **正则表达式** (内置) | 自定义模式匹配 | 命名约定识别（如 `epic-01` → `story-01-*`） |

### 5.2 命名模式关系推断规则示例

```
规则：文件名数字前缀层级关系
  epic-01.md ──contains──→ story-01-01.md, story-01-02.md
  prd.md ──derived_from──→ epic-*.md

规则：目录包含关系
  docs/architecture/ ──contains──→ docs/architecture/*.md
  docs/epics/ ──context_for──→ docs/stories/

规则：命名后缀关系
  *-spec.md ──must_consistent──→ *-impl.md
  *-test-plan.md ──derived_from──→ *-spec.md
```

_置信度：**HIGH** — 标准路径处理和正则匹配_

## 6. 技术采用趋势

### 6.1 文档关系管理领域趋势

| 趋势 | 方向 | 对 CORD 的影响 |
|------|------|---------------|
| **Obsidian 双向链接模式** | `[[wiki-link]]` 成为知识管理标准交互 | CORD 应支持 wiki-link 语法作为显式关系声明 |
| **Local-First 运动** | 数据本地化、离线优先 | 验证了 CORD 的 Local-First 架构决策 |
| **AI 辅助知识图谱** | GraphRAG、LightRAG 等框架兴起 | 思路可借鉴，但 CORD 场景更聚焦（Markdown 文档关系 vs 通用知识图谱） |
| **嵌入式向量搜索** | sqlite-vec、DuckDB 等嵌入式向量方案 | 未来可考虑 SQLite 向量扩展存储 Embedding |
| **LLM 工具调用** | 结构化输出 + Function Calling 成熟 | Level 3 云端方案可利用结构化输出精准提取关系 |

### 6.2 Obsidian 反向链接实现参考

Obsidian 是目前最成功的文档关系管理工具之一，其核心技术路径：

| 技术要素 | Obsidian 实现 | CORD 借鉴点 |
|---------|--------------|-------------|
| 链接语法 | `[[page]]`、`[[page\|alias]]` | 支持 wiki-link 作为关系声明方式 |
| 反向链接 | 全量扫描后构建反向索引 | CORD 冷启动扫描的核心需求 |
| 图谱视图 | Canvas + D3.js 渲染 | TR8 可视化研究参考 |
| 增量更新 | 文件保存时实时更新链接索引 | MCP Server 常驻模式的参考 |

_置信度：**MEDIUM** — Obsidian 非开源，实现细节基于社区分析和官方文档推断_

## 7. 技术栈总览与 CORD 选型矩阵

| 技术层 | 已确认方案 | 新增评估方案 | 状态 |
|--------|-----------|-------------|------|
| **文档解析** | remark/unified.js（TR3） | — | ✅ 已确认 |
| **链接提取** | cord-link-extractor（TR3） | remark-validate-links（参考）、remark-wiki-link（参考） | ✅ 自研为主 |
| **Frontmatter 解析** | cord-frontmatter-parser（TR3） | gray-matter（底层）| ✅ 已确认 |
| **本地 Embedding** | — | **Transformers.js v3 + all-MiniLM-L6-v2**（推荐） | 🆕 新增评估 |
| **增强 Embedding** | — | Ollama + nomic-embed-text-v1.5（可选） | 🆕 新增评估 |
| **云端 LLM** | — | OpenAI GPT-4o-mini / Anthropic Claude 3.5 Haiku（可选） | 🆕 新增评估 |
| **云端 Embedding** | — | OpenAI text-embedding-3-small（可选） | 🆕 新增评估 |
| **文件发现** | — | **fast-glob + ignore**（推荐） | 🆕 新增评估 |
| **文件监控** | — | **chokidar v4**（MCP 常驻模式） | 🆕 新增评估 |
| **模式匹配** | — | **picomatch + 正则**（推荐） | 🆕 新增评估 |
| **数据存储** | SQLite + better-sqlite3（TR1） | FTS5（可选增强） | ✅ 已确认 |
| **CLI 框架** | Commander.js v14（TR5） | — | ✅ 已确认 |
| **MCP Server** | TypeScript SDK v1.x（TR2） | — | ✅ 已确认 |

---

**技术栈分析完成日期：** 2026-04-01

---
