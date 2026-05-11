---
Story: 3-1
Round: 1
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Review Source: 3-1-code-review-summary-20260509-round-1.md
Review Model: GitHub Copilot (model id not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-1 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 3 条低严重度 patch 发现，分别涉及 QueryInput 类型契约、CLI 输入校验顺序、查询路径规范化。经代码验证，3 条发现均为有效问题，均不构成安全、数据完整性或主路径功能阻塞；建议作为 P2 非阻塞修复项纳入 CR TODO 或后续小补丁处理。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[低] 关系类型 schema 通过 Object.values 退化为 string 类型契约**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`src/schemas/query-input.ts:12` 将 `Object.values(RELATION_TYPES)` 显式断言为 `[string, ...string[]]`，随后 `src/schemas/query-input.ts:20` 用该值构造 `z.enum(relationTypeValues)`，`src/schemas/query-input.ts:27` 再从 schema 推导 `QueryInput`。由于元组元素类型已被拓宽为 `string`，Zod 的类型推导无法保留 `RelationType` 字面量联合，审查指出的编译期契约退化成立。`src/types/relations.ts:8-29` 已有 `RELATION_TYPES as const` 和 `RelationType` 联合类型，说明更严格的类型来源本来存在但未被 schema 保留。

现有测试 `tests/unit/schemas/query-input.test.ts:34-35` 只验证运行时拒绝无效 relation type，未包含类型层断言，因此不能覆盖该问题。

**严重性判断：合理**

运行时 `z.enum` 仍会校验枚举值，功能主路径不受影响；风险主要是调用方在编译期失去 `RelationType` 反馈。因此原审查标为低严重度合理，评估为 P2。

**修复建议：可行**

复用保留字面量的关系类型元组或以明确的 `RelationType` 元组作为 schema 输入是可行方案；同时补充类型层测试/断言可以防止回归。

**误报评估：非误报**

问题由显式 `[string, ...string[]]` 断言直接导致，且现有测试未验证编译期类型契约，非误报。

---

## 发现 #2 评估

### 审查原文

> **[低] 无效 --type 会先初始化数据库再触发 schema 校验**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`src/cli/commands/query.ts:51` 先执行 `serviceFactory(projectRoot)`，`src/cli/commands/query.ts:52-56` 才把 `docPath/type/includeDeprecated` 传入 `service.query(...)`。实际输入校验发生在 `QueryService.query()` 内部的 `src/services/query-service.ts:24`。默认工厂 `src/cli/commands/query.ts:70-74` 会创建 `.cord` 目录并实例化 `SqliteGraphRepository`，其中 `src/cli/commands/query.ts:72` 明确执行 `mkdirSync(dataDirectory, { recursive: true })`。

因此，无效 `--type` 在默认路径下会先发生文件系统/数据库初始化，再进入 schema 校验。若当前目录不可写或数据库初始化失败，用户可能先看到运行时错误而不是 `ConfigError`。现有 CLI 测试 `tests/unit/cli/commands/query.test.ts:133-156` 只覆盖合法 `--type` 转发，未覆盖无效 `--type` 不应调用 `serviceFactory` 的场景。

**严重性判断：合理**

该问题影响错误路径的一致性和副作用控制，但不影响合法查询主路径，也未造成持久化数据破坏。原审查标为低严重度合理，评估为 P2。

**修复建议：可行**

在 CLI action 中先调用 `validateQueryInput({ docPath, type: options.type, includeDeprecated })`，验证通过后再创建默认 service，并把验证后的 input 传给 `service.query(...)`，可以消除无效输入时的初始化副作用。补充测试断言无效 `--type` 不调用 `serviceFactory` 也可行。

**误报评估：非误报**

初始化顺序和默认工厂副作用均可由代码直接验证，非误报。

---

## 发现 #3 评估

### 审查原文

> **[低] 查询 docPath 未规范化，常见 ./ 或绝对路径会误报文档不存在**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

`src/services/query-service.ts:25` 直接使用 `validatedInput.docPath` 调用 `repository.getDocumentByPath(...)`，仓储接口 `src/repositories/interfaces.ts:46` 和 SQLite 实现 `src/repositories/sqlite-graph-repository.ts:60-63` 都是按传入 path 精确查询。扫描写入侧则在 `src/services/scan-service.ts:178-191`、`src/services/scan-service.ts:302-303` 保存 `document.relativePath`，并由 `src/services/scan-service.ts:744` 使用 `relative(projectRoot, absolutePath).replaceAll('\\', '/')` 生成 project-relative 路径。

因此，仓储中保存的路径形态是 `docs/a.md` 这类 project-relative 路径；若用户传入 `./docs/a.md`，QueryService 会按字面值查询并误报缺失。绝对路径支持没有在 Story 3.1 明确写成 AC，但 Epic 3 文本使用“任意文档”和 `cord query <doc>`，CLI 用户传入绝对路径是合理预期，至少应明确由 CLI 或 Service 哪一层负责归一化/拒绝并给出稳定错误。

现有测试只覆盖 `docs/a.md` 这类已规范化路径，例如 `tests/unit/services/query-service.test.ts:177`、`tests/unit/services/query-service.test.ts:206`、`tests/unit/services/query-service.test.ts:229`，未覆盖 `./docs/a.md` 或绝对路径。

**严重性判断：合理**

该问题会造成常见 CLI 路径形态的 false negative，但 schema 注释和扫描存储均偏向 project-relative 契约，尚不足以上升为阻塞。原审查低严重度合理，评估为 P2。

**修复建议：可行**

建议明确归一化责任边界：若由 CLI 负责，可基于 `cwd()` 将 `docPath` 解析为 project-relative POSIX 路径后再调用服务；若由 QueryService 负责，则需要为其提供 projectRoot 或新增路径解析协作者。补充 `./docs/a.md` 命中同一文档的测试是必要的；绝对路径是否支持需在契约中明确。

**误报评估：非误报**

`./` 前缀场景在当前精确匹配实现下必然无法命中已扫描的 `docs/a.md`，非误报。绝对路径部分属于合理但需产品/契约确认的扩展预期。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮未确认 P0/P1 阻塞项。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 关系类型 schema 类型契约退化 | [低] | **P2** | 运行时校验有效，但编译期 `RelationType` 反馈退化，建议补类型安全元组和类型断言测试。 |
| 2 | 无效 `--type` 先初始化数据库 | [低] | **P2** | 输入错误路径存在副作用和错误体验不稳定，建议 CLI 先校验再创建 service。 |
| 3 | 查询 `docPath` 未规范化 | [低] | **P2** | `./docs/a.md` 等常见路径形态会误报文档不存在，建议明确并实现归一化边界。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮 3 条发现均经代码验证为有效。 |

### 评估决定

- **发现 #1（关系类型 schema 类型契约退化）**：确认有效，建议作为 P2 修复；优先保留 `RelationType` 字面量联合并补类型层测试。
- **发现 #2（无效 `--type` 先初始化数据库）**：确认有效，建议作为 P2 修复；CLI 应先执行 schema 校验，验证通过后再初始化默认 repository/service。
- **发现 #3（查询 `docPath` 未规范化）**：确认有效，建议作为 P2 修复；至少应支持 `./` 相对路径归一化，绝对路径支持范围需同步明确契约。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-09
- **Model Used**: GPT-5.4
- **Fix Items**: 3

1. 已修复发现 #1：在 `src/schemas/query-input.ts` 中移除 `Object.values(... ) as [string, ...string[]]` 的宽化写法，改为基于 `RELATION_TYPES` 的字面量元组常量，并通过 `RelationType` 约束保持 `QueryInput.type` 的编译期联合类型不退化。
2. 已修复发现 #2：在 `src/cli/commands/query.ts` 中调整顺序为“先 `validateQueryInput`，后 `serviceFactory`”，消除无效 `--type` 时的数据库目录初始化副作用；新增 CLI 测试验证无效枚举输入不会触发 service 初始化。
3. 已修复发现 #3：将查询路径规范化责任明确放在 CLI 层，在 `src/cli/commands/query.ts` 中把输入路径转换为 project-relative POSIX 路径后再传入 QueryService；新增 `./docs/source.md` 命中同一文档的回归测试。
4. 验证结果：`npm test`、`npm run lint`、`npm run type-check` 全部通过。