# Epic List

## Epic 1：工程就绪——开发者可开始编写功能代码
开发团队拥有完整可用的工程骨架——TypeScript 项目结构、构建管道、测试框架、CI/CD、错误处理基础、日志系统均就绪，可以开始实际功能开发。
**FRs 覆盖：** 无直接 FR（基础设施层，支撑所有后续 Epic）
**NFRs 覆盖：** NFR3, NFR7-NFR10, NFR15, NFR19
**架构决策：** D1-D8, P1-P16

## Epic 2：文档扫描与关系图谱构建
用户可以运行 `cord scan` 对项目文档执行冷启动扫描，自动发现文档间的关系并建立关系图谱（SQLite 存储）。支持增量扫描、文档生命周期检测（重命名/移动/删除）、置信度评分。BMAD 框架用户开箱即用（18 种文档类型 + 预设规则），无框架用户通过通用规则引擎获得基础体验。
**FRs 覆盖：** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR24, FR25, FR27, FR33, FR34, FR35, FR36, FR38, FR39, FR40, FR41
**NFRs 覆盖：** NFR1, NFR5, NFR6, NFR8, NFR9, NFR15, NFR16, NFR18

## Epic 3：关系查询、影响分析与数据导出
用户可以通过 `cord query` 查询任意文档的关联关系（支持类型过滤、多跳遍历），通过 `cord impact` 获取文档变更的影响分析（受影响文档列表 + 传播行为类型 + 建议动作），通过 `cord export` 导出 JSON 快照，通过 `cord status` 查看图谱健康状态。
**FRs 覆盖：** FR5, FR13, FR14, FR15, FR16, FR17, FR26
**NFRs 覆盖：** NFR1, NFR2, NFR7, NFR13, NFR14

## Epic 4：关系管理与图谱修正
用户可以手动添加、移除或标记关系为 deprecated。系统记录关系来源和修改历史，增量扫描时保护手动修正（收敛机制），支持按文档类别配置更新策略。图谱准确度随使用自然收敛。
**FRs 覆盖：** FR18, FR19, FR21, FR22, FR23
**NFRs 覆盖：** NFR9

## Epic 5：AI IDE 集成（MCP Server + Hooks + 指令注入）
用户运行 `cord init` 即可一键完成 IDE 检测、框架检测、MCP Server 配置、Hooks 脚本安装和指令文件注入。AI Agent 可通过 MCP Server 自动调用 CORD 能力（影响分析、关系查询、图谱初始化、同步建议、关系管理）。文档变更落盘时自动触发关系检查。
**FRs 覆盖：** FR1, FR2, FR3, FR4, FR20, FR28, FR29, FR30, FR31, FR32
**NFRs 覆盖：** NFR4, NFR10, NFR11, NFR12, NFR13, NFR17

## Epic 6：社区贡献体验与文档交付
社区开发者可以基于完整的 IFrameworkAdapter 接口文档、BMAD 参考实现、集成测试模板和 PR 规范，在 4 小时内完成最小可用的框架适配模块。最终用户通过 README、快速开始指南、CLI/MCP/配置参考等完整文档获得自助式上手体验。
**FRs 覆盖：** FR37, FR42
**NFRs 覆盖：** NFR8

---
