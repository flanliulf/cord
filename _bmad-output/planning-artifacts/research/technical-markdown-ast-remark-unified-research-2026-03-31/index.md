# CORD 文档解析引擎技术选型：remark / unified.js 生态深度评估

## Table of Contents

- [CORD 文档解析引擎技术选型：remark / unified.js 生态深度评估](#table-of-contents)
  - [stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Markdown AST 解析生态（remark / unified.js）技术评估'
research_goals: 'frontmatter 解析、章节/段落级锚点提取、增量解析能力、非标准 Markdown 容错性、性能基准测试、TypeScript 类型支持、自定义插件开发体验；以 remark/unified.js 为主，简要对比替代方案'
user_name: 'Fancyliu'
date: '2026-03-31'
web_research_enabled: true
source_verification: true](#stepscompleted-1-2-3-4-5-6-inputdocuments-workflowtype-research-laststep-6-researchtype-technical-researchtopic-markdown-ast-解析生态remark-unifiedjs技术评估-researchgoals-frontmatter-解析章节段落级锚点提取增量解析能力非标准-markdown-容错性性能基准测试typescript-类型支持自定义插件开发体验以-remarkunifiedjs-为主简要对比替代方案-username-fancyliu-date-2026-03-31-webresearchenabled-true-sourceverification-true)
  - [Research Overview](./research-overview.md)
  - [Technical Research Scope Confirmation](./technical-research-scope-confirmation.md)
  - [Technology Stack Analysis](./technology-stack-analysis.md)
    - [核心技术生态：unified.js 平台](./technology-stack-analysis.md#核心技术生态unifiedjs-平台)
    - [remark：Markdown 处理核心](./technology-stack-analysis.md#remarkmarkdown-处理核心)
    - [micromark：底层解析引擎](./technology-stack-analysis.md#micromark底层解析引擎)
    - [mdast：Markdown 抽象语法树规范](./technology-stack-analysis.md#mdastmarkdown-抽象语法树规范)
    - [替代方案简要对比](./technology-stack-analysis.md#替代方案简要对比)
      - [markdown-it](./technology-stack-analysis.md#markdown-it)
      - [marked](./technology-stack-analysis.md#marked)
    - [技术栈对比总结（CORD 视角）](./technology-stack-analysis.md#技术栈对比总结cord-视角)
    - [关键发现](./technology-stack-analysis.md#关键发现)
    - [unified.js 处理管线架构（CORD 适配）](./technology-stack-analysis.md#unifiedjs-处理管线架构cord-适配)
  - [Integration Patterns Analysis](./integration-patterns-analysis.md)
    - [unified.js 处理管线接口模型](./integration-patterns-analysis.md#unifiedjs-处理管线接口模型)
    - [VFile：虚拟文件数据交换格式](./integration-patterns-analysis.md#vfile虚拟文件数据交换格式)
    - [Frontmatter 集成接口](./integration-patterns-analysis.md#frontmatter-集成接口)
    - [GFM 扩展集成](./integration-patterns-analysis.md#gfm-扩展集成)
    - [自定义指令集成（remark-directive）](./integration-patterns-analysis.md#自定义指令集成remark-directive)
    - [AST 遍历与操作接口](./integration-patterns-analysis.md#ast-遍历与操作接口)
    - [mdast-util-from-markdown：低层级集成接口](./integration-patterns-analysis.md#mdast-util-from-markdown低层级集成接口)
    - [CORD 集成架构总览](./integration-patterns-analysis.md#cord-集成架构总览)
    - [集成模式关键发现](./integration-patterns-analysis.md#集成模式关键发现)
  - [Architectural Patterns and Design](./architectural-patterns-and-design.md)
    - [维度 1：Frontmatter 解析](./architectural-patterns-and-design.md#维度-1frontmatter-解析)
    - [维度 2：章节/段落级锚点提取](./architectural-patterns-and-design.md#维度-2章节段落级锚点提取)
    - [维度 3：增量解析能力](./architectural-patterns-and-design.md#维度-3增量解析能力)
    - [维度 4：非标准 Markdown 容错性](./architectural-patterns-and-design.md#维度-4非标准-markdown-容错性)
    - [维度 5：性能基准测试](./architectural-patterns-and-design.md#维度-5性能基准测试)
    - [维度 6：TypeScript 类型支持](./architectural-patterns-and-design.md#维度-6typescript-类型支持)
    - [维度 7：自定义插件开发体验（DX）](./architectural-patterns-and-design.md#维度-7自定义插件开发体验dx)
    - [架构模式关键发现总结](./architectural-patterns-and-design.md#架构模式关键发现总结)
  - [Implementation Approaches and Technology Adoption](./implementation-approaches-and-technology-adoption.md)
    - [CORD Markdown 解析引擎 — npm 依赖清单](./implementation-approaches-and-technology-adoption.md#cord-markdown-解析引擎-npm-依赖清单)
      - [核心依赖（必须）](./implementation-approaches-and-technology-adoption.md#核心依赖必须)
      - [推荐依赖（按需引入）](./implementation-approaches-and-technology-adoption.md#推荐依赖按需引入)
      - [开发依赖](./implementation-approaches-and-technology-adoption.md#开发依赖)
    - [ESM 兼容性与项目配置](./implementation-approaches-and-technology-adoption.md#esm-兼容性与项目配置)
    - [CORD 自定义插件实现路径](./implementation-approaches-and-technology-adoption.md#cord-自定义插件实现路径)
      - [插件 1：cord-heading-extractor（复杂度 🟢 低）](./implementation-approaches-and-technology-adoption.md#插件-1cord-heading-extractor复杂度-低)
      - [插件 2：cord-link-extractor（复杂度 🟢 低）](./implementation-approaches-and-technology-adoption.md#插件-2cord-link-extractor复杂度-低)
      - [插件 3：cord-frontmatter-parser（复杂度 🟢 低）](./implementation-approaches-and-technology-adoption.md#插件-3cord-frontmatter-parser复杂度-低)
    - [CORD 文档处理器组装](./implementation-approaches-and-technology-adoption.md#cord-文档处理器组装)
    - [测试策略](./implementation-approaches-and-technology-adoption.md#测试策略)
    - [风险评估与缓解](./implementation-approaches-and-technology-adoption.md#风险评估与缓解)
    - [实现路线图（与 CORD MVP Phase 对齐）](./implementation-approaches-and-technology-adoption.md#实现路线图与-cord-mvp-phase-对齐)
  - [Technical Research Recommendations](./technical-research-recommendations.md)
    - [技术选型结论](./technical-research-recommendations.md#技术选型结论)
    - [核心依赖版本锁定建议](./technical-research-recommendations.md#核心依赖版本锁定建议)
    - [待验证事项（MVP 阶段）](./technical-research-recommendations.md#待验证事项mvp-阶段)
  - [Research Synthesis: 综合结论与决策框架](./research-synthesis-综合结论与决策框架.md)
    - [Executive Summary](./research-synthesis-综合结论与决策框架.md#executive-summary)
    - [Table of Contents](./research-synthesis-综合结论与决策框架.md#table-of-contents)
    - [研究目标达成度](./research-synthesis-综合结论与决策框架.md#研究目标达成度)
    - [关键技术决策记录](./research-synthesis-综合结论与决策框架.md#关键技术决策记录)
    - [CORD 文档解析引擎完整依赖图](./research-synthesis-综合结论与决策框架.md#cord-文档解析引擎完整依赖图)
    - [研究质量声明](./research-synthesis-综合结论与决策框架.md#研究质量声明)
