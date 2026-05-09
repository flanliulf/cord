---
Story: 2-5
Round: 1
Date: 2026-05-08
Model Used: GitHub Copilot (current VS Code agent)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均成功完成（blind / edge / auditor，3/3 可用）。`npm test`、`npm run lint`、`npm run build` 均通过，但存在 1 个高严重性数据一致性阻塞项和 1 个中严重性 CLI 契约问题；建议修复后进入下一轮复审。

## 新发现

### 1. [高] 缺失关系端点会提前结束事务回调并提交不完整写入

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/scan-service.ts:129-130` 在关系持久化循环中遇到缺失的 source/target 文档时执行 `return`。
  - 该 `return` 只会结束 `repository.transaction(() => { ... })` 回调，不会抛错回滚；后续 `addRelation()` 被跳过，`src/services/scan-service.ts:145-159` 的 `upsertSyncState()` 循环也不会执行。
  - `src/services/scan-service.ts:163-166` 仍返回 `relationsDiscovered: filteredRelations.length`，因此返回值可能声明发现了关系，但数据库只写入了部分关系且没有同步状态。

- **影响**
  - 悬空 Markdown 链接、目标文档被 exclude、目标文件解析失败或 pipeline 返回 null 时，扫描可能正常退出但提交不完整图谱。
  - 这直接影响 AC2 的事务保护语义和 AC3 的 documents / relations / sync_states 一致落库要求。

- **建议**
  - 在事务外预过滤缺失端点关系并追加 warning，或在事务内将该条关系 `continue` 跳过；不要从事务回调直接 `return`。
  - 补充单测：构造一条指向未持久化目标文档的 relation，断言其余关系与全部 sync_states 仍写入，且 `relationsDiscovered` 与实际写入策略一致。

### 2. [中] Commander 解析错误未统一映射为参数错误退出码 2

- **来源**：auditor
- **分类**：patch

- **证据**
  - `src/cli/commands/scan.ts:42-68` 只捕获 scan action 执行阶段的错误，并将 `ConfigError` 映射为 2、其他错误映射为 1。
  - `src/cli/index.ts:31-32` 的 `runCli()` 直接调用 `program.parse(process.argv)`；Commander 自身的未知 option 等解析错误发生在 action 之前，当前没有统一转换为退出码 2。
  - `tests/unit/cli/commands/scan.test.ts:102-157` 覆盖了 `--force` 组合错误、`ConfigError` 和运行时错误，但没有覆盖真实 Commander 参数解析错误。

- **影响**
  - AC8 要求 `2=参数/配置错误`。当前实现只能证明业务层配置错误为 2，不能保证 CLI 解析层参数错误也为 2；脚本或 CI 可能无法区分参数错误与运行时错误。

- **建议**
  - 在 CLI 入口统一捕获 Commander parse errors，或配置 `exitOverride()` / `configureOutput()` 并将参数解析错误映射为退出码 2。
  - 补充测试：例如 `cord scan --unknown` 应设置/退出为 2，并输出参数错误信息。

## 验证摘要

- `npm test` ✅ 通过（261 / 261）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核 ✅ 完成
  - 三层审查输出已交叉核对，manual 关系保护因 Story 明确标注实际检测逻辑由 Story 4.2 实现，本轮未列为阻塞项。
  - scan/preset 跨来源去重符合 Story Dev Notes 中“同 sourceDoc + targetDoc + relationType 保留高置信度并保留该记录原始 source”的规则，本轮未列为缺陷。

## 通过项

- ScanService 主流程已覆盖配置加载、adapter 解析、有效扫描/排除路径计算、文档发现、pipeline 处理、文档分类、preset merge、去重、relationTypes 过滤与事务写入。
- scanner rule 与 framework preset 的 source 写入路径分别保留 `auto_scan` 和 `framework_preset`，测试已覆盖来源集合。
- CLI scan 命令保持薄壳形态，已覆盖人类可读输出、JSON 输出、业务配置错误和运行时错误。
- Story 2.5 的冷启动样本 fixtures 与集成测试已落地；连续非 rebuild 扫描的 upsert / 增量语义属于 Story 2.6 后续范围，本轮作为非阻塞后续关注项。
