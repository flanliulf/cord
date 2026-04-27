---
Story: 1-2
Round: 1
Date: 2026-04-26
Model Used: GPT-5.4 (GitHub Copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查层均可用。`npm test`、`npm run lint`、`npm run build` 通过，但定向 Commander 复现确认 `--verbose` 接线当前不生效，且 `npm run test:coverage` 实测总覆盖率低于 90%。存在 1 条功能性阻塞问题和 1 条质量门禁缺口，本轮不建议通过。

## 新发现

### 1. [中] `--verbose` 在当前 CLI 接线中不会真正开启 debug 输出

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/cli/index.ts:11-16` 将 `logger.setVerbose(true)` 绑定到 `preAction` 钩子，但同文件没有任何 `action` 或 subcommand 注册，只有最终的 `program.parse(process.argv)`。
  - 定向验证结果为 `{"called":false,"opts":{"verbose":true}}`，说明传入 `--verbose` 时选项会被解析，但 `preAction` 不会触发。
  - `tests/unit/utils/logger.test.ts` 仅覆盖 Logger 类本身，没有覆盖 CLI 参数解析路径，因此该缺陷未被测试捕获。

- **影响**
  - AC5 明确要求 `CORD_DEBUG=1` 或 `--verbose` 能启用 debug 级别；当前 CLI 路径下 `--verbose` 实际无效。
  - 后续命令即使带上 `--verbose`，也拿不到预期的调试日志，排障路径被阻断。

- **建议**
  - 在 `program.parse(process.argv)` 之后立即根据 `program.opts()` 处理全局 `--verbose`，或改为可确定会触发的钩子/入口接线。
  - 补一个 CLI 级回归测试，验证 `cord --verbose` 会实际调用 `logger.setVerbose(true)`。

### 2. [低] 覆盖率报告仍低于 Story 要求的 90%

- **来源**：auditor
- **分类**：patch

- **证据**
  - `npm run test:coverage` 实际输出：`All files | Statements 82.85% | Lines 82.35%`，低于 AC8 的 `≥ 90%` 要求。
  - 覆盖率输出同时显示 `src/cli/index.ts` 为 `0%` 覆盖，未覆盖行 `4-18`，这正是本次新增 `--verbose` 接线路径所在区域。
  - 虽然 `utils/errors.ts` 与 `utils/logger.ts` 都达到 `100%` 覆盖，但当前交付物的整体报告未达标。

- **影响**
  - Story 1.2 当前不能用实际覆盖率报告证明 AC8 已满足。
  - 新增 CLI 行为缺少回归保护，后续修复或重构时容易再次退化。

- **建议**
  - 为 CLI 入口补测试，至少覆盖 `--verbose` 的解析与接线。
  - 明确覆盖率门槛的统计范围；若按项目总体统计，应补足未覆盖入口或配置更精确的覆盖范围并在 Story/规则中同步说明。

## 验证摘要

- `npm test` ✅（40 / 40）
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:coverage` ❌
  - 总覆盖率：Statements 82.85%，Lines 82.35%
  - `src/cli/index.ts` 未覆盖行：4-18
- 定向复现 ❌
  - Commander 最小复现：`--verbose` 被解析，但 `preAction` 未触发（返回 `called: false`）

## 通过项

- `src/utils/errors.ts` 已实现 `CordError` 基类与 5 个错误子类，基础属性、`name` getter、`cause` 透传行为均有单元测试覆盖。
- `src/utils/logger.ts` 已实现 `debug/info/warn/error` 四级接口，CLI/MCP 双模式分流逻辑和 `CORD_DEBUG` / `CORD_MCP_MODE` 分支均有单元测试覆盖。
- `npm test`、`npm run lint`、`npm run build` 在当前工作区均可稳定通过。
