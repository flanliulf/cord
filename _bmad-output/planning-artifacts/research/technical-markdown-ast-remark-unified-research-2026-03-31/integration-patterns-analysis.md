# Integration Patterns Analysis

## unified.js 处理管线接口模型

unified 的核心集成模式是 **三阶段管线**：Parse → Run → Stringify，通过 `.use()` 链式注册插件，`.process()` 统一执行。

```typescript
// CORD 集成的核心管线接口
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'

const processor = unified()
  .use(remarkParse)                    // Phase 1: Markdown → mdast
  .use(remarkFrontmatter, ['yaml'])    // 扩展: frontmatter 识别
  .use(remarkGfm)                      // 扩展: GFM 支持
  .use(cordHeadingExtractor)           // 自定义: 章节锚点提取
  .use(cordLinkExtractor)              // 自定义: 文档关系发现
  .use(cordMetadataAnnotator)          // 自定义: CORD 元数据注入

const tree = processor.parse(markdownContent)   // 仅解析，返回 mdast
const result = await processor.run(tree)        // 运行插件管线
```

**关键接口特征：**
- 插件顺序敏感 — remark 插件在 mdast 树上操作，必须在 remark-rehype 之前注册
- `.parse()` 和 `.run()` 可分离调用 — CORD 只需 AST，不需要 stringify 阶段
- 每个插件接收 `(tree, file)` 参数，可直接修改 AST 或在 `file.data` 上附加数据

_Source: [https://unifiedjs.com/learn/guide/using-unified/](https://unifiedjs.com/learn/guide/using-unified/)_

## VFile：虚拟文件数据交换格式

VFile 是 unified 生态的文件抽象层，CORD 通过它实现与 unified 管线的数据交换。

**核心属性（CORD 关注）：**

| 属性 | 类型 | CORD 用途 |
|------|------|----------|
| `path` | string | 文档在项目中的路径（关系索引键） |
| `value` | string \| Uint8Array | Markdown 原始内容 |
| `data` | Record<string, unknown> | **CORD 元数据存储点** — frontmatter、锚点、关系等 |
| `messages` | VFileMessage[] | 解析警告/错误收集（容错性指标） |
| `basename` | string | 文件名（不含路径） |
| `stem` | string | 文件名（不含扩展名） |
| `history` | string[] | 文件路径变更历史 |

**消息等级系统：**
- `file.fail()` — 致命错误（文件不可用）
- `file.message()` — 警告（可能需要关注）
- `file.info()` — 信息提示

**与文件系统的集成：**
```typescript
import { read } from 'to-vfile'

// 从文件系统读取为 VFile
const file = await read('docs/architecture.md', 'utf8')
// file.path = 'docs/architecture.md'
// file.value = '# Architecture\n...'

// 处理后，CORD 提取的数据在 file.data 中
await processor.process(file)
// file.data.matter = { title: 'Architecture', tags: [...] }
// file.data.cordHeadings = [{ depth: 1, text: 'Architecture', position: {...} }]
// file.data.cordLinks = [{ url: './api-design.md', position: {...} }]
```

_Source: [https://github.com/vfile/vfile](https://github.com/vfile/vfile), [https://github.com/vfile/to-vfile](https://github.com/vfile/to-vfile)_

## Frontmatter 集成接口

CORD 的 frontmatter 处理分两层：**识别**（remark-frontmatter）和 **解析**（vfile-matter）。

**Layer 1 — 语法识别（remark-frontmatter）：**
- 将 `---` 围栏内容识别为 YAML 节点
- 支持 YAML（`---`）和 TOML（`+++`）以及自定义格式
- 产出 AST 节点但**不解析内部数据**
- 配置灵活：`['yaml']`、`['yaml', 'toml']` 或自定义 `{ type, marker, fence }`

**Layer 2 — 数据提取（vfile-matter）：**
```typescript
import { matter } from 'vfile-matter'

function cordFrontmatterPlugin() {
  return (tree, file) => {
    matter(file)
    // 解析后的数据在 file.data.matter 中
    // { title: '...', tags: [...], relations: [...] }
  }
}
```

**自定义 frontmatter 格式支持：**
```typescript
// CORD 可定义自定义 frontmatter 格式
remarkFrontmatter({
  type: 'yaml',
  marker: '-'           // 标准 YAML: ---
})

// 甚至支持非对称标记
remarkFrontmatter({
  type: 'custom',
  marker: { open: '<', close: '>' }
})
```

**CORD 集成要点：**
- frontmatter 默认仅在文档**开头**有效（`anywhere: false`）
- 转 HTML 时 frontmatter 会被剥离（CORD 无需关心，不做 HTML 转换）
- Node.js 16+，ESM only（无 CommonJS）

_Source: [https://github.com/remarkjs/remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)_

## GFM 扩展集成

remark-gfm 为 CORD 提供 GitHub Flavored Markdown 的完整支持，这对分析 GitHub 生态的文档至关重要。

**扩展的 mdast 节点类型：**

| GFM 特性 | mdast 节点 | CORD 用途 |
|----------|-----------|----------|
| 表格 | `table`, `tableRow`, `tableCell` | 结构化数据提取 |
| 任务列表 | `listItem.checked` | 状态追踪 |
| 删除线 | `delete` | 变更标记识别 |
| 自动链接 | 自动转为 `link` 节点 | 隐式关系发现 |
| 脚注 | `footnoteDefinition`, `footnoteReference` | 引用关系 |

_Source: [https://github.com/remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm)_

## 自定义指令集成（remark-directive）

remark-directive 为 CORD 开辟了**自定义语法扩展**的可能性。

**三种指令类型：**
```markdown
:cord-ref[目标文档]{type=depends-on}          ← 文本指令（行内）
::cord-anchor{id=section-1}                   ← 叶指令（块级，无内容）
:::cord-context                               ← 容器指令（块级，有内容）
这段内容的上下文关系...
:::
```

**集成模式：**
```typescript
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'

function cordDirectivePlugin() {
  return (tree) => {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], (node) => {
      if (node.name === 'cord-ref') {
        // 提取 CORD 显式关系声明
        const target = node.children?.[0]?.value  // 目标文档
        const relType = node.attributes?.type      // 关系类型
        // → 存入 CORD 关系数据库
      }
    })
  }
}
```

_Source: [https://github.com/remarkjs/remark-directive](https://github.com/remarkjs/remark-directive)_

## AST 遍历与操作接口

unist-util-visit 是 CORD 自定义插件的核心工具。

**API 签名：**
```typescript
visit(tree, test?, visitor, reverse?)
```

**Visitor 函数签名：**
```typescript
function visitor(
  node: Node,           // 当前节点
  index: number | undefined,  // 在 parent.children 中的位置
  parent: Parent | undefined  // 父节点
): VisitorResult
```

**控制指令：**
- `CONTINUE`（`true`）— 继续遍历
- `SKIP`（`'skip'`）— 跳过当前节点的子节点
- `EXIT`（`false`）— 立即终止遍历

**CORD 典型用法 — 章节锚点提取：**
```typescript
import { visit } from 'unist-util-visit'
import type { Heading, Root } from 'mdast'

function cordHeadingExtractor() {
  return (tree: Root, file: VFile) => {
    const headings: CordHeading[] = []

    visit(tree, 'heading', (node: Heading) => {
      headings.push({
        depth: node.depth,           // 1-6
        text: toString(node),         // 提取文本内容
        position: node.position,      // { start: { line, column, offset }, end: {...} }
      })
    })

    file.data.cordHeadings = headings
  }
}
```

**CORD 典型用法 — 文档关系发现：**
```typescript
function cordLinkExtractor() {
  return (tree: Root, file: VFile) => {
    const links: CordRelation[] = []

    visit(tree, ['link', 'linkReference', 'definition'], (node) => {
      if (node.type === 'link' && isRelativeMarkdownLink(node.url)) {
        links.push({
          source: file.path,
          target: resolveRelativePath(file.path, node.url),
          type: 'references',
          position: node.position,
        })
      }
    })

    file.data.cordLinks = links
  }
}
```

_Source: [https://github.com/syntax-tree/unist-util-visit](https://github.com/syntax-tree/unist-util-visit)_

## mdast-util-from-markdown：低层级集成接口

当需要绕过 unified 管线直接解析时，可使用 `mdast-util-from-markdown`。

```typescript
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfm } from 'micromark-extension-gfm'

const tree = fromMarkdown(markdownContent, {
  extensions: [frontmatter(['yaml']), gfm()],           // micromark 语法扩展
  mdastExtensions: [frontmatterFromMarkdown(['yaml']), gfmFromMarkdown()],  // mdast 节点映射
})
```

**何时使用低层级 vs 高层级：**

| 场景 | 推荐接口 | 原因 |
|------|---------|------|
| 完整文档处理管线 | `unified().use(remarkParse)` | 插件编排、VFile 支持 |
| 简单的一次性解析 | `fromMarkdown()` | 更轻量，无 unified 开销 |
| 性能关键路径 | `fromMarkdown()` | 避免 unified 管线初始化 |
| 批量文件处理 | `unified().use(remarkParse)` | 处理器可复用 |

_Source: [https://github.com/syntax-tree/mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown)_

## CORD 集成架构总览

```
┌─────────────────────────────────────────────────────┐
│                   CORD MCP Server                    │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │ File Watcher │───→│  unified Pipeline         │   │
│  │ (chokidar)   │    │                           │   │
│  └──────────────┘    │  remark-parse             │   │
│                      │  ├── remark-frontmatter   │   │
│  ┌──────────────┐    │  ├── remark-gfm           │   │
│  │ CLI Commands │───→│  ├── cord-heading-plugin  │   │
│  │ (commander)  │    │  ├── cord-link-plugin     │   │
│  └──────────────┘    │  └── cord-annotate-plugin │   │
│                      └───────────┬───────────────┘   │
│  ┌──────────────┐                │ VFile.data         │
│  │ MCP Tools    │───→            ▼                    │
│  │ (SDK v1.x)   │    ┌──────────────────────────┐   │
│  └──────────────┘    │  CORD Data Layer          │   │
│                      │  ├── Document Registry    │   │
│                      │  ├── Relation Store       │   │
│                      │  └── Anchor Index         │   │
│                      └───────────┬───────────────┘   │
│                                  │                    │
│                      ┌───────────▼───────────────┐   │
│                      │  SQLite (better-sqlite3)  │   │
│                      └───────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 集成模式关键发现

1. **unified 管线天然适配 CORD 的"解析 → 提取 → 存储"工作流** — Parse + Run 两阶段即可满足，无需 Stringify
2. **VFile.data 是 CORD 插件间的数据总线** — frontmatter、headings、links 等提取结果都通过 `file.data` 传递
3. **remark-frontmatter + vfile-matter 的两层设计** 精确匹配 CORD 需求：语法识别与数据解析分离，支持自定义格式
4. **remark-directive 为未来的 CORD 自定义语法预留了扩展空间** — 可定义 `:cord-ref[target]{type=...}` 等显式关系声明语法
5. **unist-util-visit 的 Visitor 模式** 使 CORD 插件开发直观高效 — 按节点类型过滤 + 位置信息 + 父节点访问
6. **to-vfile 提供文件系统桥接** — CORD 的 File Watcher 检测变更后，通过 to-vfile 读取文件进入 unified 管线
7. **低层级接口（fromMarkdown）可用于性能优化** — 在批量扫描等性能关键路径中，绕过 unified 管线直接解析
