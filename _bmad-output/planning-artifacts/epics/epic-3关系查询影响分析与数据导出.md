# Epic 3：关系查询、影响分析与数据导出

用户可以通过 `cord query` 查询任意文档的关联关系（支持类型过滤、多跳遍历），通过 `cord impact` 获取文档变更的影响分析（受影响文档列表 + 传播行为类型 + 建议动作），通过 `cord export` 导出 JSON 快照，通过 `cord status` 查看图谱健康状态。

## Story 3.1：QueryService 关系查询（一跳 + 类型过滤）

As a 用户，
I want 通过 `cord query <doc>` 查询指定文档的所有关联关系，
So that 我可以了解某份文档与哪些其他文档有关联、关系类型是什么。

**Acceptance Criteria:**

**Given** 已有通过 `cord scan` 建立的关系图谱
**When** 执行 `cord query <doc>`
**Then** `src/services/query-service.ts` 实现一跳关系查询（FR13），返回所有直接关联的文档列表
**And** 每条结果包含：目标文档路径、关系类型、置信度分数、关系来源
**And** 支持 `--type <relation_type>` 按关系类型过滤结果（FR14）
**And** `src/cli/commands/query.ts` 实现 `cord query` CLI 命令（薄壳）
**And** CLI 默认输出人类可读表格格式
**And** 支持 `--json` 输出机器可读 JSON
**And** 一跳关系查询响应时间 p95 < 1ms（NFR1，2000 文档 / 50000 关系规模）
**And** 查询不存在的文档时返回明确的错误信息（含错误码 + 建议操作，NFR19）
**And** 单元测试 + 集成测试：正常查询 + 类型过滤 + 空结果 + 文档不存在

## Story 3.2：多跳关系遍历

As a 用户，
I want 查询指定文档的二跳、三跳间接关联关系，
So that 我可以了解更深层的文档依赖链路。

**Acceptance Criteria:**

**Given** Story 3.1 的一跳查询已就绪
**When** 执行多跳查询
**Then** QueryService 支持 `--depth <N>` 参数控制遍历深度（1/2/3 跳，默认 1）（FR16）
**And** 使用 BFS 算法实现图遍历，结果按距离排序
**And** 结果中标注每条关系的跳数距离
**And** 三跳关系遍历响应时间 p95 < 5ms（NFR2，2000 文档 / 50000 关系规模）
**And** 从 200 文档扩展到 2000 文档时查询性能退化不超过 10%（NFR7）
**And** 单元测试：BFS 遍历正确性 + 深度限制 + 环路处理 + 性能基准

## Story 3.3：ImpactService 变更影响分析

As a 用户，
I want 通过 `cord impact <doc>` 获取文档变更的完整影响分析，
So that 我可以在修改文档前了解哪些关联文档会受到影响，以及应该采取什么动作。

**Acceptance Criteria:**

**Given** Story 3.2 的多跳遍历已就绪
**When** 执行影响分析
**Then** `src/services/impact-service.ts` 实现变更影响分析（FR15）
**And** 结果包含：受影响文档路径、关系类型、传播行为类型、建议动作（FR17）
**And** 建议动作根据传播行为类型自动推导（如 sync_required → "需要同步更新"、context_for → "仅供参考"）
**And** 影响分析默认过滤置信度 ≥ 0.50 的关系（FR11），可通过配置调整
**And** `src/cli/commands/impact.ts` 实现 `cord impact` CLI 命令（薄壳）
**And** CLI 默认输出人类可读表格（按影响严重程度排序）
**And** 支持 `--json` 输出 JSON
**And** 单元测试 + 集成测试：正常影响分析 + 置信度过滤 + 空影响 + 各传播行为类型的建议动作验证

## Story 3.4：JSON 快照导出

As a 用户，
I want 通过 `cord export` 将完整关系图谱导出为 JSON 快照文件，
So that 我可以将图谱快照提交到 git 供团队审阅。

**Acceptance Criteria:**

**Given** 已有关系图谱数据
**When** 执行导出
**Then** `src/services/export-service.ts` 实现 JSON 快照导出（FR26）
**And** 导出格式包含 `schemaVersion` 字段（值为 "1.0"）（NFR14）
**And** 导出格式包含 `exportedAt`（ISO 8601）、`project` 名称、`documents` 数组、`relations` 数组
**And** JSON 字段使用 camelCase，null 值保留不省略（P10）
**And** `src/cli/commands/export.ts` 实现 `cord export` CLI 命令
**And** 导出文件默认输出到项目根目录
**And** 单元测试：导出格式验证 + schemaVersion 字段存在 + 空图谱导出

## Story 3.5：StatusService 健康检查

As a 用户，
I want 通过 `cord status` 查看当前项目的 CORD 配置状态和图谱健康信息，
So that 我可以了解图谱的整体状况——有多少文档、多少关系、是否有过时或不一致的数据。

**Acceptance Criteria:**

**Given** 已有 CORD 配置和关系图谱
**When** 执行健康检查
**Then** `src/services/status-service.ts` 实现健康检查（FR5）
**And** 输出包含：文档总数、关系总数、按关系类型的分布统计、最后扫描时间
**And** 检测并报告过时关系（关联文档 mtime 新于关系创建时间）
**And** 检测并报告潜在不一致（孤立节点、悬空关系边）
**And** 显示当前 schema 版本号（D2）
**And** `src/cli/commands/status.ts` 实现 `cord status` CLI 命令
**And** CLI 输出人类可读的仪表盘式摘要
**And** 支持 `--json` 输出
**And** 单元测试：正常健康检查 + 有过时关系时的报告 + 空图谱

---
