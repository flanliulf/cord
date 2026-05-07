---
Story: 2-1
Round: 2
Date: 2026-05-07
Model Used: GitHub Copilot (copilot)
Review Source: 2-1-code-review-summary-20260507-round-2.md
Review Model: GitHub Copilot (copilot)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-1 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 1 的 P1 阻塞项“符号链接越界/循环扫描”已关闭，并将 Round 1 #2/#3 继续维持为非阻塞 CR TODO；本轮未提出新的阻塞项或中高优先级问题。经代码核验，本评估认可 round 2 审查的通过结论。

---

## 上轮问题回顾确认

### Round 1 / Finding #1（递归扫描未处理符号链接）：✅ 已关闭

Round 1 评估要求修复 symlink 越界扫描和循环递归风险。当前实现已将递归入口的类型判断改为 `lstatSync(currentPath)`，并在 `entryStats.isSymbolicLink()` 时直接返回（`src/adapters/framework/abstract-base.ts:84-88`）。由于 `lstatSync()` 读取的是链接本身元数据而不是目标路径，目录分支的 `readdirSync(currentPath)` 只会在非 symlink 目录上执行（`src/adapters/framework/abstract-base.ts:91`），因此不会再跟随项目内 symlink 进入项目外目录或祖先目录。

回归测试覆盖到位：测试文件新增 `createDirectorySymlink()`，在 Windows 下使用 junction、其他平台使用 dir symlink（`tests/unit/adapters/framework.test.ts:69-70`）；外部 symlink 测试创建项目外 `outside.md` 并断言候选结果不包含 `external-link/outside.md`（`tests/unit/adapters/framework.test.ts:145-160`）；循环 symlink 测试创建指向项目根的 `loop` 并断言扫描结果仍只包含普通 Markdown 文件（`tests/unit/adapters/framework.test.ts:163-177`）。该修复与 Round 1 建议的最小安全策略一致。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#2 | 文件系统竞态或权限错误会以原生异常中断扫描 | CR TODO / 非阻塞 | 同意维持。当前 `lstatSync()` / `readdirSync()` 仍没有异常包装（`src/adapters/framework/abstract-base.ts:84`、`src/adapters/framework/abstract-base.ts:91`），但 Round 1 已合理降级为后续 ScanService/错误策略统一处理项。 |
| R1-#3 | 深层大目录使用同步递归扫描会阻塞 CLI/MCP 调用 | CR TODO / 非阻塞 | 同意维持。`discoverDocuments()` 仍同步返回 `string[]`（`src/adapters/framework/abstract-base.ts:41`），且当前 Story 接口即为同步契约；建议后续扫描编排阶段治理。 |

---

## 本轮新发现评估

本轮审查未提出新的 Findings。复审中提到的“如果用户直接把 `scanPaths` 配置为 symlink / junction，该入口会被跳过”属于当前安全策略的明确取舍：实现对所有 symlink 直接返回（`src/adapters/framework/abstract-base.ts:86-88`）。这不违反 Story 2-1 的 AC，也与 Round 1 P1 修复目标一致；若未来要支持“仅跟随指向项目内的入口 symlink”，需要先新增规则与测试，再引入 `realpath` 边界校验和 visited set。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 无 | 无 | 无 | 无 | 本轮无阻塞项；Round 1 P1 已关闭 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R1-#2 | 文件系统竞态或权限错误会以原生异常中断扫描 | [中] | **P2** | 问题仍存在但不阻塞当前 Story，建议在 ScanService 或统一错误策略阶段处理 |
| R1-#3 | 深层大目录使用同步递归扫描会阻塞 CLI/MCP 调用 | [低] | **P2** | 性能风险仍存在但符合当前同步接口边界，建议后续扫描编排阶段治理 |

### 可忽略（误报）

无。

### 评估决定

- **Round 1 / Finding #1（符号链接越界/循环扫描）**：确认已关闭。`lstatSync()` + `isSymbolicLink()` 跳过策略阻断了跟随 symlink 的越界扫描和循环递归路径，且新增回归测试覆盖外部 symlink 与循环 symlink。
- **Round 1 / Finding #2（原生 fs 异常逃逸）**：同意维持 CR TODO / 非阻塞，不影响本轮通过。
- **Round 1 / Finding #3（同步递归阻塞）**：同意维持 CR TODO / 非阻塞，不影响本轮通过。
- **本轮 CR 结论**：认可通过。建议进入 finalizer / TODO tracker 流程，并继续跟踪 R1-#2、R1-#3 两个非阻塞项。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-07
- **Model Used**: GPT-5.4
- **Fix Items**: 0

#### 本轮执行结果
- **评估文件**: `2-1-code-review-evaluation-20260507-round-2.md`
- **执行结论**: 本轮评估结论中没有任何标记为“需要修复”的条目，因此未执行源码修改。
- **未修复原因**: 最新评估已确认 Round 1 P1 阻塞项关闭，Round 1 的其余问题继续维持为 CR TODO / 非阻塞项，不属于本轮 fixer 允许处理范围。
- **源码变更**: 无
- **验证说明**: 因未修改源码，本轮未新增编译或测试执行；评估文件已如实记录“0 项修复”。