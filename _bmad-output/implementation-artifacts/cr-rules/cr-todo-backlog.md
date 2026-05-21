# CR TODO Backlog

跨 Story 延迟改进事项追踪。仅记录非阻塞性问题，阻塞项须在当前 Story CR 流程内解决。

## 统计摘要

| 状态 | 数量 |
| ------ | ------ |
| Open | 0 |
| In Progress | 0 |
| Resolved | 36 |
| **合计** | **36** |

---

## Open Items

无。

## Resolved Items

---

### TODO-005

- **标题**：`--verbose` 在 async CLI action 内生效过晚，action 内 `logger.debug` 会被吞掉
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-2 / Round 3 / 2026-04-26（发现 #2；R3~R5 评估轮次均维持降级） + Story 2-5 / Round 4 / 2026-05-09（非阻塞复核确认）
- **涉及文件**：
  - `src/cli/index.ts`
  - `src/cli/verbose.ts`
  - `tests/unit/cli/index.test.ts`
- **问题描述**：`runCli()` 曾在 `await program.parseAsync(process.argv)` 完成后才调用 `applyVerboseFlag(program.opts(), process.env)`，导致 `--verbose` 无法覆盖 async action 执行期间的 `logger.debug()` 调用。
- **处理方式**：`runCli()` 在 `parseAsync` 前预扫描 root-level `-v` / `--verbose` 并启用 debug，parse 完成后仍保留 `program.opts()` 兜底；补充真实 Commander async action 内 `logger.debug` 输出回归测试。
- **解决记录**：2026-05-21 backlog 清零完成。验证：`npm test -- tests/unit/cli/index.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-018

- **标题**：Framework 文档发现同步递归存在事件循环阻塞风险
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-1 / Round 2 / 2026-05-07（R1-#3；Round 2 评估维持非阻塞）
- **涉及文件**：
  - `src/adapters/framework/abstract-base.ts`
  - `src/adapters/framework/interfaces.ts`
  - `_bmad-output/implementation-artifacts/cr-rules/v0.2-performance-and-output-plan.md`
- **问题描述**：同步 `discoverDocuments()` 对深层或大规模目录树存在事件循环阻塞风险；直接改成 async 会扩大 v0.1 接口 blast radius。
- **处理方式**：保持 v0.1 同步接口，将 async / batched discovery 作为 v0.2 接口级迁移规划，明确 batching、目录预算、取消/进度 hooks 与兼容策略。
- **解决记录**：2026-05-21 批次 8 规划收敛完成；详见 `v0.2-performance-and-output-plan.md`。

---

### TODO-022

- **标题**：BMAD frontmatter 检测采用高价值路径优先或分层预算
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-3 / Round 1-2 / 2026-05-08（R1 发现；R2 评估维持非阻塞）
- **涉及文件**：
  - `src/adapters/framework/bmad/detector.ts`
  - `tests/unit/adapters/framework/bmad/detector.test.ts`
- **问题描述**：`MAX_FRONTMATTER_FILES` 固定预算可能先被根目录 Markdown 噪声耗尽，导致 `docs/` 或 `_bmad-output/` 中的 BMAD frontmatter 漏检。
- **处理方式**：BMAD frontmatter 候选按 `_bmad-output/`、`docs/`、项目根 Markdown、其他路径分层优先扫描；补充超过 64 个根目录 Markdown 时仍检测 `docs/context.md` 的回归测试。
- **解决记录**：2026-05-21 批次 8 完成。验证：`npm test -- tests/unit/services/query-service.test.ts tests/unit/adapters/framework/bmad/detector.test.ts tests/unit/docs/adapter-contributor-docs.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-023

- **标题**：无变更快速返回仍在判定前全量计算 contentHash
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-6 / Round 1-2 / 2026-05-09（R1 发现 #2；R2 评估维持非阻塞）
- **涉及文件**：
  - `src/services/scan-service.ts`
  - `tests/integration/cli/scan.test.ts`
  - `tests/unit/services/scan-service.test.ts`
  - `_bmad-output/implementation-artifacts/cr-rules/v0.2-performance-and-output-plan.md`
- **问题描述**：无变更快速返回仍需提前对所有文档执行 `stat + readFile + sha256`，大仓库下存在线性成本上限。
- **处理方式**：纳入 v0.2 lazy-hash 性能治理计划：先比较 stored sync state 与 file stat，仅对候选变化文件计算 hash，并用大样本 unchanged fixture / benchmark 验证。
- **解决记录**：2026-05-21 批次 8 规划收敛完成；详见 `v0.2-performance-and-output-plan.md`。

---

### TODO-024

- **标题**：SQLite p95 比例性能测试稳健性补强
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 3-2 / Round 2-3 / 2026-05-11（R2-TODO-1；R3 评估维持非阻塞）
- **涉及文件**：
  - `tests/unit/services/query-service.test.ts`
- **问题描述**：SQLite 200→2000 文档 p95 比例断言受环境、IO、query planner 波动影响，导致 `test:coverage` 偶发失败。
- **处理方式**：移除 flaky wall-clock 比例断言，改为确定性验证：in-memory 三跳 traversal 的 repository read 次数被 frontier 约束，SQLite `EXPLAIN QUERY PLAN` 同时命中 source / target 索引。可选 wall-clock benchmark 纳入 v0.2 性能治理计划。
- **解决记录**：2026-05-21 批次 8 完成。验证：`npm test -- tests/unit/services/query-service.test.ts tests/unit/adapters/framework/bmad/detector.test.ts tests/unit/docs/adapter-contributor-docs.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-025

- **标题**：SQLite 测试 helper 失败路径清理加固
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 3-2 / Round 3 / 2026-05-11（R3-TODO-1）
- **涉及文件**：
  - `tests/unit/services/query-service.test.ts`
- **问题描述**：SQLite 测试 helper 在 seed 完成后才注册 disposable，seed 中途抛错时临时目录和 repository 可能无法进入 afterEach 清理路径。
- **处理方式**：helper 创建 repository 后立即注册 disposable；seed 失败时从 disposable 列表移除、关闭 repository、删除临时目录并重新抛错；补充 forced seed failure 回归测试。
- **解决记录**：2026-05-21 批次 8 完成。验证：`npm test -- tests/unit/services/query-service.test.ts tests/unit/adapters/framework/bmad/detector.test.ts tests/unit/docs/adapter-contributor-docs.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-027

- **标题**：Impact 多跳结果补完整路径解释
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：other
- **来源**：Story 3-3 / Round 2-3 / 2026-05-11~2026-05-12（R2-TODO-2；R3 维持非阻塞）
- **涉及文件**：
  - `src/services/impact-service.ts`
  - `src/cli/commands/impact.ts`
  - `tests/unit/cli/commands/impact.test.ts`
  - `_bmad-output/implementation-artifacts/cr-rules/v0.2-performance-and-output-plan.md`
- **问题描述**：当前 impact 输出缺少完整传播路径或中间节点链路，二跳/三跳结果不易人工复核。
- **处理方式**：不在 v0.1 批次中改变 DTO；纳入 v0.2 backwards-compatible 输出增强设计，规划 relation chain、中间 document path、hop metadata 与多路径候选优先级。
- **解决记录**：2026-05-21 批次 8 规划收敛完成；详见 `v0.2-performance-and-output-plan.md`。

---

### TODO-035

- **标题**：贡献指南集成测试模板补重复扫描断言
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 6-1 / Round 1-2 / 2026-05-19（R1 发现 #1；R2 维持 P2 defer）
- **涉及文件**：
  - `docs/contributing.md`
- **问题描述**：贡献指南可复制模板只执行一次 scan，缺少重复扫描不新增文档/关系的断言。
- **处理方式**：模板新增第二次 `service.scan({ projectRoot })`，断言 `documentsFound`、`relationsDiscovered` 为 0，且 relation count 不变。
- **解决记录**：2026-05-21 批次 8 完成。验证：`npm test -- tests/unit/services/query-service.test.ts tests/unit/adapters/framework/bmad/detector.test.ts tests/unit/docs/adapter-contributor-docs.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-036

- **标题**：贡献指南 SQLite 测试模板失败路径关闭连接
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 6-1 / Round 1-2 / 2026-05-19（R1 发现 #2；R2 维持 P2 defer）
- **涉及文件**：
  - `docs/contributing.md`
- **问题描述**：贡献指南 SQLite 模板在断言失败时可能跳过 `service.close()`，留下连接和临时目录清理噪音。
- **处理方式**：模板改为 `try { ... } finally { service.close(); }` 包裹 scan 与断言，确保失败路径也关闭 SQLite 连接。
- **解决记录**：2026-05-21 批次 8 完成。验证：`npm test -- tests/unit/services/query-service.test.ts tests/unit/adapters/framework/bmad/detector.test.ts tests/unit/docs/adapter-contributor-docs.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-017

- **标题**：Framework 扫描原生 fs 异常缺少结构化错误包装
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-1 / Round 2 / 2026-05-07（R1-#2；Round 2 评估维持非阻塞）
- **涉及文件**：
  - `src/adapters/framework/abstract-base.ts`
  - `tests/unit/adapters/framework.test.ts`
- **问题描述**：`discoverDocuments()` 的递归扫描曾直接调用 `lstatSync()` / `readdirSync()`。当扫描期间发生权限错误、文件消失或目录状态竞态时，`ENOENT` / `EACCES` 等原生异常会直接逃逸到上层，削弱错误分级和诊断稳定性。
- **处理方式**：裁决 framework discovery 的局部 fs 异常为 best-effort skip 策略，不升级同步 `IFrameworkAdapter.discoverDocuments()` 接口；`AbstractFrameworkAdapter` 对单路径 `lstat` / `readdir` 异常跳过当前路径，并补不可读目录回归测试。
- **解决记录**：2026-05-20 Scanner / Adapter 小修完成。验证：`npm test -- tests/unit/adapters/framework.test.ts tests/unit/scanner/rules.test.ts tests/unit/adapters/framework/bmad/detector.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-019

- **标题**：Markdown 链接规则补齐通用 URI scheme 过滤
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-2 / Round 1-2 / 2026-05-07（R1-#2；Round 2 评估维持非阻塞）
- **涉及文件**：
  - `src/scanner/rules/markdown-link-rule.ts`
  - `tests/unit/scanner/rules.test.ts`
- **问题描述**：`MarkdownLinkRule` 曾只显式过滤 `http://` 和 `https://`，`mailto:`、`tel:`、`file:` 等其他 URI scheme 仍会继续进入路径解析分支；如果后续出现唯一后缀匹配，可能引入噪声关系。
- **处理方式**：`sanitizeReference()` 改为通用 URI scheme 检测，跳过所有非文件 URI；补充 `mailto:` / `tel:` / `file:` / 自定义 scheme 即使对应本地文件名也不生成关系的回归测试，同时保留普通含冒号文件名相对路径可解析。
- **解决记录**：2026-05-20 Scanner / Adapter 小修完成。验证：`npm test -- tests/unit/adapters/framework.test.ts tests/unit/scanner/rules.test.ts tests/unit/adapters/framework/bmad/detector.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-020

- **标题**：BMAD 检测器补局部文件系统容错与异常路径测试
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-3 / Round 1-2 / 2026-05-08（R1 发现；R2 评估维持非阻塞）
- **涉及文件**：
  - `src/adapters/framework/bmad/detector.ts`
  - `tests/unit/adapters/framework/bmad/detector.test.ts`
- **问题描述**：`hasBmadSkillsDirectory()` 和 `collectMarkdownCandidates()` 曾直接调用 `readdirSync()` / `lstatSync()`；当 skills 目录不可读、路径在遍历期间被删除或发生权限/竞态变化时，BMAD 检测可能直接抛出原生文件系统异常。
- **处理方式**：BMAD detector 对 skills 目录和 Markdown 候选遍历采用 best-effort skip 策略，局部 `lstat` / `readdir` 异常只跳过当前路径；补充 skills 路径是文件、候选目录不可读等异常路径测试。
- **解决记录**：2026-05-20 Scanner / Adapter 小修完成。验证：`npm test -- tests/unit/adapters/framework.test.ts tests/unit/scanner/rules.test.ts tests/unit/adapters/framework/bmad/detector.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-021

- **标题**：BMAD frontmatter 结束标记解析收窄为行级匹配
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 2-3 / Round 1-2 / 2026-05-08（R1 发现；R2 评估维持非阻塞）
- **涉及文件**：
  - `src/adapters/framework/bmad/detector.ts`
  - `tests/unit/adapters/framework/bmad/detector.test.ts`
- **问题描述**：`extractYamlFrontmatter()` 曾通过 `content.indexOf('\n---', 4)` 查找结束标记，没有保证结束分隔符独占一行；`---not-a-delimiter`、尾随文本或 CRLF 边界仍可能被误当作合法 frontmatter 结束点，进而制造 `bmad-frontmatter` 误检信号。
- **处理方式**：frontmatter 提取改为行级分隔符匹配，仅接受开头独立 `---` 与后续独立 `---` 结束行，并兼容 LF / CRLF；补充 `---not-a-delimiter` 反例与 CRLF 正例测试。
- **解决记录**：2026-05-20 Scanner / Adapter 小修完成。验证：`npm test -- tests/unit/adapters/framework.test.ts tests/unit/scanner/rules.test.ts tests/unit/adapters/framework/bmad/detector.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-029

- **标题**：导出快照排序稳定性加固
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 3-4 / Round 1-4 / 2026-05-12~2026-05-13（R1 发现 #3；R2-R4 维持非阻塞）
- **涉及文件**：
  - `src/services/export-service.ts`
  - `tests/unit/services/export-service.test.ts`
- **问题描述**：`src/services/export-service.ts` 曾使用未固定 locale/options 的 `localeCompare()` 对 `documents` 和 `relations` 排序；`tests/unit/services/export-service.test.ts` 也只覆盖简单 ASCII 路径和 ID，尚未锁定大小写、数字段与非 ASCII 输入。该问题不会改变导出内容本身，但会让同一图谱在不同 Node/ICU/locale 环境下生成无意义 diff，削弱 git 审阅快照的稳定性。
- **处理方式**：`ExportService` 改为使用 `<` / `>` 显式二进制字符串比较排序 documents 与 relations，避免 locale-sensitive diff；补充大小写、数字段和非 ASCII 路径/ID 排序回归测试。
- **解决记录**：2026-05-20 批次 6 导出可靠性治理完成。验证：`npm test -- tests/unit/services/export-service.test.ts tests/unit/cli/commands/export.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-030

- **标题**：快照写入原子性与覆盖语义加固
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 3-4 / Round 1-4 / 2026-05-12~2026-05-13（R1 defer；R2-R4 维持非阻塞）
- **涉及文件**：
  - `src/services/export-service.ts`
  - `tests/unit/services/export-service.test.ts`
- **问题描述**：`src/services/export-service.ts` 曾直接覆盖写入目标文件，缺少原子写入保护，也没有把“已有目标文件时是否允许覆盖、如何覆盖”的行为固化为明确测试契约。当前实现满足 Story 3-4 主路径，但在异常中断或后续扩展输出策略时，容易出现半写入文件、覆盖语义漂移或回归测试盲区。
- **处理方式**：导出写入改为目标同目录临时文件 + `rename()` 原子替换；已存在快照允许被原子覆盖，临时写失败时保留旧快照并 best-effort 清理临时文件；补充覆盖成功与临时写失败保留旧文件测试。
- **解决记录**：2026-05-20 批次 6 导出可靠性治理完成。验证：`npm test -- tests/unit/services/export-service.test.ts tests/unit/cli/commands/export.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-031

- **标题**：导出路径边界剩余硬化
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 3-4 / Round 2-4 / 2026-05-13（R2 defer；R3-R4 维持非阻塞）
- **涉及文件**：
  - `src/cli/commands/export.ts`
  - `tests/unit/cli/commands/export.test.ts`
- **问题描述**：Story 3-4 已补齐 POSIX 项目外路径与 win32 跨盘符/UNC 的词法边界校验，但 CR 仍保留三类非阻塞硬化点：symlink 物理逃逸场景、UNC `projectRoot` 组合场景，以及 `--output snapshots/` 这类目录形态输入的明确语义与回归测试。当前入口层已覆盖主要交付门禁，但这些剩余边界若长期不固化，后续继续演进导出路径逻辑时容易再次引入文件系统边界漂移。
- **处理方式**：CLI `--output` 对目录形态输入追加默认 `cord-snapshot.json`；保留 POSIX/win32 词法边界检查，并新增已存在输出祖先目录的 `realpath` 物理边界检查，拒绝 symlink 指向 project-root 外；补充 win32 UNC projectRoot 内部路径、目录形态输出和 symlink 物理逃逸回归测试。
- **解决记录**：2026-05-20 批次 6 导出可靠性治理完成。验证：`npm test -- tests/unit/services/export-service.test.ts tests/unit/cli/commands/export.test.ts`、`npm run type-check -- --pretty false`、`npm run lint` 通过。

---

### TODO-026

- **标题**：relationType 级传播方向矩阵显式建模
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：other
- **来源**：Story 3-3 / Round 2-3 / 2026-05-11~2026-05-12（R2-TODO-1；R3 维持非阻塞）
- **涉及文件**：
  - `src/services/impact-service.ts`
  - `src/types/relations.ts`
  - `tests/unit/services/impact-service.test.ts`
- **问题描述**：Story 3-3 当前已按 CR 裁定采用统一的 `source -> target` 有向传播语义，足以满足本轮交付；但 `must_consistent`、`context_for` 等 relationType 是否应与 `sync_required` 共享同一传播方向，仍未被显式建模。若后续继续扩展 `ImpactService` 能力而不先定义 relationType 级传播矩阵，容易再次出现“实现先行、语义后补”的歧义，导致新 Story 对影响范围的理解不一致。
- **处理方式**：在 `src/types/relations.ts` 增加 `RELATION_IMPACT_PROPAGATION_MATRIX`，冻结 v0.1 所有内置 relationType 均按 source -> target 且仅 active 可传播；`ImpactService` 改为读取矩阵执行传播资格判断，并补 `derived_from` / `contains` 与 deprecated status 混合回归测试。
- **解决记录**：2026-05-20 批次 5 Impact 传播语义治理完成。验证：`npm test -- tests/unit/services/impact-service.test.ts tests/unit/services/status-service.test.ts` 与 `npm run type-check -- --pretty false` 通过。

---

### TODO-033

- **标题**：status 健康统计是否排除 deprecated 关系需独立冻结
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：other
- **来源**：Story 3-5 / Round 2 / 2026-05-14（已知非阻塞观察项）
- **涉及文件**：
  - `src/services/status-service.ts`
  - `src/types/graph.ts`
  - `tests/unit/services/status-service.test.ts`
  - `_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md`
- **问题描述**：`src/services/status-service.ts` 当前按全部关系数组计算 `relationCount` 与 `relationsByType`，而 `src/types/graph.ts` 中 `RelationEdge.status` 已定义 `active | deprecated`。Story 3.5 的 AC 只要求输出“关系总数、按类型分布”，尚未冻结 status 健康统计是否应排除 deprecated 关系；如果后续在无产品/Story 裁决的情况下直接调整实现，容易让 status 输出、测试断言和 Epic 4 的关系管理语义再次漂移。
- **处理方式**：裁决 `StatusService` 是持久化图谱库存与健康快照，`relationCount`、`relationsByType`、`staleRelations`、`orphanedNodes`、`danglingEdges` 均按 active + deprecated 全量关系口径计算；同步 Story 3.5 与 Rule Document Registry 三份规则文档，并补 active + deprecated 混合状态测试。
- **解决记录**：2026-05-20 批次 5 status 健康统计口径治理完成。验证：`npm test -- tests/unit/services/impact-service.test.ts tests/unit/services/status-service.test.ts` 与 `npm run type-check -- --pretty false` 通过。

---

### TODO-028

- **标题**：只读命令默认 service 创建 `.cord` 副作用
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 3-3 / Round 2-3 / 2026-05-11~2026-05-12（R2-TODO-3；R3 维持非阻塞）
- **涉及文件**：
  - `src/cli/commands/query.ts`
  - `src/cli/commands/impact.ts`
  - `src/cli/commands/export.ts`
  - `tests/unit/cli/commands/query.test.ts`
  - `tests/unit/cli/commands/impact.test.ts`
  - `tests/unit/cli/commands/export.test.ts`
- **问题描述**：`impact` 这类读取/分析命令在默认 serviceFactory 路径下会 `mkdirSync('.cord')` 并打开/创建数据库；后续复查也确认 `query` 存在同类初始化模式。虽然该行为不阻塞当前 Story 验收，但会让只读命令产生本地状态副作用，并掩盖“数据库未初始化 / 尚未扫描”的真实诊断语义，后续若继续新增只读命令，体验和错误契约会持续漂移。
- **处理方式**：`query` / `impact` / `export` 默认 service factory 改为先检查现有 `.cord/cord.db`，不存在时抛稳定 `ConfigError`（`CORD_CONFIG_011`），不再创建 `.cord` 或空数据库；空图谱仍由 service 层返回 `CORD_QUERY_001`，保留“未初始化”和“已初始化但未扫描到该文档”的诊断边界。
- **解决记录**：2026-05-20 批次 4 只读命令副作用治理完成。验证：未初始化项目执行默认 `query` / `impact` / `export` 不创建 `.cord`；空图谱 `query` / `impact` 返回 `CORD_QUERY_001`。

---

### TODO-032

- **标题**：非法 projectName 配置错误路径副作用测试
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 3-4 / Round 4 / 2026-05-13（R4 defer）
- **涉及文件**：
  - `src/services/export-service.ts`
  - `src/cli/commands/export.ts`
  - `tests/unit/services/export-service.test.ts`
  - `tests/unit/cli/commands/export.test.ts`
- **问题描述**：当 `cord.config` 中的 `projectName` 非法时，`ExportService` 目前会先读取 repository 中的 documents/relations，再在 `loadConfig(projectRoot)` 处抛出 `ConfigError`；CLI 默认路径下也可能先创建 `.cord` 并初始化 repository，之后才以退出码 2 失败。该行为被 CR 正确降级为“配置错误路径”的非阻塞观察，但当前仍缺少对退出码、错误输出、是否创建 `.cord`、是否提前读取 repository 等副作用的明确测试保护。
- **处理方式**：`ExportService.buildSnapshot()` 先解析项目配置再读取 repository；CLI `export` 在创建默认 service 前先执行配置校验。补充 service 测试断言非法 `projectName` 不读取 documents/relations，CLI 测试断言非法配置不调用 serviceFactory 且不创建 `.cord`。
- **解决记录**：2026-05-20 批次 4 只读命令副作用治理完成。验证：`npm test -- tests/unit/cli/commands/query.test.ts tests/unit/cli/commands/impact.test.ts tests/unit/cli/commands/export.test.ts tests/unit/services/export-service.test.ts` 通过。

---

### TODO-006

- **标题**：schema 时间字段缺 ISO 8601 约束；document.path / scan.projectRoot 缺路径格式约束
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-3 / Round 1 / 2026-04-27（发现 #3；Round 2、Round 3 均维持非阻塞）
- **涉及文件**：
  - `src/schemas/document.ts`
  - `src/schemas/scan-input.ts`
  - `tests/unit/schemas/document.test.ts`
  - `tests/unit/schemas/scan-input.test.ts`
- **问题描述**：`createdAt`/`updatedAt` 仅用 `z.string().min(1)` 校验，未约束 ISO 8601 格式（应改为 `z.string().datetime()`）；`document.path` 未约束相对路径语义；`scan.projectRoot` 未约束绝对路径语义。非法时间戳会污染排序和增量扫描判断，非法路径会破坏以路径为主键的查询/缓存键值一致性。
- **处理方式**：`documentSchema` 将 `createdAt` / `updatedAt` 收紧为 ISO 8601 datetime；`document.path` 收紧为 normalized project-relative POSIX path，拒绝绝对路径、Windows/UNC 路径、反斜杠和 `..` 逃逸；`scanInputSchema.projectRoot` 收紧为跨平台绝对路径，保留 POSIX / Win32 absolute 支持。
- **解决记录**：2026-05-20 批次 3 Schema 与错误契约修复完成。验证：`npm test -- tests/unit/schemas/document.test.ts tests/unit/schemas/scan-input.test.ts tests/unit/repositories/mappers.test.ts` 通过。

---

### TODO-011

- **标题**：Mapper 错误缺少统一仓储层错误类型（`RepositoryError`），上层只能字符串匹配错误类别
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 3 / 2026-04-28（发现 #2）
- **涉及文件**：
  - `src/repositories/mappers.ts`
  - `tests/unit/repositories/mappers.test.ts`
- **问题描述**：`mappers.ts` 中 JSON/枚举校验失败时直接 `throw new Error(...)`，缺少统一的 `RepositoryError` / `StorageError` 类型，上层如需稳定识别"数据损坏 / 枚举越界 / metadata 解析失败"等错误类别，只能依赖字符串匹配。这会弱化后续 CLI、日志与诊断体验的一致性，也让错误类型的集成测试缺乏稳定断言点。
- **处理方式**：mapper JSON metadata 解析/形态错误统一抛 `StorageError` + `CORD_STORAGE_001`；关系与同步状态枚举损坏统一抛 `StorageError` + `CORD_STORAGE_002`；错误 context 保留 `table` / `id` / `column` / `reason` / `allowedValues` 等结构化字段，测试覆盖 code、suggestion 与 context。
- **解决记录**：2026-05-20 批次 3 Schema 与错误契约修复完成。验证：`npm test -- tests/unit/schemas/document.test.ts tests/unit/schemas/scan-input.test.ts tests/unit/repositories/mappers.test.ts` 通过。

---

### TODO-007

- **标题**：旧库升级路径未走 002 增量迁移（pre-release schema 直接重写约定文档化）
- **状态**：resolved
- **优先级**：P2（首个稳定 release 前处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #1）
- **涉及文件**：
  - `src/repositories/migrations/003-fix-v1-baseline.ts`
  - `src/repositories/migrations/runner.ts`
  - `tests/unit/repositories/sqlite-graph-repository.test.ts`
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
- **问题描述**：v0.1 pre-release 阶段多次对 `001-initial-schema` 直接重写（Round 1：唯一索引加 source 维度 + relations.source/status CHECK 约束；Round 3：relations.relation_type CHECK 约束），均未新增 `002` 增量迁移。`runMigrations` 的幂等跳过机制意味着「已跑过旧版 v1」的本地开发库无法自动升级到含完整约束的新 schema。当前 v0.1 pre-release 无任何在野老库，场景不成立。
- **处理方式**：新增 `003-fix-v1-baseline.ts` 内联 TS 迁移，覆盖旧 v1 baseline 的 `relations.relation_type/source/status` CHECK、`sync_states.status` CHECK，以及 `idx_relations_unique_pair` source 维度；迁移按 schema 探测独立补齐表约束与索引，runner 注册 version 3；Rule Document Registry 三份规则文档同步记录 v0.1 pre-release baseline 与稳定版后只增不改策略。
- **解决记录**：2026-05-20 批次 2 仓储防御修复完成。验证：新增旧 v1 baseline 升级测试，断言 version=3、约束/索引补齐且数据保留。

---

### TODO-008

- **标题**：`parseJsonMetadata` 未校验解析结果必须是非 null 对象（不含数组、原始值）
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #3）
- **涉及文件**：
  - `src/repositories/mappers.ts`
  - `tests/unit/repositories/mappers.test.ts`
- **问题描述**：`parseJsonMetadata` 仅做 `JSON.parse(raw) as Record<string, unknown>`，未校验解析结果的形态。`[]`、`123`、`"text"`、`null` 等合法 JSON 值会被错误地伪装成对象穿透；写入端（`documentToRow` / `relationToRow`）同样未做对称形态约束，只在读取端防守存在「只防读、不防写」的不对称性。
- **处理方式**：新增 `assertMetadataObject()` 与 `serializeMetadata()`，读写两端都拒绝顶层 `null`、数组和原始值 metadata，仅允许非 null object；补充读端非对象 JSON 与写端 array metadata 回归测试。
- **解决记录**：2026-05-20 批次 2 仓储防御修复完成。验证：`npm test -- tests/unit/repositories/mappers.test.ts tests/unit/repositories/sqlite-graph-repository.test.ts` 通过。

---

### TODO-009

- **标题**：`updateDocument` / `updateRelation` 未过滤 `undefined` 字段，可能误清空可选列
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #4）
- **涉及文件**：
  - `src/repositories/sqlite-graph-repository.ts`
  - `tests/unit/repositories/sqlite-graph-repository.test.ts`
- **问题描述**：`updateDocument` 与 `updateRelation` 在 spread 时不过滤 `undefined`：若调用方显式传 `{ title: undefined }`，会覆盖 `existing.title` 为 `undefined`，最终 mapper 转为 `null` 写库；若 `path`（NOT NULL 列）被传 `undefined`，会触发约束错误。TypeScript `Partial<T>` 允许 `undefined`，但当前实现未对此做防御。
- **处理方式**：新增 `removeUndefinedProperties()`，在 `updateDocument()` / `updateRelation()` merge 前过滤显式 `undefined` 字段；补充文档与关系更新回归测试，断言已有值不会被清空。
- **解决记录**：2026-05-20 批次 2 仓储防御修复完成。验证：`npm test -- tests/unit/repositories/mappers.test.ts tests/unit/repositories/sqlite-graph-repository.test.ts` 通过。

---

### TODO-010

- **标题**：迁移行为 AC 测试证据不足（未直接断言迁移版本记录、失败回滚、WAL 模式）
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 1-4 / Round 2 / 2026-04-28（发现 #5）
- **涉及文件**：
  - `tests/unit/repositories/sqlite-graph-repository.test.ts`
- **问题描述**：迁移测试缺少对 `schema_migrations` 版本记录/幂等、迁移失败回滚、WAL 模式的直接证据。
- **处理方式**：补充临时文件 DB 二次连接断言 `schema_migrations` 版本 `[1,2,3]` 且不重复；构造非法旧库触发 003 迁移失败，断言 version 3 未记录、原 relations 表数据仍在且无 backup table 泄漏；改 WAL 测试为直接 `PRAGMA journal_mode` 断言 `wal`。
- **解决记录**：2026-05-20 批次 2 仓储防御修复完成。验证：`npm test -- tests/unit/repositories/mappers.test.ts tests/unit/repositories/sqlite-graph-repository.test.ts` 通过。

---

### TODO-001

- **标题**：CLI 与包根导出职责分离 + 二进制 smoke test
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：refactor
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #1 衍生）
- **涉及文件**：
  - `package.json`
  - `src/index.ts`
  - `tsup.config.ts`
  - `.github/workflows/ci.yml`
  - `.github/workflows/release.yml`
- **问题描述**：`package.json` 中 `bin.cord` 与 `exports["."]` 同时指向 `dist/cli/index.js`，CLI 可执行入口与包根导出职责混用。此外缺少对已构建 CLI 二进制的 smoke test（如 `node dist/cli/index.js --version`）。
- **处理方式**：新增包根 `src/index.ts` 公共导出入口，`tsup` 同时构建 `dist/index.js` 与 CLI/MCP 入口；`package.json` 将 `exports["."]` 指向 `dist/index.js` / `dist/index.d.ts`，`bin.cord` 保持指向 `dist/cli/index.js`；新增 `npm run smoke:bin` 并接入 CI / Release。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。验证：`npm run build` 生成 `dist/index.js` / `dist/index.d.ts`，`npm run smoke:bin` 输出 `0.1.0`。

---

### TODO-002

- **标题**：缺少 `prepack`/`prepublishOnly` 与 tarball 校验
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #2）
- **涉及文件**：
  - `package.json`
  - `.github/workflows/release.yml`
- **问题描述**：`package.json` 的 `scripts` 中无 `prepack`、`prepare` 或 `prepublishOnly` 钩子。`dist/` 被 `.gitignore` 排除，仅靠 `files: ["dist"]` 声明白名单，不触发构建，存在发布时产物为空的风险。
- **处理方式**：新增 `prepack` 自动构建、`pack:check` 执行 `npm pack --dry-run`，并在 release workflow 中发布前执行 tarball 校验。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。验证：`npm run pack:check` 成功，tarball 包含 `dist/index.js`、`dist/cli/index.js`、`dist/mcp/server.js` 及对应 `.d.ts`。

---

### TODO-003

- **标题**：type-check 未覆盖 `tests/` 与配置文件
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：test-gap
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #3）
- **涉及文件**：
  - `package.json`
  - `tsconfig.check.json`
  - `src/schemas/query-input.ts`
  - `src/schemas/scan-input.ts`
  - `tests/`
- **问题描述**：`tsconfig.json` 的 `include` 仅覆盖 `src/**/*.ts`，`tests/`、`tsup.config.ts`、`vitest.config.ts` 均被排除，导致 `npm run type-check` 无法检测这些文件中的类型错误。
- **处理方式**：新增 `tsconfig.check.json` 覆盖 `src/**/*.ts`、`tests/**/*.ts`、`tsup.config.ts`、`vitest.config.ts`，并将 `npm run type-check` 切换到该配置；修正测试 mock 类型与 Zod default schema 输入/输出类型边界。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。验证：`npm run type-check -- --pretty false` 通过。

---

### TODO-012

- **标题**：Release 工作流未显式依赖 CI 质量门禁成功
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 1-5 / Round 1-3 / 2026-04-30（R1 发现 #2；R2、R3 维持非阻塞）
- **涉及文件**：
  - `.github/workflows/release.yml`
  - `.github/workflows/ci.yml`
- **问题描述**：`release.yml` 由 `push` 到 `main` 直接触发，未通过 `workflow_run`、同工作流 `needs` 或等效机制等待 lint / type-check / test / coverage 成功。主分支提交若能 build 但未通过质量门禁，仍可能进入 semantic-release 发布链路。
- **处理方式**：release workflow 改为监听 `CI` 的 `workflow_run`，仅在 main 分支 CI `conclusion == 'success'` 后执行发布；CI 同步加入 build 和 CLI binary smoke test。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。验证：`.github/workflows/release.yml` 已使用 `workflow_run` + success gate；本地 `npm run lint`、`npm run type-check`、`npm run test:coverage`、`npm run build`、`npm run smoke:bin` 均通过。

---

### TODO-013

- **标题**：AC-2 npm provenance 配置落点措辞需与实现口径统一
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：other
- **来源**：Story 1-5 / Round 1-3 / 2026-04-30（R1 发现 #1；R2、R3 维持非阻塞）
- **涉及文件**：
  - `_bmad-output/implementation-artifacts/stories/1-5-ci-cd-pipeline-and-quality-gates.md`
- **问题描述**：Story AC-2 表述为“在 `npmPublish` 配置中启用 provenance”，容易被理解为 `@semantic-release/npm` 插件存在 `provenance` 配置项；实际实现和 Dev Notes 使用 `NPM_CONFIG_PROVENANCE: true` + `permissions.id-token: write`，这是 npm CLI / semantic-release 的正确落点。该歧义会导致后续 CR 将正确实现误判为规格不一致。
- **处理方式**：同步 Story 1.5 AC / Task / Dev Notes，将 provenance 口径统一为通过 release workflow 环境变量 `NPM_CONFIG_PROVENANCE=true` 与 OIDC 权限启用；现有全局规则文档已包含等价约束，本次无需新增规则。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。

---

### TODO-014

- **标题**：Release workflow 缺少 `concurrency` 串行发布保护
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-5 / Round 1-3 / 2026-04-30（R1 发现 #3；R2、R3 维持非阻塞）
- **涉及文件**：
  - `.github/workflows/release.yml`
- **问题描述**：`release.yml` 缺少 `concurrency` 配置。连续合并或短时间多次 push 到 `main` 时，多个 semantic-release job 可能并发运行，造成版本计算冲突、标签竞争或重复发布失败。
- **处理方式**：release workflow 添加 `concurrency`，按 `release-${{ github.event.workflow_run.head_branch }}` 分组，并设置 `cancel-in-progress: false`。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。

---

### TODO-015

- **标题**：`[skip ci]` release 跳过条件过宽
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-5 / Round 2-3 / 2026-04-30（R2 发现 #2；R3 维持非阻塞）
- **涉及文件**：
  - `.github/workflows/release.yml`
- **问题描述**：当前 release job 使用 `contains(github.event.head_commit.message, '[skip ci]')` 跳过整个发布流程，没有限定 commit 必须是 semantic-release 生成的 `chore(release):` 版本提交或 bot actor。普通主干提交消息若包含 `[skip ci]`，可能静默跳过合法发布。
- **处理方式**：移除基于任意提交消息 `[skip ci]` 的 release 跳过条件；release 现在仅由 CI 成功的 `workflow_run` 触发，semantic-release 版本提交中的 `[skip ci]` 不再作为 release job 的宽泛 gate。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。

---

### TODO-016

- **标题**：PR 模板未显式列出覆盖率验证命令
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：test-gap
- **来源**：Story 1-5 / Round 3 / 2026-04-30（发现 #1）
- **涉及文件**：
  - `.github/PULL_REQUEST_TEMPLATE.md`
- **问题描述**：PR 模板已有“覆盖率未下降（≥ 80%）”勾选项，但未写出项目实际覆盖率命令 `npm run test:coverage`。贡献者可能只执行 `npm test` 与 lint/type-check，未在本地复现覆盖率门禁；CI 会兜底，但本地验收动作与 AC-7 不完全一致。
- **处理方式**：PR 模板测试清单中的覆盖率项补充实际命令 `npm run test:coverage`。
- **解决记录**：2026-05-19 批次 1 发布门禁修复完成。

---

### TODO-034

- **标题**：Story 5.1 DTO 示例需与 MCP 共享契约同步
- **状态**：resolved
- **优先级**：P2（Epic 内处理）
- **类别**：tech-debt
- **来源**：Story 5-1 / Round 1 / 2026-05-17（reviewer 发现 #1；evaluator accepted as deferred）
- **涉及文件**：
  - `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md`
  - `src/mcp/tools/schemas.ts`
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
- **问题描述**：Story 5.1 中的历史 DTO 示例曾与当前共享契约不一致：`QueryRelationsInput` 示例缺少 `depth`；`AnalyzeImpactResult` / `InitGraphResult` 示例仍包含旧字段或旧别名，且缺少 `severity`、`hopDistance`、`durationMs`。
- **处理方式**：已按 `src/mcp/tools/schemas.ts` 和现有 Rule Document Registry 镜像规则同步 Story 5.1 DTO 示例；全局规则文档本身无需更新。
- **解决记录**：2026-05-19 已按用户确认的 CR rules extractor 方案 2 同步 `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md` 中的 DTO 示例：补齐 `QueryRelationsInput.depth`、`QueryRelationsResult.hopDistance`、`AnalyzeImpactResult.severity` / `hopDistance`，并将 `InitGraphResult.duration` 更新为 `durationMs`。全局规则文档已存在等价约束，本次未修改。

---

### TODO-004

- **标题**：MCP 入口为静默空实现，缺少防御性占位输出
- **状态**：resolved
- **优先级**：P3（择机处理）
- **类别**：tech-debt
- **来源**：Story 1-1 / Round 1 / 2026-04-26（发现 #4）
- **涉及文件**：
  - `src/mcp/server.ts`
- **问题描述**：`src/mcp/server.ts` 曾为仅含注释的占位文件，构建后 `node dist/mcp/server.js` 静默退出（exit code 0），运维层面难以区分"正常启动"与"空实现静默退出"。
- **处理方式**：Story 5-1 已实现真实 MCP Server 入口，包含 stdio transport 启动路径、MCP tool 注册、stderr 运行日志和 SIGTERM/SIGINT 优雅退出处理。
- **解决记录**：2026-05-19 按 CR TODO Tracker 对 Story 5-1 的相关待办检查结果标记 resolved；实现证据位于 `src/mcp/server.ts`，测试证据覆盖 `tests/unit/mcp/server.test.ts` 与 `tests/integration/mcp/server.test.ts`。
