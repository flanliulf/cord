# Technology Stack Analysis

## 核心图表渲染引擎：Mermaid.js

### 版本与生态概况

| 指标 | 数据 |
|------|------|
| **当前版本** | v11.13.0 |
| **许可证** | MIT |
| **语言** | JavaScript (ESM) |
| **图表类型数量** | 24 种 |
| **布局引擎** | 4 种（dagre、elk、tidy-tree、cose-bilkent） |
| **主题系统** | 内置多主题 + 自定义 CSS + themeVariables |

_Source: [Mermaid.js 官方文档](https://mermaid.js.org/intro/)_

### 支持的图表类型（与 CORD 文档关系场景的适用性评估）

| 图表类型 | CORD 适用性 | 理由 |
|---------|------------|------|
| **Flowchart / Graph** | ⭐⭐⭐⭐⭐ 核心 | 有向/无向图、subgraph 嵌套、30+ 节点形状、8 种边类型、5 种方向（TB/TD/BT/RL/LR）、click 交互事件 — **完美映射文档关系拓扑** |
| **Class Diagram** | ⭐⭐⭐⭐ 高 | 8 种关系类型（继承/组合/聚合/关联/依赖等）、cardinality 标注、namespace 分组 — **适合表达文档类型层次与依赖结构** |
| **Mindmap** | ⭐⭐⭐ 中 | 缩进层级、多形状节点、Markdown 格式化 — **适合单文档的关系上下文视图** |
| **Sankey** | ⭐⭐ 低-中 | 流量/权重可视化 — **可表达关系强度/引用频次** |
| **Architecture** | ⭐⭐ 低-中 | 系统设计布局 — **V2.0 可用于项目架构级视图** |
| **Block Diagram** | ⭐⭐ 低-中 | 组件块图 — 辅助用途 |
| **ER Diagram** | ⭐ 低 | 数据库 schema — 不适合文档关系场景 |
| **其余 17 种** | ⭐ 低 | Sequence/State/Gantt/Pie 等 — 与文档关系场景无直接关系 |

_Source: [Mermaid.js Intro](https://mermaid.js.org/intro/)_

### Flowchart 语法能力深度评估（CORD 核心图表类型）

| 能力维度 | 详情 | CORD 映射 |
|---------|------|----------|
| **节点形状** | 30+ 种（矩形、圆角、菱形、六边形、圆柱、云形、文档形等），支持新语法 `A@{ shape: rect }` | 文档类型区分（.md → 文档形，目录 → 文件夹形） |
| **边/连接类型** | 实线箭头 `-->`、虚线 `-.->` 、粗线 `==>`、无头 `---`、圆头 `-o`、叉头 `-x`、文字标签 `--\|text\|` | 关系类型映射（引用→实线、弱引用→虚线、双向→双箭头） |
| **方向控制** | TB/TD/BT/RL/LR 五种方向 | 可根据关系拓扑自适应选择方向 |
| **Subgraph** | 嵌套子图、独立方向控制、样式自定义 | 目录/模块分组、项目边界 |
| **样式系统** | `style` 单节点样式、`classDef` 复用类、CSS 集成、`linkStyle` 边样式 | 关系类型色彩编码、高亮路径 |
| **交互事件** | click 事件绑定（JS 回调 / URL 跳转）、tooltip 支持 | 点击节点跳转到文档（Web 端） |
| **链式声明** | 单行声明多条边 `A --> B --> C` | 简化关系链生成代码 |

_Source: [Mermaid Flowchart 语法文档](https://mermaid.js.org/syntax/flowchart.html)_

### 布局引擎对比

| 引擎 | 类型 | 适用场景 | CORD 推荐度 |
|------|------|---------|------------|
| **dagre** | 层次化布局 | 有向图、流程图、层级结构 — **默认引擎** | ⭐⭐⭐⭐ 推荐（中小规模） |
| **elk** (Eclipse Layout Kernel) | 高级层次化布局 | 复杂大规模图、可配置性强（节点放置策略、边合并、环路破解、模型顺序） | ⭐⭐⭐⭐⭐ 强烈推荐（大规模） |
| **cose-bilkent** | 力导向布局 | 无明确层级的网络关系图 | ⭐⭐⭐ 备选 |
| **tidy-tree** | 树形布局 | 纯层级结构（如 Mindmap） | ⭐⭐ 特定场景 |

_Source: [Mermaid Layouts 文档](https://mermaid.js.org/config/layouts.html)_

### 配置与安全

| 配置项 | 说明 | CORD 相关度 |
|-------|------|-----------|
| `maxEdges` | 限制图表边数上限 | 🔴 关键 — 大规模关系图必须配置 |
| `maxTextSize` | 限制文本渲染大小 | 🟡 重要 — 长文档名需注意 |
| `securityLevel` | 沙箱安全级别 | 🟢 CLI 渲染可设为 loose |
| `deterministicIds` | 确定性 ID 生成 | 🟡 增量渲染缓存友好 |
| `theme` / `themeVariables` | 主题与自定义变量 | 🟡 品牌化输出 |
| `htmlLabels` | HTML 标签支持 | 🟡 富文本节点标签 |

_Source: [Mermaid Configuration 文档](https://mermaid.js.org/config/configuration.html)_

## CLI 端渲染方案：@mermaid-js/mermaid-cli

| 指标 | 数据 |
|------|------|
| **命令** | `mmdc` |
| **安装方式** | npm (全局/本地)、npx、Docker |
| **输出格式** | SVG、PNG、PDF |
| **Markdown 处理** | 自动发现 mermaid 代码块 → 生成图片 → 更新引用 |
| **编程 API** | `import { run } from "@mermaid-js/mermaid-cli"` |
| **自定义配置** | `--configFile` JSON 配置、`--cssFile` 自定义样式 |
| **主题切换** | `-t dark/light` |
| **背景色** | `-b transparent` / hex |
| **stdin 支持** | `-i -` 管道输入 |

_Source: [mermaid-cli GitHub](https://github.com/mermaid-js/mermaid-cli)_

**⚠️ 关键约束**：mermaid-cli 底层依赖 **Puppeteer**（Headless Chrome），这意味着：
- 安装体积较大（需下载 Chromium）
- 首次渲染冷启动较慢
- 但渲染质量与浏览器一致，支持所有 Mermaid 特性

## 编程 API：mermaid.render()

```javascript
// Node.js 端 Mermaid 编程式渲染
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

// 核心渲染方法
const { svg, bindFunctions } = await mermaid.render('diagramId', diagramDefinition);

// 语法验证
const isValid = await mermaid.parse(diagramDefinition);

// 图表类型检测
const type = mermaid.detectType(diagramDefinition);
```

_Source: [Mermaid Usage 文档](https://mermaid.js.org/config/usage.html)_

**⚠️ 关键约束**：`mermaid.render()` 依赖 DOM 环境，Node.js 原生无 DOM。解决方案：
1. **mermaid-cli**（Puppeteer 提供真实浏览器环境）— 推荐
2. **jsdom / happy-dom** 模拟 DOM — 部分功能可能不完整
3. **@mermaid-js/mermaid-zenuml** 等子包 — 特定图表类型

## 竞品技术对比

### Mermaid.js vs Graphviz vs Cytoscape.js vs D3.js

| 维度 | Mermaid.js | Graphviz (DOT) | Cytoscape.js | D3.js |
|------|-----------|---------------|-------------|-------|
| **定位** | 文本到图表 | 图布局引擎 | 图论分析库 | 通用可视化 |
| **语法** | 自有 DSL（Markdown 风格） | DOT 语言 | 编程 API | 编程 API |
| **学习曲线** | 🟢 低 | 🟡 中 | 🟡 中 | 🔴 高 |
| **图表类型** | 24 种通用图表 | 纯图/网络 | 纯图/网络 | 任意可视化 |
| **交互性** | 基础 click/tooltip | 无 | ⭐⭐⭐⭐⭐ 丰富 | ⭐⭐⭐⭐⭐ 丰富 |
| **CLI 渲染** | mmdc (Puppeteer) | dot 命令 (原生 C) | 需浏览器 | 需浏览器 |
| **Node.js 支持** | 需 DOM 模拟 | @hpcc-js/wasm (WASM) | 需 DOM 模拟 | 需 DOM 模拟 |
| **IDE 集成** | ⭐⭐⭐⭐⭐ 原生 Markdown 预览 | 🟡 需插件 | ❌ 无 | ❌ 无 |
| **Markdown 嵌入** | ✅ 原生 \`\`\`mermaid 代码块 | ❌ 需转换 | ❌ 不支持 | ❌ 不支持 |
| **大规模图性能** | 🟡 中（elk 引擎较好） | ⭐⭐⭐⭐⭐ 极佳（原生 C） | ⭐⭐⭐⭐ 好 | ⭐⭐⭐ 视实现 |
| **GitHub/GitLab 渲染** | ✅ 原生支持 | ❌ | ❌ | ❌ |
| **文件大小** | ~2MB (bundled) | WASM ~5MB | ~400KB | ~250KB |

### CORD 场景适用性结论

| 方案 | CORD 适用度 | 理由 |
|------|-----------|------|
| **Mermaid.js** | ⭐⭐⭐⭐⭐ **首选** | Markdown 原生嵌入、GitHub/GitLab 渲染、IDE 预览、文本 DSL 便于程序生成、24 种图表类型覆盖广 |
| **Graphviz** | ⭐⭐⭐ 备选/互补 | 大规模图布局性能优秀，DOT 语言表达力强，但无 Markdown 生态集成 |
| **Cytoscape.js** | ⭐⭐ 远期 | 交互式图分析能力强，适合 Web UI 场景，不适合 CLI/Markdown 输出 |
| **D3.js** | ⭐ 不推荐 | 过于底层，开发成本高，CORD 定位不需要自定义可视化 |

## IDE 生态集成

| IDE/平台 | Mermaid 支持 | 方式 |
|---------|-------------|------|
| **VS Code** | ✅ | Markdown Preview Mermaid Support 扩展（原生 Markdown 预览内集成） |
| **GitHub** | ✅ | 原生支持 \`\`\`mermaid 代码块渲染 |
| **GitLab** | ✅ | 原生支持 \`\`\`mermaid 代码块渲染 |
| **Obsidian** | ✅ | 原生支持 |
| **Notion** | ✅ | 原生支持 |
| **Cursor** | ✅ | 继承 VS Code Markdown 预览 + 扩展 |
| **JetBrains** | ✅ | Mermaid 插件 |
| **Typora** | ✅ | 原生支持 |

## 技术栈采用趋势

**Mermaid.js 的主导地位**：
- 2023-2026 年间，Mermaid 已成为**文本到图表**领域的事实标准
- GitHub/GitLab 原生集成大幅推动了采用率
- AI 代码助手（Claude/GPT/Copilot）天然支持 Mermaid 语法生成
- "Diagrams as Code" 运动中 Mermaid 是最广泛采用的方案

**竞品定位分化**：
- Graphviz：学术/专业图论领域仍是标杆，但开发者生态活跃度下降
- Cytoscape.js：生物信息学/网络分析领域的标准工具，通用 Web 开发较少使用
- D3.js：数据可视化领域不可替代，但图关系可视化不是其强项
- PlantUML：UML 领域仍有一席之地，但 Mermaid 正快速蚕食其市场份额

_Source: [Mermaid.js 官方文档](https://mermaid.js.org/)、[Cytoscape.js 官方文档](https://js.cytoscape.org/)、[mermaid-cli GitHub](https://github.com/mermaid-js/mermaid-cli)_
