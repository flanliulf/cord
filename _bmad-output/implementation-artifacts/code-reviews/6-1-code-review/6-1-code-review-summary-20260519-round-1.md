---
Story: 6-1
Round: 1
Date: 2026-05-19
Model Used: GPT-5.5 (copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。当前运行时没有可用的通用 Agent 调度工具，本轮按 `bmenhance-cr-01-reviewer` 降级规则串行完成 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三层审查；三层均完成，未跳过。`npm run test` 通过（49 个测试文件 / 422 个测试），`npm run lint` 通过，核心路径 `src/scanner/**`、`src/services/query-service.ts`、`src/services/impact-service.ts` diff 为空；`npm run build` 未执行，因为该命令会写入 `dist`，与本轮只读 CR 约束冲突。未发现阻塞 Story 6-1 通过的问题；发现 2 个低优先级文档模板 patch，建议通过后由 evaluator 判定是否立即进入 fixer。

## 新发现

### 1. [低] 集成测试模板没有覆盖贡献指南自己声明的“重复扫描”要求

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `docs/contributing.md:18-24` 将“重复扫描不会破坏已有图谱”列为框架适配器集成测试至少覆盖项。
  - `docs/contributing.md:56-66` 的可复制模板只执行一次 `service.scan({ projectRoot, rebuild: true, force: true })`，随后断言文档、关系和 `framework_preset`，没有第二次扫描或增量扫描断言。

- **影响**
  - 新贡献者照抄模板时容易漏掉重复扫描/增量安全性验证；这不会破坏当前文档交付，但会降低 AC #3 中“集成测试编写指南（含测试模板）”的可执行完整性。

- **建议**
  - 在模板中增加一次重复扫描断言，例如第二次调用 `service.scan({ projectRoot })`，验证不会重复生成关系、不会破坏已有图谱，或在模板下方补充一个“重复扫描断言”代码片段。

### 2. [低] 集成测试模板在断言失败路径上不会关闭 SQLite 仓库连接

- **来源**：edge
- **分类**：patch

- **证据**
  - `docs/contributing.md:58-67` 创建 `SqliteGraphRepository` 和 `ScanService` 后，只在所有断言之后调用 `service.close()`。
  - 如果 `expect(...)` 中任一断言失败，`service.close()` 不会执行，临时目录清理依赖 `afterEach` 的 `rmSync(..., { recursive: true, force: true })`。

- **影响**
  - 在部分平台或失败场景中，未关闭的 SQLite 连接可能导致临时目录清理不稳定，也会给贡献者复制模板后的失败诊断增加噪音。

- **建议**
  - 将模板改成 `try { ... assertions ... } finally { service.close(); }`，或在 `afterEach` 中集中关闭服务实例，再删除临时目录。

## 验证摘要

- `npm run test` ✅ 通过（49 个测试文件 / 422 个测试，退出码 0）
- `npm run lint` ✅ 通过（退出码 0）
- `npm run build` 未执行：该命令会写入 `dist`，为遵守本轮只读 CR 约束未运行
- 核心路径 diff ✅ 为空：`git diff --name-only -- src/scanner src/services/query-service.ts src/services/impact-service.ts` 无输出
- 定向复核：
  - `docs/adapter-guide.md` 已覆盖 `IFrameworkAdapter` 全部接口成员、`AbstractFrameworkAdapter`、最小适配器教程、文档类型注册、预设规则示例和完整激活链。
  - `docs/contributing.md` 已覆盖集成测试指南、PR 规范、审阅流程和核心路径零修改验证命令。
  - BMAD 适配源码改动仅为 JSDoc/注释补充，未改变运行逻辑。

## 通过项

- AC #1：`docs/adapter-guide.md` 包含 `IFrameworkAdapter` API 表，覆盖 `name`、`detectFramework()`、`getDocumentTypes()`、`getPresetRules()`、`getScanPaths()`、`getExcludePaths()`、`discoverDocuments()`。
- AC #2：最小适配模块教程覆盖 `src/adapters/framework/index.ts` 注册、`resolveAdapter(config, projectRoot)` 选择顺序、`config.framework` 覆盖优先级、`detectFramework()` 自动检测和 `GenericFrameworkAdapter` 兜底。
- AC #3/#4：`docs/contributing.md` 已包含集成测试编写指南、测试模板、PR 规范和审阅流程。
- AC #5：`src/adapters/framework/bmad/adapter.ts`、`doc-types.ts`、`preset-rules.ts` 已补充面向贡献者的参考实现注释。
- AC #6：文档给出 0-240 分钟的最小可用适配路径，覆盖文档类型注册、1 条预设规则和集成测试验证。
- AC #7：全量测试通过，且核心扫描、查询、影响分析路径无 diff。

## 结论

- **结论：通过（无阻塞项）**
- **阻塞项**：无
- **建议**：进入 evaluator 对 2 个低优先级 patch 的有效性做确认；若确认有效，可进入 fixer 做小范围文档模板修订。
