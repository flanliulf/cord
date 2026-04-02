
question:

在 AI CODING 的过程中，会逐渐产生很多文档，需要考虑定义一个 skills/mcp, 用 db 存储在 AI coding 过程中生成的项目文档之间的双链关系，供 AI 在参考某个文档时，能够通过该 skills 或者 MCP ，快速查询到该文档的相关联文档，从而能够快速修正其他文档对该文档的引用，或者对该文档修改内容的感知，或者添加对该文档的补充引用。
请分析上述需求是否合理，并给出建议。以下是我的一些补充想法，供参考：
1. 使用 claude code 提出的 agent skills ，还是使用 MCP 两者之中谁来实现文档关系的存储更合适？
2.  relation_type 非常重要，对于 A <-> B 的两个文档来说，两者之间的关联关系是多种多样的，以下是两种典型的场景，请深度思考，详细列出所有可能的潜在场景和文档relation_type：
2.1 比如 A 是API 总览文档， 其内容中的一个章节对应一个模块的 API 文档  B 作为第二级渐进式披露， 此时 A 的这个章节只会列举 B 中所有的 API 定义（API 的详细说明，路径，出入参等都在 B 文档中），那么当 B 增加 一个新的 API 接口定义时，需要在 A 文档中同步增加这个新的 API 定义的内容。
2.2 同 2.1 类似，另一种情况是当增加了一个新的业务模块，此时会创建新的 C 文档，那么要能感知到 C 文档也要被引入关联到 A 文档（同时列出 C 中所有的 API 定义）
3. 对于维护主体——谁来创建和更新链接？推荐AI 自动提议 + 人工确认（或静默写入 + 支持审计）
 ，→ 在 CLAUDE.md 中定义规则：每次文档变更后，AI 必须调用工具更新关系图。另外是否可以考虑接入 claude code 的 hooks 特性来当完成文档生成/修改时触发。
4. 对于关系数据的存储，默认使用 JSON 文件，同时支持 SQLite。JSON 是否意味着不需要引入 MCP？请给出这两者的设计

---

Answer：

下面这个需求**非常合理**，而且在 AI Coding 规模化后几乎是“必需品”：文档越多，越需要把“引用关系”从**纯文本链接**升级为**可查询、可校验、可自动修复的关系图（knowledge graph / doc graph）**，否则很快就会出现：

* 文档 A 引用 B 的内容变更后**不同步**，产生“过期引用 / 断言不再成立”
* 新增模块文档 C 后，A 这种总览/索引类文档**遗漏收录**
* ADR / TSD / API Spec / README 之间**相互矛盾**但没人发现
* AI 在改一份文档时无法快速定位“被影响的其他文档集合”，导致修改扩散不完整

你提出的“双链”本质就是：关系边（edge）落库后可做**双向检索**与**影响面分析（impact analysis）**，这是正确方向。

---

## 1）用 Claude Code 的 agent skills 还是 MCP 来做更合适？

核心不是“存储在谁那里”，而是：**谁提供稳定的工具接口 + 谁更容易被多个 Agent / IDE / CLI 复用**。

### 建议结论（按演进阶段）

* **仅 Claude Code 内部使用、单机/单人、先跑通闭环**：优先用 **agent skill**（最短路径）
* **希望 Cursor / 其他 agent / CI / 多人协作都能统一访问同一份关系图服务**：优先用 **MCP**
* **最稳妥的工程化落地**：skill 只是“客户端”，底层用 MCP（服务端），后端 SQLite（或可插拔 JSON）

### 一个简单决策维度（你可以按现状选）

* **复用范围**：skill（局限于 Claude Code 生态） < MCP（跨工具标准接口）
* **权限/隔离/审计**：skill（弱） < MCP（可做鉴权、审计、限权）
* **并发与一致性**：JSON + skill（容易冲突） < MCP + SQLite（可事务/锁）
* **部署成本**：skill（低） < MCP（中）
* **长期可维护性**：skill（随 prompt/规则漂移） < MCP（接口契约更稳定）

> 直觉上：**你要做“文档关系基础设施”**，更像一个“项目内知识服务”，长期更适合 MCP；但为了快，第一版用 skill 直写 JSON/SQLite 也完全合理。

---

## 2）relation_type 设计：不仅“链接”，还要定义“传播规则”

你已经抓住关键：relation_type 不只是标签，它决定了**变更如何传播、哪些地方必须同步、同步粒度是什么**。

我建议把 relation_type 分成 6 大类，每类都明确“方向 + 语义 + 影响规则”。

### A. 结构与渐进披露（Progressive Disclosure / Composition）

这类关系通常意味着“上层是入口/目录/概览，下层是细节/权威来源”：

* `expands_to`：A 展开为 B（A 是摘要，B 是细节）
* `overview_of`：A 是 B 的总览（更偏概念层）
* `index_of`：A 是 B 集合的索引（更偏目录/导航）
* `section_expands_to`：A 的某个章节展开为 B（**强烈建议支持 anchor 级别**）
* `contains` / `part_of`：A 包含 B 或 B 属于 A（结构归属）
* `owned_by_module`：文档归属某模块（用于自动收录、自动分组）

> 2.1/2.2 本质上属于这一类，但你还需要更“可执行”的细分（见后面同步类）。

### B. 引用与证据（Reference / Citation）

这类关系不要求同步内容，但用于可追溯与辅助检索：

* `cites`：A 引用 B（一般是事实/结论依据）
* `defines_term_in`：A 使用的术语定义在 B
* `source_for`：B 是 A 某段内容的来源（带 anchor/范围）
* `example_in`：A 的示例来源于 B

### C. 权威与派生（Authority / Derivation）

用于解决“谁是单一事实来源（SSOT）”：

* `authoritative_for`：B 是某领域/主题的权威来源（A 不应覆盖细节）
* `derived_from`：A 由 B 派生（可能是生成、抽取、同步得到）
* `generated_from`：A 由工具/流程从 B 生成（可重建）
* `summarizes`：A 是 B 的摘要（B 变更后 A 可能过期，但允许滞后）
* `extracts`：A 抽取了 B 的某些字段/片段（可精确同步）

### D. 一致性与冲突（Consistency / Conflict）

用于让 AI 做“文档一致性校验”：

* `must_be_consistent_with`：A 必须与 B 一致（强约束）
* `conflicts_with`：A 与 B 存在冲突（待解决）
* `duplicates`：重复内容/重叠范围
* `supersedes`：A 替代 B（B 进入废弃链路）
* `deprecated_by`：B 被 A 废弃（强提示）

### E. 需求到实现的追踪（Traceability）

把 PRD/ADR/TSD/API/代码串起来：

* `requires`：A 需求依赖 B 能力
* `implemented_by`：A 的需求由 B（设计/代码）实现
* `specifies`：A 规定了 B 的实现约束
* `tests` / `validated_by`：A 的内容由 B（测试/验收）验证
* `api_defined_in`：API 定义权威在某文档
* `schema_defined_in`：数据模型权威在某文档

### F. 同步与聚合（Sync / Aggregation）——专门解决你 2.1/2.2 的问题

这是你场景里最关键的一类：它们要携带“同步策略”。

推荐至少这些：

* `enumerates_items_from`：A 枚举 B 的条目集合（**必须定义 items 类型：apis/schemas/events…**）
* `aggregates_from`：A 聚合多个文档（通常 A 的某章节由查询结果生成）
* `sync_required_from`：A 的某段内容必须与 B 同步（强一致）
* `sync_suggested_from`：建议同步（弱一致）
* `member_of_aggregate`：B 是某聚合视图的成员（解决 2.2 的自动收录）
* `discovered_by_rule`：B 通过规则被自动发现并关联到 A（可审计“为什么被收录”）

> 关键点：**同步类关系需要额外字段**，否则 relation_type 再多也不可执行。

---

## 2.1 场景：A（API 总览）枚举 B（模块 API 细节），B 新增 API 后 A 要同步

建议用一条“可执行”的关系边来表达：

* `A --enumerates_items_from--> B`
* 关系元数据（示例）：

  * `item_kind: "api_endpoint"`
  * `source_of_truth: "B"`
  * `projection: ["method","path","summary"]`（A 需要同步哪些字段）
  * `target_anchor: "A#模块X-API列表"`（A 写入位置）
  * `sync_mode: "autopatch" | "propose_patch" | "mark_stale"`
  * `sync_state: { last_synced_at, last_synced_hash, stale: bool }`

当 B 增加新 API 时，工具能做三件事（你可以按成熟度选择其一或组合）：

1. **直接自动补丁**：在 A 对应章节插入新条目（最爽，但要强审计）
2. **生成 patch 提议**：输出 diff 给人确认
3. **标记 A 过期**：写入 `STALENESS` 标记或生成待办（最保守）

---

## 2.2 场景：新增模块文档 C，要能“感知”C 也应该被 A 收录

这里不要靠“人去手动链 A<->C”，而是让关系系统具备**自动发现机制**：

### 推荐两种机制（可并存）

**机制 1：基于元数据的聚合**

* 每个模块 API 文档（B/C/…）在 YAML front matter 里声明：

  * `doc_kind: api_module`
  * `module: xxx`
  * `domain: api`
* A 声明自己是聚合文档：

  * `aggregates_from` + `query: doc_kind=api_module AND domain=api`
* 当新增 C，工具执行聚合查询 -> 自动把 C 作为 `member_of_aggregate` 关联到 A，并触发 A 的章节更新（同 2.1）。

**机制 2：基于目录约定的发现**

* 约定路径：`docs/api/modules/<module>.md`
* A 的聚合规则：扫描该目录新增文件即收录
* 同样落一条 `discovered_by_rule` 关系边用于审计与可解释性

> 你要的“感知新增文档”其实就是：**聚合视图（A）对成员集合的定义必须是规则化的，而不是靠手工维护列表**。

---

## 3）维护主体：AI 自动提议 + 人工确认 / 静默写入 + 审计

你提出的方向我赞同，但要加两条“工程护栏”，否则容易把关系库写乱：

### 护栏 1：关系变更必须可回放、可审计

关系边要记录：

* `created_by`（ai/human/hook）
* `confidence`（0-1）
* `evidence`（从哪些文本片段/链接/元数据推导）
* `change_reason`（为什么新增/修改/删除）
* `timestamps` + `git_commit`（能追溯到一次提交/一次生成）

### 护栏 2：区分“建议关系”与“已确认关系”

建议做两层：

* `status: PROPOSED | CONFIRMED | REJECTED | AUTO_CONFIRMED`
* 默认 AI 新建为 PROPOSED；当满足某些确定性条件（比如 front matter 规则匹配、显式链接）可 AUTO_CONFIRMED

### 你说的 CLAUDE.md 规则与 hooks 的组合建议

* **CLAUDE.md**：定义“每次文档生成/修改后必须调用关系工具”的流程规则（强约束）
* **Claude Code hooks**：在 `doc_write` / `post_edit` / `post_generate` 时触发：

  1. `upsert_document`（写入 doc 元信息 + hash）
  2. `extract_relations`（从显式链接、front matter、约定目录提取确定性关系）
  3. `suggest_relations`（用 LLM 推断弱关系 -> PROPOSED）
  4. `impact_analysis`（告诉 AI 哪些文档可能需要同步/修复引用）
  5. `apply_sync`（按策略自动改或产出 patch）

---

## 4）关系数据存储：JSON vs SQLite；JSON 是否意味着不需要 MCP？

### 关键结论

* **JSON/SQLite 是“存储介质”**
* **skill/MCP 是“访问方式（接口与运行形态）”**
* 所以：**用 JSON 并不自动排除 MCP**；你仍然可以用 MCP 做统一接口，只是后端换成 JSON。

### JSON 方案（优点：轻、可进 git、可 review）

适合第一版：

* `doc-graph.json`（或拆分成 `docs/index/graph/*.json`）
* 结构建议：

  * nodes（doc_id, path, title, kind, module, hash, updated_at）
  * edges（src, dst, type, src_anchor, dst_anchor, meta, status, audit）

缺点：

* 并发写冲突、查询性能差（尤其“多跳关系”“按 type 过滤”“按模块聚合”）
* 很难做约束（防止孤儿边、重复边）

### SQLite 方案（优点：事务、查询强、可做约束/索引）

更适合作为长期主存储：

* 可对 `(src,type,dst,src_anchor,dst_anchor)` 建唯一索引
* 可加索引支持快速查询：

  * `by_src`, `by_dst`, `by_type`, `by_kind`, `by_module`, `by_updated_at`
* 可做视图：如 `api_inventory_view`

缺点：

* 不适合直接 code review（但可以**导出 JSON 快照**进仓库）

### 我推荐的折中：SQLite 为主 + JSON 快照为辅

* **运行时**：MCP/skill 读写 SQLite（强一致、高性能）
* **仓库里**：每次 CI 或 hook 导出 `doc-graph.snapshot.json`（可审阅、可回滚、可 diff）
* 这样既满足工程性，也满足你对“治理”的要求

---

## 一个可落地的最小接口（不管是 skill 还是 MCP 都建议长这样）

你要的核心能力，其实就 5 组动作：

1. 文档登记

* `upsert_document(path, kind, module, title, hash, anchors, metadata)`

2. 关系写入（含审计）

* `upsert_relation(src, dst, type, meta, status, confidence, evidence)`
* `remove_relation(...)`

3. 关系查询

* `get_related(doc_id, direction=both, types=[], depth=1, filters={kind/module/status})`

4. 影响面分析

* `impact_analysis(changed_doc_id) -> { stale_docs, sync_targets, conflicting_docs }`

5. 同步执行（针对 enumerate/aggregate 这类关系）

* `sync(doc_id | relation_id, mode=autopatch|propose|mark_stale)`

---

## 最后给一个落地建议路线（不纠结、直接推进）

**第 1 周：先跑通闭环**

* 用 Claude Code skill + JSON（或直接 SQLite）实现：

  * upsert_document / upsert_relation / get_related / impact_analysis
* 要求所有文档有 `doc_id`（front matter），并支持 anchor 级关系

**第 2~3 周：把 2.1/2.2 做成“可执行同步”**

* 引入 `enumerates_items_from / aggregates_from / member_of_aggregate`
* 让 A 的某些章节由工具维护（生成块），避免“手写列表”不可控

**第 4 周：升级为 MCP 服务（如果你要跨工具/多人/CI）**

* skill 继续保留，但只是 MCP client
* SQLite 主存储 + JSON snapshot 入库
* 加审计与 PROPOSED/CONFIRMED 工作流

---

如果你愿意，我可以直接按你现有 repo 的文档类型（README / ADR / TSD / API / 数据字典 / 架构图说明等）给出一份**relation_type 字典（含字段约束、同步策略、推荐方向、典型触发器）**，以及对应的**SQLite schema + JSON schema**，再配一套适配 Claude Code hooks 的触发流程。这样你就能把它写进 `CLAUDE.md` 变成团队的硬规则。
