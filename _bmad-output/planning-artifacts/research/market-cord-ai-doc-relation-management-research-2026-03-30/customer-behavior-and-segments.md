# Customer Behavior and Segments

## 客户行为模式

CORD 的目标用户处于一个正在快速演变的行为转型期——从「人类写代码 + 手动维护文档」模式向「AI Agent 协作编码 + 自动化文档管理」模式迁移。

**行为驱动因素：**

- **AI 编码工具的爆发式普及**：GitHub Copilot 在 2025 年已拥有超过 1500 万开发者用户，企业付费用户超过 77,000 家。Cursor 作为 AI-native IDE 自 2024 年起迅速增长，估值突破 100 亿美元。Claude Code 作为 Anthropic 的 agentic coding 工具在 2025 年推出后快速获得技术先驱用户群体。这些工具正在重塑开发者的日常工作流。
- **文档维护行为的根本性变化**：当 AI Agent 能自动生成和修改代码时，配套的项目文档（PRD、架构文档、API 文档等）更新频率剧增，但关联文档的同步更新成为被遗漏的「最后一公里」。
- **Context Window 管理焦虑**：开发者在使用 AI 编码时，核心痛点之一是「如何让 AI 获取正确且完整的上下文」。文档间的关联关系如果不能被精确提供，AI 要么生成错误代码，要么浪费 token 加载无关内容。

_行为转变信号：开发者正从「搜索文档」模式转向「让 AI 自动加载相关文档」模式——这要求底层必须有可靠的文档关系图谱支撑。_

_Source: [GitHub Blog - Copilot Statistics](https://github.blog/news-insights/), [JetBrains Developer Ecosystem Survey 2025](https://www.jetbrains.com/lp/devecosystem-2025/), [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/)_

## 人口统计细分

CORD 的潜在用户群体可按以下维度进行细分：

**按角色分层：**

| 细分群体 | 规模估计 | 特征 | CORD 相关度 |
|----------|----------|------|------------|
| **AI Coding 深度用户（Tech Lead / Staff Engineer）** | ~200 万（全球） | 日常使用 AI 编码工具 4h+，管理多人项目，对文档一致性有强烈需求 | ⭐⭐⭐⭐⭐ |
| **AI Coding 框架使用者（BMAD/Superpowers/GSD 用户）** | ~5-20 万 | 使用结构化 AI 编码框架，产出大量框架文档，关联关系最复杂 | ⭐⭐⭐⭐⭐ |
| **Solo 开发者 / 独立开发者** | ~500 万 | 高度依赖 AI 编码，项目文档量中等，需要轻量级方案 | ⭐⭐⭐⭐ |
| **中小型团队开发者（2-20 人）** | ~800 万 | 团队协作场景，文档同步问题更突出，但工具选型谨慎 | ⭐⭐⭐⭐ |
| **企业开发团队** | ~1500 万 | 有现成的文档管理工具（Confluence/Notion），但缺乏 AI 编码场景的文档关系管理 | ⭐⭐⭐ |

_规模估计置信度：中等。基于全球开发者总量约 3000 万（GitHub/Stack Overflow 数据）、AI 编码工具渗透率约 40-60%（JetBrains 2025 调查）推算。_

_Source: [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/), [JetBrains Dev Ecosystem 2025](https://www.jetbrains.com/lp/devecosystem-2025/)_

## 心理画像

CORD 的核心目标用户呈现出以下心理特征：

**价值观与信念：**
- **「确定性优于推理性」信仰者**：相信 AI 编码的可靠性取决于输入上下文的准确性，而非 LLM 的推理能力。这与 CORD 的第一性原理高度契合。
- **工程卓越主义者**：追求系统化、可复现的开发流程，不满足于「差不多能用」的手工方案。
- **效率至上型**：对重复性劳动（手动检查文档一致性）有天然的「自动化冲动」。

**生活方式偏好：**
- 倾向于使用终端/CLI 工具而非 GUI
- 偏好本地优先（local-first）的工具，对云端依赖持谨慎态度
- 活跃于开源社区（GitHub、Discord），通过口碑而非广告发现工具
- 习惯「先试后买」（Try before Buy），免费/开源 → 付费增值的转化路径

**态度与立场：**
- 对现有文档管理工具（Confluence/Notion）在 AI 编码场景的适用性持批评态度——「它们是给人用的，不是给 AI Agent 用的」
- 对「又一个需要学习的工具」有天然抵触——CORD 必须证明其价值大于学习成本
- 对供应商锁定（vendor lock-in）高度敏感——开源、标准协议是信任的基础

_Source: [Stack Overflow Developer Survey 2025 - Developer Profiles](https://survey.stackoverflow.co/2025/), [Developer Nation State of Developers Report](https://www.developernation.net/)_

## 客户细分画像

**🎯 细分 1：AI 编码框架重度用户（Persona: "方法论布道者"）**

| 维度 | 描述 |
|------|------|
| **人口特征** | 高级工程师/技术负责人，5-15 年经验，月收入 $8K-20K |
| **心理特征** | 追求系统化的开发方法论，热衷于探索和推广最佳实践 |
| **行为模式** | 使用 BMAD-Method / Superpowers / GSD 等框架，每个项目产出 20-50 份结构化文档 |
| **核心痛点** | 框架产出文档之间的关联关系极其复杂，手动维护成本高，AI Agent 经常遗漏关联更新 |
| **CORD 价值** | **最高**——直接解决其核心痛点，是框架生态的「缺失拼图」 |
| **规模** | ~5-20 万人（全球） |

**🎯 细分 2：AI-Native 项目负责人（Persona: "效率猎手"）**

| 维度 | 描述 |
|------|------|
| **人口特征** | 中高级工程师/Tech Lead，3-10 年经验，管理 2-10 人团队 |
| **心理特征** | 效率驱动，对任何能减少「AI 上下文污染」的工具高度敏感 |
| **行为模式** | 日均使用 AI 编码 4h+，通过 CLAUDE.md / .cursorrules 管理 AI 上下文，定期手动检查文档一致性 |
| **核心痛点** | AI Agent 基于过时文档生成错误代码，排错成本高；手动维护 CLAUDE.md 中的文档引用关系效率低 |
| **CORD 价值** | **高**——自动化文档关系追踪，消除「AI 上下文污染」的根源 |
| **规模** | ~100-200 万人（全球） |

**🎯 细分 3：开源工具链爱好者（Persona: "工具匠人"）**

| 维度 | 描述 |
|------|------|
| **人口特征** | 独立开发者或小团队成员，2-8 年经验，技术好奇心强 |
| **心理特征** | 热衷于发现和组合开源工具，构建自己的「完美工具链」 |
| **行为模式** | 频繁尝试新工具，在 GitHub Star / Product Hunt 等渠道发现工具，贡献开源社区 |
| **核心痛点** | 项目文档散落在多处（README、docs/、_bmad-output/ 等），缺乏全局视图和关系追踪 |
| **CORD 价值** | **中高**——提供全局文档关系鸟瞰图，满足其「掌控全局」的心理需求 |
| **规模** | ~300-500 万人（全球） |

_Source: [GitHub Developer Survey](https://github.blog/news-insights/), [SlashData Developer Economics](https://www.slashdata.co/)_

## 行为驱动力与影响因素

**情感驱动：**
- 😤 **挫败感**：AI Agent 因过时文档产出错误代码时的强烈挫败感——「明明文档就在那里，为什么 AI 不知道它已经过时了？」
- 😰 **焦虑感**：大型项目中「不知道改了这个文档会影响哪些其他文档」的不确定性焦虑
- 🎯 **掌控感**：拥有清晰的文档关系全景图带来的安全感和掌控感

**理性驱动：**
- ⏱️ **时间成本**：开发者平均花费 15-30% 的工作时间在文档相关活动上，其中大量时间用于「检查文档是否还是最新的」
- 💰 **错误成本**：基于过时文档的 AI 代码生成导致的返工成本——估计每次事件浪费 1-4 小时
- 📈 **效率收益**：可量化的自动化收益——减少手动检查时间，提升 AI 编码准确率

**社会影响：**
- 👥 团队中「文档管理最认真的人」往往是 CORD 的潜在冠军用户（Champion User）
- 🌐 AI Coding 社区（Discord/Twitter/Reddit）中关于「上下文管理」的讨论热度持续上升
- 📢 开源项目的 Star 数和社区活跃度是此类工具最重要的社会证明

_Source: [Zeroheight State of Documentation 2025](https://zeroheight.com/), [SmartBear State of Software Quality Report](https://smartbear.com/)_

## 客户交互模式

**发现与调研：**
- 🔍 主要通过 GitHub Trending、Hacker News、Reddit r/programming、Twitter/X 开发者社区发现工具
- 📖 重视 README.md 和文档质量——「如果这个工具自己的文档都写不好，怎么帮我管理文档？」
- 🎬 技术博客和 YouTube demo 视频是重要的决策参考

**采购决策过程：**
1. **发现**（1-3 天）：社区推荐 → 浏览 GitHub Repo → 阅读 README
2. **试用**（1-7 天）：`npm install` → 在个人项目中试用 → 评估学习成本
3. **验证**（1-2 周）：在实际项目中使用 → 是否真正减少了文档维护成本？
4. **推广**（2-4 周）：在团队中推广 → 评估团队采纳意愿 → 决定是否标准化

**购后行为：**
- ⭐ 满意用户会在 GitHub Star + 社区分享使用体验
- 🐛 早期用户会积极提交 Issue 和 PR，帮助完善产品
- 📢 核心用户会成为社区布道者，在技术博客/会议中分享

**忠诚度驱动：**
- 🔓 开源 + 标准协议是长期信任的基础
- 🚀 持续的功能迭代和社区响应速度
- 🤝 与主流 AI Coding 工具（Claude Code、Cursor、Copilot）的深度集成

_Source: [Product Hunt Developer Tools Category](https://www.producthunt.com/), [GitHub Community Insights](https://github.blog/)_

---
