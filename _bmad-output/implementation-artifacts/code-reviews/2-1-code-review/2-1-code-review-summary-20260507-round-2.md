---
Story: 2-1
Round: 2
Date: 2026-05-07
Model Used: GitHub Copilot (copilot)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 P1 阻塞项（符号链接越界/循环扫描）已通过 `lstatSync()` + `isSymbolicLink()` 跳过策略修复，并补充外部 symlink 与循环 symlink 回归测试。`npm test`、`npm run lint`、`npm run build`、`npm run type-check`、`npm run test:coverage` 均通过。本轮未发现新的阻塞项或中高优先级问题，建议通过本轮 CR；上一轮 #2/#3 维持非阻塞 CR TODO。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 递归扫描未处理符号链接，可能扫描项目外文件或陷入循环
   - 修复位置：`src/adapters/framework/abstract-base.ts:83-88`，递归入口改用 `lstatSync()` 获取链接本身元数据，并在 `entryStats.isSymbolicLink()` 时直接返回，不再跟随 symlink。
   - 测试位置：`tests/unit/adapters/framework.test.ts:143-177`，新增“项目内 symlink 指向项目外目录不被扫描”和“循环 symlink 不递归失控”两条回归测试。
   - 验证结果：三层复审均确认 Round 1 P1 已关闭；完整测试与覆盖率门禁通过。

### 仍为非阻塞待办

1. Round 1 / Finding #2 — 文件系统竞态或权限错误会以原生异常中断扫描
   - 维持既有评估结论：CR TODO / 非阻塞。
   - 当前状态：`lstatSync()` / `readdirSync()` 仍未做异常包装。该问题真实存在，但 Round 1 evaluation 已评估为更适合在 ScanService 编排或错误策略统一时处理。

2. Round 1 / Finding #3 — 深层大目录使用同步递归扫描会阻塞 CLI/MCP 调用
   - 维持既有评估结论：CR TODO / 非阻塞。
   - 当前状态：同步递归策略未变化。该性能风险真实存在，但当前 Story 接口即为同步返回，建议后续扫描编排阶段统一治理。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

复审中注意到一个非阻塞设计取舍：当前修复采用“完全不跟随符号链接”的安全策略，因此如果用户把 `scanPaths` 直接配置为 symlink / junction，该入口会被跳过。此行为不违反当前 Story AC，也与本轮 P1 安全修复一致；若未来需要支持“仅跟随指向项目内的入口 symlink”，应先明确架构规则，再引入 `realpath` 边界校验与 visited set。

## 验证摘要

- `npm test` ✅ 通过（211 / 211）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- `npm run type-check` ✅ 通过
- `npm run test:coverage` ✅ 通过（211 / 211）
  - All files: Stmts 95.88%、Branch 92.00%、Funcs 97.61%、Lines 96.17%
  - `src/adapters/framework`: Stmts 87.27%、Branch 81.57%、Funcs 91.66%、Lines 87.27%
- 额外复核：
  - 已复核 `lstatSync()` 跳过 symlink 的修复点，确认不再跟随项目内 symlink 指向项目外目录。
  - 已复核新增循环 symlink 测试，确认修复不是依赖路径去重，而是直接阻断 symlink 递归入口。
  - 三层审查状态：Blind Hunter、Edge Case Hunter、Acceptance Auditor 均返回；子代理实际输出落点降级到 session memory，已读取并纳入本总结分类。

## 通过项

- AC#1-AC#3：`IFrameworkAdapter`、`AbstractFrameworkAdapter`、`GenericFrameworkAdapter` 的接口与实现仍满足 Story 要求。
- AC#4-AC#5：`scanPaths` / `excludePaths` 逻辑和 Generic 默认排除 `src/` 的要求仍保持有效。
- AC#6：`frameworkAdapters` 声明式注册表和 `resolveAdapter()` 逻辑未被本轮修复破坏。
- AC#7：framework adapter 单元测试从 9 个增加到 11 个，覆盖率继续超过 80% 门槛。
- 历史 P1 修复持续有效；历史 #2/#3 作为非阻塞 CR TODO 保留，不影响本轮通过。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：进入后续 CR 评估 / finalizer 流程；将 Round 1 #2/#3 继续作为非阻塞 CR TODO 跟踪。
