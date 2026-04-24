# Epic 4：关系管理与图谱修正

用户可以手动添加、移除或标记关系为 deprecated。系统记录关系来源和修改历史，增量扫描时保护手动修正（收敛机制），支持按文档类别配置更新策略。图谱准确度随使用自然收敛。

## Story 4.1：RelationService 手动添加与移除关系

As a 用户，
I want 手动添加文档间的关系或移除/标记已有关系为 deprecated，
So that 我可以修正自动扫描的误判（假阳性和假阴性），让图谱更准确。

**Acceptance Criteria:**

**Given** 已有关系图谱
**When** 手动管理关系
**Then** `src/services/relation-service.ts` 实现手动添加关系（FR18）——指定源文档、目标文档、关系类型
**And** 支持移除关系（硬删除，不保留历史记录）或标记关系为 deprecated（FR19）
**And** deprecated 操作保留原 `relationType`，通过独立的 `status: 'deprecated'` 状态位标记（不改变关系类型字段）
**And** 手动添加的关系来源标记为"手动添加"（FR21）
**And** 手动修改的关系记录修改历史（FR21）——仅对 `status='active'` 的关系有效，`removeRelation` 硬删除不保留历史
**And** 添加关系时验证源文档和目标文档路径存在于图谱中
**And** 添加重复关系时返回明确提示（不重复创建）
**And** 所有错误信息遵循 `[错误码] 描述 → 建议` 格式（NFR19）
**And** 单元测试：添加/移除/deprecated 正常路径 + 文档不存在 + 重复关系 + 来源和历史记录验证 + deprecated 状态保留原 relationType

## Story 4.2：收敛保护机制与来源优先级

As a 用户，
I want 增量扫描时系统保护我手动修正过的关系，
So that 自动扫描不会覆盖我的手动修正，图谱准确度随使用自然收敛。

**Acceptance Criteria:**

**Given** Story 4.1 的关系管理能力和 Story 2.6 的增量扫描已就绪
**When** 执行增量扫描
**Then** 手动添加的关系不被自动删除（FR22）
**And** 手动标记为 deprecated（`status='deprecated'`）的关系不被自动恢复（FR22）
**And** 优先级规则：手动修正 > 框架预设 > 自动扫描发现（FR22）
**And** 关系来源区分三种类型：自动扫描（auto_scan）/ 手动添加（manual）/ 框架预设（framework_preset）
**And** source 文档被修改时，其 manual outgoing 边仍然保留，不被增量扫描删边流程删除（FR22）
**And** `cord scan --rebuild` 执行前，若库中存在 manual 关系，必须输出警告并要求用户确认
**And** `cord scan --rebuild --force` 跳过确认，但仍提示已删除 manual 关系数量
**And** 本 Story 实现不破坏新增 relationType 时已有数据无需迁移即可正常查询的保证（NFR9 非回归验证）
**And** 单元测试 + 集成测试：手动关系在增量扫描后保持不变 + deprecated 关系不恢复 + 优先级冲突场景 + source 文档修改后 manual 边保留 + rebuild 警告确认流程

## Story 4.3：文档类别更新策略配置

As a 用户，
I want 按文档类别配置不同的更新策略，
So that 影响分析结果能体现对应文档的更新策略元数据，支持后续编排决策（v0.1 仅返回策略，不自动触发同步执行）。

**Acceptance Criteria:**

**Given** Story 4.1 的关系管理和配置系统已就绪
**When** 配置更新策略
**Then** 支持三种更新策略：自动更新 / 生成建议后人工确认 / 仅记录不触发（FR23）
**And** 策略可通过 cord.config 按文档类别（如 prd、architecture、story 等）配置
**And** 未配置的文档类别使用默认策略（生成建议后人工确认）
**And** 影响分析结果中体现对应文档的更新策略元数据（只读输出，v0.1 不自动执行编排）
**And** 单元测试：三种策略各自生效 + 默认策略回退 + 配置覆盖

---
