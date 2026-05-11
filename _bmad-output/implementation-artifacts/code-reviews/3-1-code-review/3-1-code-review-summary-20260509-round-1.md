---
Story: 3-1
Round: 1
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成（Blind Hunter、Edge Case Hunter、Acceptance Auditor），未发现阻塞问题；`npm test`、`npm run lint`、`npm run build` 均通过。建议结论：可进入 CR 评估/修复阶段，当前发现均为低严重度 patch 项。

## 新发现

### 1. [低] 关系类型 schema 通过 Object.values 退化为 string 类型契约

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/schemas/query-input.ts:12` 使用 `Object.values(RELATION_TYPES) as [string, ...string[]]` 构造 `z.enum`。运行时仍会校验枚举值，但 `QueryInput['type']` 推导很可能退化为 `string | undefined`，调用方失去编译期 `RelationType` 联合约束。

- **影响**
  - 非法 relation type 更容易在编译期漏过，只能依赖运行时 schema 报错；这削弱了 QueryInput 作为 Service/CLI 边界契约的类型反馈。

- **建议**
  - 导出并复用保留字面量的 `RELATION_TYPE_VALUES` 常量元组，或采用当前 Zod 版本可保持字面量联合的 enum 写法。
  - 增加类型层测试/断言，确保 `QueryInput['type']` 不是普通 `string`。

### 2. [低] 无效 --type 会先初始化数据库再触发 schema 校验

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/cli/commands/query.ts:50-52` 先执行 `serviceFactory(projectRoot)`，之后才调用 `service.query(...)`；而 QueryInput 校验发生在 `QueryService.query()` 内。
  - 默认 `serviceFactory` 会创建 `.cord/cord.db` 并运行迁移。无效 `--type` 在不可写或未初始化 cwd 中可能先失败为运行时/DB 初始化错误，而不是稳定返回 schema/ConfigError。

- **影响**
  - 对纯输入错误产生文件系统/数据库副作用；在不可写目录中，用户可能看不到真正的 `--type` 校验错误，错误体验不稳定。

- **建议**
  - 在 CLI action 中先调用 `validateQueryInput({ docPath, type: options.type, includeDeprecated })`，验证通过后再初始化默认 repository/service。
  - 补充测试：无效 `--type` 不调用 `serviceFactory`，并以配置错误路径输出。

### 3. [低] 查询 docPath 未规范化，常见 ./ 或绝对路径会误报文档不存在

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/services/query-service.ts:25` 直接用 `validatedInput.docPath` 调用 `repository.getDocumentByPath(...)`。
  - 扫描链路写入的是 project-relative 文档路径；若 CLI 用户输入 `./docs/a.md` 或绝对路径，即使目标文件已扫描，也会被当作缺失文档并抛出 `CORD_QUERY_001`。

- **影响**
  - 常见命令行路径形态会造成 false negative，影响 `cord query <doc>` 的可用性和文档不存在错误的可信度。

- **建议**
  - 明确 QueryService 或 CLI 哪一层负责把输入规范化为 repository 使用的 project-relative path。
  - 补充测试：`./docs/a.md` 与 project-relative `docs/a.md` 命中同一文档；如支持绝对路径，也覆盖绝对路径到相对路径转换。

## 验证摘要

- ✅ `npm test` 通过（283 / 283）
- ✅ `npm run lint` 通过
- ✅ `npm run build` 通过
- 定向复现/定向验证：
  - ✅ `npm test -- tests/unit/services/query-service.test.ts tests/unit/schemas/query-input.test.ts tests/unit/cli/commands/query.test.ts tests/unit/cli/index.test.ts` 通过（38 / 38）
  - 三层审查输入中，`review-input.diff` 未包含未跟踪新增文件；Acceptance Auditor 已读取 Story File List 中的实际实现/测试文件补足核对，构建与完整测试确认模块可解析。

## 通过项

- AC1-AC3：`QueryService` 实现一跳双向关系查询、结果字段包含 `relationId/targetPath/relationType/confidence/source/status`，并支持关系类型过滤。
- AC4-AC6：`cord query <doc>` 已注册，CLI 保持薄壳，支持人类可读表格和 `--json` 输出。
- AC7：服务测试包含 p95 < 1ms 的内存仓储性能断言。
- AC8：文档不存在时抛出 `QueryError`，包含 `code` 和 `suggestion`，并被 CLI 错误输出覆盖。
- AC9-AC10：默认过滤 `status='deprecated'`，`--include-deprecated` / `includeDeprecated=true` 可返回 deprecated 关系。
- AC11：正常查询、类型过滤、空结果、缺失文档、deprecated 默认过滤与 includeDeprecated 可见均已有测试覆盖。
- 已忽略项：Blind Hunter 报告的“diff 未包含新增实现文件”属于审查输入采集限制；实际工作区存在这些文件，AC 审计已读取核对，且 build/test 通过，因此不作为代码缺陷输出。
