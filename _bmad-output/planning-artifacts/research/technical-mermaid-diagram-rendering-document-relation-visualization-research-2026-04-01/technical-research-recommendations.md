# Technical Research Recommendations

## 技术栈推荐汇总

| 类别 | 推荐 | 置信度 |
|------|------|--------|
| **图表引擎** | Mermaid.js v11.x | 🟢 高 |
| **核心图表类型** | Flowchart/Graph（主）+ Class Diagram（辅） | 🟢 高 |
| **默认布局引擎** | dagre（默认）+ elk（大图自动切换） | 🟢 高 |
| **默认输出格式** | Mermaid DSL 文本（零依赖） | 🟢 高 |
| **可选渲染器** | @mermaid-js/mermaid-cli（optionalDep） | 🟢 高 |
| **DSL 生成模式** | Builder 模式（MermaidDSLBuilder） | 🟢 高 |
| **视图策略** | 策略模式（Global/Local/Path） | 🟢 高 |
| **大图降级** | 四级渐进降级（直接→折叠→过滤→分片） | 🟡 中（需实测调优阈值） |
| **缓存** | 三级缓存（查询/DSL/渲染） | 🟡 中（V4 实现） |
| **Markdown 嵌入** | 纯文本 ` ```mermaid ` 代码块 | 🟢 高 |
| **IDE 预览** | 依赖 IDE 原生/扩展支持 | 🟢 高 |

## 实现路线图总览

```
Phase V1 (3-4天)          Phase V2 (3-4天)
DSL 生成核心              视图策略引擎
MermaidDSLBuilder         ViewStrategyEngine
MermaidGenerator          Global/Local/Path
映射表 + 单元测试          降级策略 + 集成测试
        ↓                         ↓
              Phase V3 (2-3天)
              CLI + MCP 集成
              cord graph show/export
              graph.show/export MCP Tool
              VisualizationService
              E2E 测试
                      ↓
              Phase V4 (2-3天)
              降级 + 缓存 + 主题
              四级降级完整实现
              三级缓存系统
              预定义主题
```

**总工期估算：10-14 天**

## 后续研究衔接

- **TR9** (npm 分发)：mermaid-cli 作为 optionalDependencies 的 npm 分发策略
- **TR10** (BMAD 适配)：BMAD 文档产出（PRD → Epic → Story）的预设关系可视化规则

_Source: [Mermaid.js 官方文档](https://mermaid.js.org/)、[mermaid-cli GitHub](https://github.com/mermaid-js/mermaid-cli)、TR1-TR7 CORD 架构决策_

---
