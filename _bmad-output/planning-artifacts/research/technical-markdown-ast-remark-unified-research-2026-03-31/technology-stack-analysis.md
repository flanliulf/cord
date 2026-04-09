# Technology Stack Analysis

## 核心技术生态：unified.js 平台

unified.js 是一个**内容转换框架**，通过抽象语法树（AST）实现结构化内容的解析、检查、转换和序列化。其生态规模令人瞩目：

| 指标 | 数据 |
|------|------|
| 开源项目数 | 312 个 |
| GitHub Stars 总计 | 69,000+ |
| npm 包数量 | 478 个 |
| npm 月下载量 | **54 亿次** |
| 已关闭 Issues/PRs | 5,000+ （仅 3% 保持开放状态） |

**主要处理器：**
- **remark** — Markdown 处理（使用 mdast 语法树）
- **rehype** — HTML 处理（使用 hast 语法树）
- **retext** — 自然语言处理（使用 nlcst 语法树）

**知名用户：** Prettier、Gatsby、Node.js 官方文档、alex（写作分析工具）

_Source: [https://unifiedjs.com/](https://unifiedjs.com/)_

## remark：Markdown 处理核心

remark 是基于 unified 的 Markdown 处理工具，通过插件机制实现 Markdown 的检查和转换。

**核心特性：**
- ✅ **100% CommonMark 兼容** — 严格遵循 CommonMark 规范
- ✅ **GFM / MDX 可选支持** — 通过插件扩展
- ✅ **基于 AST** — 使用 mdast 格式，支持程序化内容操作
- ✅ **150+ 官方/社区插件** — 被称为"世界上最受欢迎的 Markdown 解析器"

**核心包组成：**

| 包名 | 功能 | CORD 相关性 |
|------|------|------------|
| `remark-parse` | Markdown → mdast 语法树 | 🔴 核心依赖 |
| `remark-stringify` | mdast 语法树 → Markdown | 🟡 可能需要（关系注入） |
| `remark` | unified + parse + stringify 整合包 | 🟠 便捷入口 |
| `remark-cli` | 命令行工具 | 🟢 可选参考 |

**兼容性：** Node.js 16+

_Source: [https://github.com/remarkjs/remark](https://github.com/remarkjs/remark)_

## micromark：底层解析引擎

remark 底层使用 **micromark** 作为解析引擎，这是一个基于状态机的 Markdown 解析器。

**架构特征：**
- **四阶段管线：** Preprocess → Parse → Postprocess → Compile
- **最小 CommonMark 解析器：** 仅 ±14kb
- **严格字节追踪：** 每个字节都有位置信息
- **测试覆盖：** ±2,000 个测试，100% 覆盖率，含模糊测试
- **双模式输出：** 支持缓冲处理和流式接口

**扩展机制：**
- **语法扩展（Syntax Extensions）** — 通过字符编码钩子修改解析行为
- **HTML 扩展（HTML Extensions）** — 通过 token enter/exit 处理器控制编译
- **官方扩展：** GFM、MDX、Math、Directives 等

_Source: [https://github.com/micromark/micromark](https://github.com/micromark/micromark)_

## mdast：Markdown 抽象语法树规范

mdast 是 Markdown AST 的标准规范，继承自 unist（通用语法树规范），定义了完整的节点类型系统。

**核心节点类型（对 CORD 关键）：**

| 节点类型 | AST type | 关键属性 | CORD 用途 |
|----------|----------|---------|----------|
| Heading | `heading` | `depth: 1-6` | 章节锚点提取 |
| Paragraph | `paragraph` | children: PhrasingContent | 段落级定位 |
| Code | `code` | `lang`, `meta` | 代码块识别 |
| Link | `link` | `url`, `title` | 文档间关系发现 |
| LinkReference | `linkReference` | `identifier`, `label`, `referenceType` | 引用关系追踪 |
| Definition | `definition` | `identifier`, `url` | 引用定义解析 |
| List / ListItem | `list` / `listItem` | `ordered`, `checked` | 结构化内容提取 |
| Root | `root` | children: Content | 文档根节点 |

**内容模型：**
- **FlowContent** — 块级内容（Blockquote, Code, Heading, List, Paragraph 等）
- **PhrasingContent** — 行内内容（Emphasis, Strong, InlineCode, Link, Image 等）
- **ListContent** — 列表内容（ListItem）

**Mixin 系统：**
- **Resource** — `url` + `title`（链接/图片共用）
- **Reference** — `identifier` + `label` + `referenceType`（引用类型共用）
- **Alternative** — `alt`（替代文本）
- **Association** — 链接到 Definition 节点

**TypeScript 类型：** 通过 `@types/mdast` 安装，提供完整的 AST 节点类型定义

_Source: [https://github.com/syntax-tree/mdast](https://github.com/syntax-tree/mdast)_

## 替代方案简要对比

### markdown-it

| 维度 | 数据 |
|------|------|
| 定位 | 面向渲染的 Markdown 解析器（Markdown → HTML） |
| 性能 | 标准模式 743 ops/sec，CommonMark 模式 1,568 ops/sec（2013 MacBook Pro 基准） |
| CommonMark 合规 | 100% |
| 架构 | 三阶段管线：Core → Block → Inline |
| 插件系统 | 链式 `.use()` API |
| TypeScript | ES 模块，含 TypeScript 文件（35.4%） |
| **AST 访问** | ⚠️ **无 mdast 格式 AST 输出，使用 Token 数组** |
| **CORD 适配性** | 🔴 低 — 面向 HTML 渲染设计，缺少结构化 AST，不适合文档关系分析 |

_Source: [https://github.com/markdown-it/markdown-it](https://github.com/markdown-it/markdown-it)_

### marked

| 维度 | 数据 |
|------|------|
| 定位 | 轻量级 Markdown 编译器（Markdown → HTML） |
| 最新版本 | v17.0.5（2026-03-20） |
| GitHub Stars | 36,700+ |
| 设计哲学 | 极致速度和最小体积 |
| TypeScript | JavaScript 35.4% + TypeScript 35.4% |
| **AST 访问** | ⚠️ **Token 列表，非标准 AST 格式** |
| **CORD 适配性** | 🔴 低 — 面向编译输出设计，缺少 AST 操作能力 |

_Source: [https://github.com/markedjs/marked](https://github.com/markedjs/marked)_

## 技术栈对比总结（CORD 视角）

| 评估维度 | remark/unified.js | markdown-it | marked |
|----------|-------------------|-------------|--------|
| **标准 AST 输出** | ✅ mdast 标准规范 | ❌ Token 数组 | ❌ Token 列表 |
| **AST 遍历/修改** | ✅ unist-util-visit | ❌ 需自行实现 | ❌ 需自行实现 |
| **插件生态** | ✅ 150+ 插件 | 🟡 社区插件 | 🟡 有限 |
| **Frontmatter** | ✅ remark-frontmatter | 🟡 需插件 | 🟡 需插件 |
| **TypeScript** | ✅ @types/mdast | 🟡 部分 | 🟡 混合 |
| **位置信息** | ✅ 精确到字节 | 🟡 行级 | ❌ 有限 |
| **流式处理** | ✅ micromark 支持 | ❌ 不支持 | ❌ 不支持 |
| **社区规模** | ✅ 54 亿月下载 | 🟡 大 | 🟡 大 |
| **CORD 适配** | ✅ **最优选择** | ❌ 不适合 | ❌ 不适合 |

## 关键发现

1. **remark/unified.js 是 CORD 文档解析引擎的唯一合理选择** — 它是 Node.js 生态中唯一提供标准化 AST（mdast）+ 完整遍历工具 + 丰富插件生态的方案
2. **markdown-it 和 marked 面向 HTML 渲染设计** — 它们输出 Token 而非 AST，不适合 CORD 需要的"文档结构分析 → 关系发现"工作流
3. **micromark 底层引擎提供了坚实基础** — 14kb 体积、状态机架构、精确位置追踪，为上层 remark 提供了性能和可靠性保证
4. **mdast 节点类型系统直接映射 CORD 需求** — Heading（章节锚点）、Link/LinkReference（关系发现）、Definition（引用解析）等节点类型与 CORD 的文档关系模型高度契合

## unified.js 处理管线架构（CORD 适配）

```
Input Markdown
     │
     ▼
┌─────────────┐
│ remark-parse │  ← Phase 1: Parse（Markdown → mdast AST）
│ (micromark)  │     底层使用 micromark 状态机
└──────┬──────┘
       │ mdast 语法树
       ▼
┌──────────────────┐
│ Plugin Pipeline  │  ← Phase 2: Run（AST 转换）
│ • frontmatter    │     remark-frontmatter → 元数据提取
│ • heading-anchor │     自定义插件 → 章节锚点
│ • link-extract   │     自定义插件 → 关系发现
│ • cord-annotate  │     自定义插件 → CORD 元数据注入
└──────┬──────────┘
       │ 转换后的 AST + 提取的数据
       ▼
┌─────────────────┐
│ CORD Relation DB │  ← Phase 3: 输出到 SQLite
│ (SQLite)         │     存储文档结构 + 关系数据
└─────────────────┘
```
