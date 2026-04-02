Question:

1. 使用 claude code 提出的 agent skills ，还是使用 MCP 来实现存储合适？
2.  relation_type 非常重要，对于 A <-> B 的两个文档来说，两者之间的关联关系是多种多样的，以下是两种典型的场景，请深度思考，详细列出所有可能的潜在场景和文档relation_type：
2.1 比如 A 是API 总览文档， 其内容中的一个章节对应一个模块的 API 文档  B 作为第二级渐进式披露， 此时 A 的这个章节只会列举 B 中所有的 API 定义（API 的详细说明，路径，出入参等都在 B 文档中），那么当 B 增加 一个新的 API 接口定义时，需要在 A 文档中同步增加这个新的 API 定义的内容。
2.2 同 2.1 类似，另一种情况是当增加了一个新的业务模块，此时会创建新的 C 文档，那么要能感知到 C 文档也要被引入关联到 A 文档（同时列出 C 中所有的 API 定义）
3. 对于维护主体——谁来创建和更新链接？推荐AI 自动提议 + 人工确认（或静默写入 + 支持审计）
 ，→ 在 CLAUDE.md 中定义规则：每次文档变更后，AI 必须调用工具更新关系图。另外是否可以考虑接入 claude code 的 hooks 特性来当完成文档生成/修改时触发。
4. 对于关系数据的存储，默认使用 JSON 文件，同时支持 SQLite。JSON 是否意味着不需要引入 MCP？请给出这两者的设计

---

Answer:

这是一个非常深入且极具实践价值的系统设计思考。你提到的这些痛点和场景，正是构建高阶“AI 架构师”或“AI Tech Lead”所必须跨越的鸿沟。

针对你的四个问题，以下是深度的剖析与落地方案设计：

### 1\. Claude Code Agent Skills vs. MCP

选择哪种方式，核心在于你的**使用场景边界**和**技术栈的解耦程度**。

  * **Claude Code Agent Skills (自定义工具/脚本)**：
      * **优势**：轻量级，极速开发。直接在项目目录下写几个 Python 或 Node.js 脚本，通过 `CLAUDE.md` 或项目配置让 Claude Code 能够调用即可。与当前代码库深度绑定，权限管理简单。
      * **劣势**：属于“进程内”或“强耦合”调用，如果团队里有人用 Cursor、Windsurf 或其他支持 MCP 的客户端，这套系统无法直接复用。
  * **MCP (Model Context Protocol)**：
      * **优势**：真正的**标准化与解耦**。MCP 是以 Client-Server 架构运行的，它将你的“文档双链知识库”抽象成了一个独立的服务。无论是 Claude Code 还是别的 IDE，只要支持 MCP，插上就能用。
      * **劣势**：开发和部署成本稍高，需要启动一个独立的 Server 进程，并处理协议层的交互。

**建议**：
如果这是你或你们团队内部探索的第一个 MVP（最小可行性产品），**强烈建议先用 Claude Code 配合项目内的自定义脚本（Skills）来实现**。当你把关系类型、触发时机、提示词等业务逻辑跑通后，再将其重构为一个独立的 MCP Server，开源或供全公司复用。

-----

### 2\. relation\_type 的深度定义与场景推演

要让 AI 精准感知上下文，`relation_type`（边）必须具备**语义化**。你提到的 2.1 和 2.2 场景非常典型，属于“聚合与拆解”的关系。我们可以将其泛化，梳理出软件工程中 AI 需要感知的关系字典：

#### 核心 `relation_type` 字典表

| 关系类别 | 正向关系 (A -\> B) | 反向关系 (B -\> A) | 触发 AI 的核心行为 | 适用场景举例 |
| :--- | :--- | :--- | :--- | :--- |
| **聚合/索引** | `summarizes` (总结/收敛于) | `detailed_in` (详细说明于) | **级联更新**：当 B(细节) 增加/删除条目时，强制 AI 检查 A(总览) 是否需要同步更新。 | (如你的 2.1 场景) API 总览文档 vs 各模块详细 API 文档。 |
| **依赖/调用** | `depends_on` (依赖于) | `required_by` (被依赖于) | **影响分析**：修改 B(被依赖方) 时，提示 AI 评估对 A(依赖方) 的潜在破坏，并可能提示修改 A。 | 业务逻辑文档依赖底层的数据库 Schema 文档或通用 Util 文档。 |
| **实现/约束** | `implements` (实现) | `specified_by` (被规定于) | **合规校验**：当修改代码实现文档时，校验是否偏离了规范文档的约束。 | 详细设计文档实现了架构决策记录 (ADR) 或需求文档 (PRD)。 |
| **演进/替代** | `supersedes` (取代) | `obsoleted_by` (被取代于) | **废弃隔离**：阻止 AI 在新需求中引用旧版本的文档，引导其阅读新文档。 | V2 架构文档取代 V1 架构文档。 |
| **横向拓展** | `relates_to` (相关) | `relates_to` (相关) | **上下文扩充**：提供平行的业务背景，防止管中窥豹。 | 订单流转文档与库存扣减文档。 |

**针对你的 2.2 场景 (新增 C 文档的孤儿发现机制)**：
这实际上超越了单纯的两点连线，属于\*\*“目录树/层级规则发现”\*\*。可以在系统中定义一种特殊的元数据标签，例如给 A 文档打上标签 `role: api_registry`。在 `CLAUDE.md` 中约定：“任何新创建的包含 API 定义的文档，必须与带有 `api_registry` 标签的文档建立 `detailed_in` 关系，并更新该 registry”。

-----

### 3\. 维护主体与 Hooks 机制的结合

维护链路的准确性是这个系统的生命线。**强烈推荐：AI 静默写入 + Git 显式审计 + Hooks 强制校验**。

1.  **AI 静默写入**：AI 在执行完文档修改任务后，自动调用更新关系的 Tool，不要每次都弹窗问用户“我是否要更新数据库”。
2.  **Git 显式审计**：因为我们将关系数据落盘（比如 `links.json`），用户的审计其实就是在看 Git Diff。用户在 Commit 前，可以直接看到哪些连线被添加或删除了。
3.  **CLAUDE.md 规则注入**：
    在 `CLAUDE.md` 中增加极其严厉的 Prompt：
    > "【系统约束】：每当你新建、修改或删除任何 markdown 文档时，你必须在回答完毕前调用 `update_doc_graph` 工具，分析本次变更对其他文档的影响，并更新文档网络拓扑。严禁在修改了核心文档后遗漏更新索引表。"
4.  **结合 Claude Code Hooks**：
    这是非常巧妙的一步。你可以利用类似于 pre-commit 的 hook，或者 Claude Code 的生命周期钩子（如果支持自定义的话）。
      * **实现逻辑**：写一个简单的校验脚本（如 `check_orphans.py`）。当检测到有 `.md` 文件被修改或新增，但存储关系的 DB（如 `links.json`）的 hash 没有发生变化时，抛出 Warning 给 AI：“检测到文档变更但未更新依赖图谱，请立刻执行依赖分析”。

-----

### 4\. JSON vs SQLite 的存储设计

**“使用 JSON 是否意味着不需要引入 MCP？”**
答案是：**不一定**。
JSON 和 SQLite 只是底层的**持久化介质**，而 MCP 是**通信接口**。你可以写一个 MCP Server，它背后读写的依然是 JSON 文件。同样，你也可以不写 MCP，直接用 Python 脚本（Skill）读写 SQLite。

但从工程演进角度，针对 AI Coding 场景，这两者各有千秋：

#### 方案 A：JSON 文件存储（推荐作为一期 MVP）

以 `doc_graph.json` 的形式直接存放在代码仓库根目录（类似 `package.json`）。

  * **数据结构设计**：
    ```json
    {
      "nodes": {
        "docs/api/overview.md": { "type": "registry", "description": "API 总览与索引" },
        "docs/api/user_module.md": { "type": "detail", "description": "用户模块详细接口" }
      },
      "edges": [
        {
          "source": "docs/api/user_module.md",
          "target": "docs/api/overview.md",
          "relation_type": "detailed_in",
          "context": "用户模块的接口定义被汇总在 overview 的第 2 章中"
        }
      ]
    }
    ```
  * **优点**：与代码同生共死，同分支管理。任何人拉取代码，就能拿到匹配当前代码版本的依赖图谱。Git 冲突解决极其直观。
  * **缺点**：当文档达到数百个时，AI 每次整体读取或修改 JSON 容易出错，且 JSON 不支持复杂的图遍历查询（比如“查找 A 文档的所有二度依赖”）。

#### 方案 B：SQLite 存储（适合二期或百人级协作项目）

将关系存储在 `.doc_graph.db`（SQLite 文件）中，同样可以放在代码仓库中。

  * **数据结构设计**：
      * 表 `Nodes`: `id (TEXT PK)`, `file_path (TEXT)`, `summary (TEXT)`
      * 表 `Edges`: `source_id (TEXT)`, `target_id (TEXT)`, `relation_type (TEXT)`, `context (TEXT)`
  * **优点**：可以通过 SQL 执行极其强大的查询。AI 不需要读取全量数据，只需调用工具（Skill/MCP）执行诸如 `SELECT * FROM Edges WHERE target_id = 'docs/api/overview.md'`。非常节省上下文 Token。
  * **缺点**：它是二进制文件，Git 无法很好地处理 SQLite 的合并冲突。如果是多人协作，可能需要把这个数据库独立部署（这就成了真正的后端服务），从而失去了“代码与文档图谱随分支强一致”的优势。

### 下一步建议

为了快速验证这套机制在你的企微 SCRM 私域营销系统中的表现，你可以：
从 **JSON 存储 + Claude Code 本地 Python 脚本 (Agent Skill)** 开始。

你想先看看这个 Python 脚本（也就是让 AI 来更新 JSON 的这个核心 Tool）的代码实现逻辑吗？我可以提供一段可以直接被 Claude Code 调用的基础代码框架。