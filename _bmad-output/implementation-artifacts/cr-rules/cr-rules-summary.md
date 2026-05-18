# CR Rules Summary

用于沉淀跨 Story 可复用的 CR 规则提炼结果，记录规则来源、适用范围、落地位置与同步状态。

---

## Story 记录

## Story 4-1 / 2026-05-15

- **Story**: 4-1
- **分析来源**:
  - `4-1-code-review-summary-20260514-round-1.md`
  - `4-1-code-review-evaluation-20260515-round-1.md`
  - `4-1-code-review-summary-20260515-round-2.md`
  - `4-1-code-review-evaluation-20260515-round-2.md`
  - `4-1-code-review-summary-20260515-round-3.md`
  - `4-1-code-review-evaluation-20260515-round-3.md`
- **结论概览**:
  - Round 1 发现 1 条正式 patch：测试桩时间戳在第 10 条关系后会生成无效 ISO 字符串。
  - Round 2 保留 1 条非阻塞 TODO：迁移 002 的 status 索引创建可进一步加固。
  - Round 3 确认两项问题均已修复，无剩余阻塞项或 CR TODO。

### 提炼规则

#### 1. CR-REPO-06：迁移子步骤必须独立幂等，并覆盖部分迁移数据库场景

- **来源问题**: migration 002 在检测到 `status` 列已存在时直接返回，导致“列已存在但索引缺失”的部分迁移数据库无法补建 `idx_relations_status`。
- **适用范围**: Repository migration、schema 演进、启动自愈逻辑。
- **规避指南**:
  - 禁止将“列已存在”作为整条 migration 的提前返回条件。
  - 列新增、索引创建、数据回填等子步骤必须分别设计幂等保护。
- **最佳实践**:
  - 将可独立执行的 schema 子步骤拆成单独 SQL 常量或单独检查分支。
  - 除标准旧库升级测试外，必须补“部分迁移数据库”回归测试，例如列已存在但索引缺失。
- **本次落地**:
  - `src/repositories/migrations/002-add-relation-status.ts`
  - `tests/unit/repositories/sqlite-graph-repository.test.ts`
- **已同步全局文档**:
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`

#### 2. CR-TEST-01：测试 helper 的时间/序列数据必须用数值偏移生成，并覆盖跨位数边界

- **来源问题**: `InMemoryRelationRepository.addRelation()` 通过字符串拼接构造 ISO 时间戳，在第 10 条关系时生成非法字符串 `2026-05-14T00:00:010.000Z`。
- **适用范围**: fixture factory、in-memory repository、fake clock、递增 ID / 时间戳 helper。
- **规避指南**:
  - 禁止通过字符串拼接生成依赖位数变化的日期、编号或序列值。
  - 只要 helper 依赖计数器增长，就必须覆盖跨位数边界回归。
- **最佳实践**:
  - 使用固定基准值加数值偏移生成时间戳、ID 或序列。
  - 至少覆盖一条 9→10 或 99→100 的边界测试，防止测试基础设施在业务断言前失效。
- **本次落地**:
  - `tests/unit/services/relation-service.test.ts`
- **已同步全局文档**:
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`

### 治理结论

- 本次提炼出的两条规则均已升格为全局规则，并完成 Rule Document Registry 要求的三份镜像文档同步。
- 本次无新增 backlog 项；相关问题已在 Story 4-1 CR 流程中完成修复并关闭。
- 后续若有新 Story 出现同类问题，应直接引用 `CR-REPO-06` 与 `CR-TEST-01`，避免重复讨论同一根因。

---

## Story 4-2 / 2026-05-15

- **Story**: 4-2
- **分析来源**:
  - `4-2-code-review-summary-20260515-round-1.md`
  - `4-2-code-review-evaluation-20260515-round-1.md`
  - `4-2-code-review-summary-20260515-round-2.md`
  - `4-2-code-review-evaluation-20260515-round-2.md`
- **结论概览**:
  - Round 1 暴露 2 个 P1 阻塞项：真实 `deprecateRelation()` 路径没有落成扫描保护可识别的人工信号；同批次 dedupe 先看 `confidence`，会截断 `framework_preset > auto_scan` 的来源优先级。
  - Round 2 确认上述问题均已修复，相关单元、集成与 CLI 回归测试通过。
  - 本 Story 无新增非阻塞 CR TODO，适合沉淀为扫描/关系治理层的全局规则。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| CR-SCAN-02：人工修正必须落成扫描保护可识别的持久化信号 | 通过 | 10/12 | global-doc | 已按收尾指令同步全局文档 |
| CR-SCAN-03：批内候选裁剪必须先比较来源优先级，再比较置信度 | 通过 | 11/12 | global-doc | 已按收尾指令同步全局文档 |

### 提炼规则

#### CR-SCAN-02：人工修正必须落成扫描保护可识别的持久化信号

- **来源问题**: 用户手动 deprecated 的 `auto_scan` / `framework_preset` 关系在真实业务路径下仍保留原始 source，增量扫描只能按 `source='manual'` 保护，导致关系先被删后被 active 重新写回。
- **CR 证据**:
  - `4-2-code-review-summary-20260515-round-1.md`: reviewer 指出 `RelationService.deprecateRelation()` 与 `ScanService` 的 manual 保护契约脱节，直接阻塞 AC2。
  - `4-2-code-review-evaluation-20260515-round-1.md`: evaluator 确认真实 deprecated 路径无法进入 `excludeSources: ['manual']` 保护集合。
  - `4-2-code-review-evaluation-20260515-round-2.md`: Round 2 确认修复后，真实 `deprecateRelation()` 路径已切换为 `source: 'manual'`，且增量扫描回归测试通过。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 单 Story 内 reviewer 与 evaluator 持续命中，且真实业务路径与测试桩路径出现偏差。 |
  | 影响范围 | 2 | 同时影响 `RelationService`、`ScanService`、增量删边与写回保护。 |
  | 风险等级 | 2 | 会把用户人工修正过的关系恢复为 active，属于核心数据收敛风险。 |
  | 根因稳定性 | 2 | 根因是“人工语义未落成统一持久化信号”，属于流程/契约缺口，后续容易再犯。 |
  | 可执行性 | 2 | 可写成明确规则，并可通过真实 service 路径回归测试验证。 |
  | 文档缺口 | 1 | 现有文档定义了来源类型，但未要求人工修正语义必须被扫描保护逻辑统一消费。 |

- **总分**: 10/12
- **建议去向**: global-doc
- **适用范围**: RelationService、ScanService、重建/增量扫描保护、人工修正相关 API。
- **规避指南**:
  - 禁止只在调用约定或临时内存态里表达“这是人工修正”，却不把它写成扫描保护可识别的持久化信号。
  - 禁止让删边、写回、rebuild 警告等保护路径分别消费不同的人工修正判定标准。
- **最佳实践**:
  - 当业务要求“人工修正优先于自动扫描”时，必须将人工语义统一落成 `source='manual'` 或等价、可持久化且跨流程复用的标记。
  - 回归测试必须覆盖真实路径：先由扫描生成自动关系，再调用手动修正 API，再执行增量扫描/重建，断言人工修正仍被保留。
- **全局文档建议**:
  - 写入 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 的 Scanner / 增量扫描规则章节。
- **本次落地**:
  - `src/services/relation-service.ts`
  - `tests/unit/services/relation-service.test.ts`
  - `tests/integration/relation-service.test.ts`
  - `tests/unit/services/scan-service.test.ts`
- **同步状态**: 已同步全局文档

#### CR-SCAN-03：批内候选裁剪必须先比较来源优先级，再比较置信度

- **来源问题**: `dedupeRelations()` 在持久化前仅按 `confidence` 选择同一关系键的候选，导致 `framework_preset` 可能在进入最终优先级逻辑前就被更高置信度的 `auto_scan` 提前淘汰。
- **CR 证据**:
  - `4-2-code-review-summary-20260515-round-1.md`: reviewer 指出同批次去重阶段会截断 AC3 的 `manual > framework_preset > auto_scan` 规则。
  - `4-2-code-review-evaluation-20260515-round-1.md`: evaluator 确认 `dedupeRelations()` 在 `persistRelationWithPriority()` 之前执行，属于前置裁剪越权。
  - `4-2-code-review-evaluation-20260515-round-2.md`: Round 2 确认去重逻辑已改为先比较来源优先级，同来源再比较 `confidence`，并补齐同批次冲突回归测试。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 当前证据集中在单 Story，但 reviewer/evaluator 均确认同一根因。 |
  | 影响范围 | 2 | 影响扫描批处理、预写入 dedupe 与来源优先级治理契约。 |
  | 风险等级 | 2 | 会稳定违反 `framework_preset > auto_scan` 的业务规则，直接影响图谱正确性。 |
  | 根因稳定性 | 2 | 根因是“前置裁剪与最终优先级规则不一致”，属于高复发的管线设计问题。 |
  | 可执行性 | 2 | 可以明确要求共享同一 priority 函数，并通过同批次冲突测试验证。 |
  | 文档缺口 | 2 | 现有全局规则尚未约束扫描阶段的前置 dedupe 必须遵守业务优先级。 |

- **总分**: 11/12
- **建议去向**: global-doc
- **适用范围**: ScanService、任何进入持久化前的 dedupe / merge / 候选裁剪逻辑。
- **规避指南**:
  - 禁止在业务优先级判定前，先用 `confidence`、数组顺序或其他次级启发式淘汰候选关系。
  - 禁止前置 dedupe 与最终持久化使用两套不同的来源优先级函数。
- **最佳实践**:
  - 对同一业务键的候选关系，必须先比较来源优先级，再在同来源内比较 `confidence` 或其他次级指标。
  - 同批次冲突测试必须覆盖“低优先级候选 `confidence` 更高”的逆向场景，确保前置裁剪不会绕过最终业务规则。
- **全局文档建议**:
  - 写入 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 的 Scanner / 增量扫描规则章节。
- **本次落地**:
  - `src/services/scan-service.ts`
  - `tests/unit/services/scan-service.test.ts`
- **同步状态**: 已同步全局文档

### 治理结论

- Story 4-2 无新增 backlog TODO；`bmenhance-cr-05-todo-tracker` 无需新增条目。
- 本次提炼出的两条规则均满足全局升格阈值，并已完成 Rule Document Registry 要求的三份镜像文档同步。
- 后续凡涉及“人工修正覆盖自动结果”或“前置候选裁剪”类逻辑，应直接引用 `CR-SCAN-02` 与 `CR-SCAN-03`。

---

## Story 5-1 / 2026-05-17

- **Story**: 5-1
- **分析来源**:
  - `5-1-code-review-summary-20260517-round-1.md`
  - `5-1-code-review-evaluation-20260517-round-1.md`
- **结论概览**:
  - Round 1 reviewer / evaluator 均通过；无阻塞项。
  - 唯一非阻塞项是 Story 5.1 历史 DTO 示例与当前 CLI/MCP 共享 DTO 契约漂移，已在 evaluation 中确认为 **P2 / CR TODO / 非阻塞债务**。
  - 当前实现代码、schema 冻结测试和 Rule Document Registry 三份镜像文档已经对齐，不需要新增全局规则；本轮只记录分析结果，并交由 `bmenhance-cr-05-todo-tracker` 跟踪后续文档整理。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| Story 示例 DTO 需与共享命名 schema/CLI JSON 契约同步维护 | 未通过（与现有全局规则重复，且当前为未修复文档债） | 4/12 | todo-tracker | 已按本轮 finalizer 指令移交 05 TODO Tracker |

### 治理结论

- Story 5-1 本轮**无新增可沉淀的 CR 规则**。
- 当前问题本质是历史 Story 示例漂移，不是运行时代码或全局规则缺口；全局约束已由 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 覆盖。
- 后续若获得修改 Story 5.1 文档的明确许可，应优先按 `src/mcp/tools/schemas.ts` 与现有镜像规则同步 DTO 示例，再关闭对应 TODO。

## Story 5-5 / 2026-05-18

- **Story**: 5-5
- **分析来源**:
  - `5-5-code-review-summary-20260518-round-1.md`
  - `5-5-code-review-evaluation-20260518-round-1.md`
  - `5-5-code-review-summary-20260518-round-2.md`
  - `5-5-code-review-evaluation-20260518-round-2.md`
  - `5-5-code-review-summary-20260518-round-3.md`
  - `5-5-code-review-evaluation-20260518-round-3.md`
  - `5-5-code-review-summary-20260518-round-4.md`
  - `5-5-code-review-evaluation-20260518-round-4.md`
- **结论概览**:
  - Round 1 到 Round 3 共暴露 3 个 `patch` 问题家族：Hooks 触发链路只测文件存在、三大 IDE MCP 验证只测配置形状、stdio MCP helper 重抛增强错误未保留 `cause`；另有 1 个历史 `defer` 项（QueryService 性能阈值波动）。
  - Round 4 确认 3 个 `patch` 问题均已闭合，Story 5-5 审查通过。
  - 本轮提炼出 2 条跨 Story 可复用、但仍偏 IDE/MCP 测试域的规则，按保守默认决策仅 record-only 到 `cr-rules-summary.md`；不触发 Rule Document Registry 全局文档同步。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| CR-TEST-02：生成型自动化产物不能只验证存在性，必须同时校验精确配置与真实执行链路 | 通过 | 10/12 | rules-summary | 已按默认决策写入 CR rules summary |
| CR-MCP-02：IDE MCP 集成测试必须消费生成配置的 `command/args` 并走真实 stdio 启动链路 | 通过 | 11/12 | rules-summary | 已按默认决策写入 CR rules summary |
| 捕获异常后的增强重抛必须保留 `cause` | 未通过（已有 lint / 错误处理约束覆盖） | 4/12 | none | 不沉淀 |

### 提炼规则

#### CR-TEST-02：生成型自动化产物不能只验证存在性，必须同时校验精确配置与真实执行链路

- **来源问题**: Round 1 暴露 Claude Code Hooks 的验收证据只覆盖文件存在与宽松配置形状，未覆盖 `PostToolUse` 精确 matcher/command，也未执行生成的 hook 脚本验证 `cord impact --json <path>` 真实调用链，导致 FR29/AC7 的自动触发能力可能在配置漂移时静默失效。
- **CR 证据**:
  - `5-5-code-review-summary-20260518-round-1.md`: reviewer 指出 Hooks “触发”只验证文件存在，没有验证落盘后会调用影响分析。
  - `5-5-code-review-evaluation-20260518-round-1.md`: evaluator 确认应补精确 `PostToolUse` 断言与 hook 执行性测试。
  - `5-5-code-review-summary-20260518-round-4.md`: Round 4 确认 matcher/command 精确断言与 stub `cord` 执行性测试持续闭合。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 同一 Story 的多轮 summary/evaluation 持续围绕同一测试缺口闭环。 |
  | 影响范围 | 1 | 主要影响 IDE adapter / init 输出的生成型自动化产物验证，属于单技术域。 |
  | 风险等级 | 2 | 会让自动触发关系检查的核心体验在配置漂移时静默失效，属于用户可感知功能回归。 |
  | 根因稳定性 | 2 | 根因是“生成产物只测存在、不测执行”的稳定测试盲区，后续生成脚本/命令类能力容易复发。 |
  | 可执行性 | 2 | 可明确要求精确断言 matcher/command，并用 stub + 执行脚本的回归测试锁定。 |
  | 文档缺口 | 2 | 当前全局文档与既有 CR 规则未覆盖“生成型自动化产物需执行性验证”模式。 |

- **总分**: 10/12
- **建议去向**: rules-summary
- **适用范围**: IDE adapter、`cord init` 生成的 hook/script/automation config、相关单元与集成测试。
- **规避指南**:
  - 禁止只断言生成文件存在，或只用 `expect.any(...)` 验证自动化配置的宽松形状。
  - 禁止把“脚本已生成”当作“自动化行为已验证”。
- **最佳实践**:
  - 对生成的 hook / script / automation config，必须同时断言关键配置项的精确值（如 matcher、command、args）。
  - 至少补 1 条执行性测试：在临时项目中执行生成脚本或命令，并通过 stub 可执行文件断言真实收到的 CLI 参数链路。
- **全局文档建议**:
  - 暂不升格到 Rule Document Registry 文档。该规则虽可复用，但目前证据仍集中在 Epic 5 的 IDE 自动化测试域；若后续 Story 再次出现生成型脚本/命令只测存在性的问题，再考虑升格到 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 的 IDE adapter / 测试策略章节。
- **本次落地**:
  - 已按默认决策记录到 `cr-rules-summary.md`；不修改源码、Story 文档或全局规则文档。
- **同步状态**: 已写入规则总结

#### CR-MCP-02：IDE MCP 集成测试必须消费生成配置的 `command/args` 并走真实 stdio 启动链路

- **来源问题**: Round 1 与 Round 2 暴露三大 IDE MCP “端到端验证”只验证生成配置里的 `command/args/type` 字符串，随后仍回退到 in-memory MCP helper，未真实消费 IDE 生成配置启动 stdio server，导致 AC6/AC7 与 NFR11 的关键链路无法证明。
- **CR 证据**:
  - `5-5-code-review-summary-20260518-round-1.md`: reviewer 首次指出三大 IDE MCP 端到端验证只覆盖通用 MCP server 与部分 IDE 配置形状。
  - `5-5-code-review-evaluation-20260518-round-2.md`: evaluator 明确确认必须消费生成的 `command/args`，不能继续用 in-memory server 代替 IDE 配置验证。
  - `5-5-code-review-summary-20260518-round-4.md`: Round 4 确认 Claude Code / Cursor / VS Code Copilot 三 IDE 矩阵测试均已通过 `StdioClientTransport` 消费生成配置并完成核心工具链验证。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 同一 Story 多轮复审重复命中，直到真实 stdio 启动链路补齐后才闭合。 |
  | 影响范围 | 2 | 同时影响 IDE adapter、MCP server、init 产物和集成测试矩阵，属于跨模块问题。 |
  | 风险等级 | 2 | 若只测配置形状，真实 IDE 启动入口、相对路径或进程链路漂移会被静默放过。 |
  | 根因稳定性 | 2 | 根因是“配置形状测试冒充端到端验证”的集成测试设计缺口，后续 IDE/MCP 能力扩展时高概率复发。 |
  | 可执行性 | 2 | 可写成明确规则：消费生成配置启动 stdio transport，并执行最小工具链回归。 |
  | 文档缺口 | 2 | 现有全局文档仅约束 MCP DTO 与 stdout/stderr 边界，未约束 IDE MCP 配置验证必须走真实 transport。 |

- **总分**: 11/12
- **建议去向**: rules-summary
- **适用范围**: IDE adapter 生成的 MCP 配置、MCP 集成测试、需要验证 `command/args/cwd` 真实执行链路的启动型配置。
- **规避指南**:
  - 禁止先验证 IDE 生成配置形状，再回退到 in-memory helper 作为“端到端验证”。
  - 禁止在声称验证 IDE MCP 集成时绕过生成配置里的 `command`、`args`、`cwd` 等真实启动契约。
- **最佳实践**:
  - IDE MCP 矩阵测试必须读取各 IDE 生成配置，并用同一份 `command/args` 通过 `StdioClientTransport` 或等价子进程链路启动 server。
  - 启动后至少验证 `listTools()` 与最小核心工具链，确保配置、打包入口和真实 transport 三者同时闭合。
- **全局文档建议**:
  - 暂不升格到 Rule Document Registry 文档。该规则已满足高分阈值，但当前适用面仍偏 Epic 5 的 IDE/MCP 集成测试域；保守起见先 record-only。若后续其它 Story 再出现“生成配置只测形状、未走真实 transport”的同类问题，再升格到 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md`。
- **本次落地**:
  - 已按默认决策记录到 `cr-rules-summary.md`；不修改源码、Story 文档或全局规则文档。
- **同步状态**: 已写入规则总结

### 治理结论

- Story 5-5 本轮新增 2 条可复用规则，均按保守默认决策 record-only 到 `cr-rules-summary.md`。
- `capture -> rethrow` 保留 `cause` 的问题不新增规则：现有 lint 规则 `preserve-caught-error` 与错误处理约束已覆盖，重复沉淀收益不足。
- 本轮**不更新** `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md`，因为两条候选规则尚未达到“足够全局”的升格范围。
- 无需新增 `05 TODO Tracker` 条目；历史 QueryService 性能阈值波动已由 `cr-todo-backlog.md` 的 `TODO-024` 持续跟踪。
