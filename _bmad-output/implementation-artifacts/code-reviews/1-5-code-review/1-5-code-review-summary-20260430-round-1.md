---
Story: 1-5
Round: 1
Date: 2026-04-30
Model Used: nx-gpt-5.4 (ws/nx-gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均执行成功（Blind Hunter / Edge Case Hunter / Acceptance Auditor），本轮基于 diff 与静态配置审查，未运行测试、lint、build 实命令。发现 4 项问题，其中 1 项需人工决策、3 项可直接修复；当前不建议通过。

## 新发现

### 1. [高] npm provenance 的实现方式与 AC-2 规定的配置落点不一致

- **来源**：auditor
- **分类**：decision_needed

- **证据**
  - `.releaserc.json:12-18` 中 `@semantic-release/npm` 仅配置了 `npmPublish`、`tarballDir`、`pkgRoot`。
  - `.github/workflows/release.yml:36-41` 通过环境变量 `NPM_CONFIG_PROVENANCE: true` 开启 provenance。
  - Story AC-2 明确要求 provenance 在 `@semantic-release/npm` 的发布配置中启用。

- **影响**
  - 当前实现可能能工作，但与 Story 写明的验收落点不一致。
  - 如果团队认可“仅靠 workflow 环境变量即可满足需求”，应同步修正规格；如果不认可，则当前实现未满足 AC。

- **建议**
  - 先确认团队要以“实现满足语义”为准，还是以“配置位置必须严格匹配 AC”为准。
  - 若以 AC 为准，调整发布配置并补充可审计说明；若以当前实现为准，需回写 Story/架构文档，消除规格歧义。

### 2. [中] Release 工作流没有以 CI 质量门禁为前置条件

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `.github/workflows/ci.yml:3-40` 定义了 lint、type-check、test、coverage。
  - `.github/workflows/release.yml:3-41` 独立由 `push` 到 `main` 触发，且在 `Build` 后直接执行 `npx semantic-release`。
  - `release.yml` 中没有 `needs`、`workflow_run` 或等效机制去等待 CI 成功。

- **影响**
  - 当主分支提交能构建但未通过测试、类型检查或覆盖率门禁时，仍可能被发布到 npm / GitHub Release。
  - 这会削弱 Story 的“质量门禁”目标，使发布与质量校验脱钩。

- **建议**
  - 将发布流程挂到 CI 成功之后再执行，例如使用 `workflow_run` 监听 CI 成功，或在同一工作流中通过 `needs` 串联质量检查与发布。

### 3. [低] Release 工作流缺少并发控制，连续推送可能触发竞态发布

- **来源**：blind
- **分类**：patch

- **证据**
  - `.github/workflows/release.yml:11-41` 仅定义单个 `release` job，没有 `concurrency` 配置。
  - 该工作流由 `push` 到 `main` 触发，短时间内连续合并可能并发启动多个发布任务。

- **影响**
  - 多个 `semantic-release` 实例可能争抢同一发布窗口，造成版本计算冲突、标签竞争或重复发布失败。

- **建议**
  - 为发布工作流增加 `concurrency`，按分支或工作流分组串行化发布任务。

### 4. [中] semantic-release 提交版本变更时遗漏 `package-lock.json`

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `.releaserc.json:20-24` 的 `@semantic-release/git` 仅提交 `CHANGELOG.md` 和 `package.json`。
  - 本 Story 同时引入并维护 `package-lock.json`，且流水线安装使用 `npm ci`。

- **影响**
  - 版本发布提交后，仓库中的 `package.json` 与锁文件可能出现版本元数据漂移。
  - 后续依赖审计、安装一致性和发布后追溯会变得不稳定。

- **建议**
  - 将 `package-lock.json` 一并纳入 `@semantic-release/git` 的 `assets`。

## 验证摘要

- `git diff HEAD -- <story files>`：✅ 已审查修改中的已跟踪文件（`package.json`、`vitest.config.ts`、`package-lock.json`）
- `git diff --no-index /dev/null <new files>`：✅ 已审查新增文件（GitHub Actions、模板、`.releaserc.json`）
- Blind Hunter：✅ 完成
- Edge Case Hunter：✅ 完成
- Acceptance Auditor：✅ 完成
- `npm test` / `npm run lint` / `npm run build`：未执行；本次 CR 按只读流程仅做静态审查

## 通过项

- `.github/workflows/ci.yml` 已覆盖 lint、type-check、test with coverage 的主质量检查链路。
- `vitest.config.ts:8-17` 已配置整体覆盖率阈值 80%，与 AC-4 对齐。
- `.github/workflows/cross-platform.yml:3-42` 已覆盖 ubuntu / macos / windows，并对 Windows 补充 Python 依赖以支持 native addon。
- `.github/workflows/release.yml:7-9` 已正确声明 `contents: write` 和 `id-token: write`。
- `.github/ISSUE_TEMPLATE/` 与 `.github/PULL_REQUEST_TEMPLATE.md` 已创建，满足协作模板要求。
