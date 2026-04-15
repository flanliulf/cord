# Story 1.5: CI/CD 管道与质量门禁

Status: ready-for-dev

## Story

As a 开发者，
I want GitHub Actions CI/CD 管道和质量门禁，
So that 每个 PR 都经过自动化的 lint、类型检查、测试和覆盖率验证。

## Acceptance Criteria (AC)

1. **Given** Story 1.1-1.4 的代码基础已就绪 **When** 配置 CI **Then** `.github/workflows/ci.yml` 配置 PR 检查管道：lint → type-check → test → coverage
2. **Given** CI 管道就绪 **When** 配置 Release **Then** `.github/workflows/release.yml` 配置完整可执行的发布流程：main 分支 push 触发、`permissions.id-token: write`（npm provenance 必须）+ `permissions.contents: write`（GitHub Release 和 tags 创建必须）、由 `semantic-release` 全权负责发布（通过 `@semantic-release/npm` 插件执行 npm publish，在 `npmPublish` 配置中启用 provenance，并由 `@semantic-release/github` 创建 GitHub Release）
3. **Given** 需要跨平台验证 **When** 配置矩阵测试 **Then** `.github/workflows/cross-platform.yml` 配置跨平台矩阵（ubuntu / macos / windows）验证 better-sqlite3 native addon
4. **Given** CI 管道运行 **When** 检查覆盖率 **Then** 覆盖率门禁配置：整体 ≥ 80%
5. **Given** 需要标准化协作流程 **When** 创建模板 **Then** `.github/ISSUE_TEMPLATE/` 和 `PULL_REQUEST_TEMPLATE.md` 创建完毕
6. **Given** 需要供应链安全 **When** 配置发布 **Then** npm provenance 配置就绪
7. **Given** 所有配置完成 **When** 本地执行验证命令 **Then** `npm run lint && npm run type-check && npm test -- --coverage` 全部通过，覆盖率不低于 80%

## Tasks / Subtasks

- [ ] Task 1: 创建 CI 检查管道 (AC: #1, #4)
  - [ ] 1.1 `.github/workflows/ci.yml` — PR 触发：lint → type-check → test → coverage
  - [ ] 1.2 配置 Node.js 20 LTS + npm ci
  - [ ] 1.3 配置覆盖率报告和门禁（≥ 80%）
  - [ ] 1.4 配置 PR 评论覆盖率摘要（可选）
- [ ] Task 2: 创建 Release 工作流 (AC: #2, #6)
  - [ ] 2.1 `.github/workflows/release.yml` — 触发条件：main 分支 push
  - [ ] 2.2 配置 workflow 权限：`permissions.id-token: write`（npm provenance 必须）+ `permissions.contents: write`（GitHub Release 和 tags 创建必须）
  - [ ] 2.3 安装 semantic-release devDependencies：`semantic-release`、`@semantic-release/changelog`、`@semantic-release/git`（`@semantic-release/npm` 和 `@semantic-release/github` 为内置插件）
  - [ ] 2.4 配置 semantic-release 执行步骤（commit-analyzer → release-notes-generator → changelog → npm → git → github）
  - [ ] 2.5 在 `@semantic-release/npm` 配置中启用 provenance：`{ "npmPublish": true, "tarballDir": ".", "pkgRoot": "." }`，workflow 中添加 `NPM_CONFIG_PROVENANCE: true` 环境变量
  - [ ] 2.6 验证 release.yml 语法正确，发布链路完整可执行（semantic-release 为唯一发布 owner）
- [ ] Task 3: 创建跨平台测试 (AC: #3)
  - [ ] 3.1 `.github/workflows/cross-platform.yml` — ubuntu / macos / windows 矩阵
  - [ ] 3.2 验证 better-sqlite3 在各平台编译通过
- [ ] Task 4: 创建协作模板 (AC: #5)
  - [ ] 4.1 `.github/ISSUE_TEMPLATE/bug-report.yml`
  - [ ] 4.2 `.github/ISSUE_TEMPLATE/feature-request.yml`
  - [ ] 4.3 `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Task 5: 本地验证 (AC: #7)
  - [ ] 5.1 本地执行 `npm run lint && npm run type-check && npm test -- --coverage` 全部通过
  - [ ] 5.2 确保 CI 工作流 YAML 语法正确

## Dev Notes

### CI 工作流核心配置

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
      # 覆盖率门禁
```

### 跨平台矩阵要点

- better-sqlite3 是 native addon，需在每个平台编译
- 矩阵包含：`ubuntu-latest`、`macos-latest`、`windows-latest`
- Node.js 版本固定 20 LTS
- Windows 上可能需要 node-gyp + python 依赖

### 覆盖率分级目标（D8）

| 层 | 覆盖率目标 |
|----|-----------|
| Service 层 + Scanner 引擎 | ≥ 90% |
| Repository 层 | ≥ 85% |
| CLI / MCP 入口层 | ≥ 70% |
| Adapters 层 | ≥ 80% |
| **整体** | **≥ 80%** |

CI 门禁当前阶段设整体 ≥ 80%，后续根据分层目标细化。

### semantic-release 配置

`semantic-release` 是唯一发布 owner，全权负责 npm publish 和 GitHub Release 创建。

```json
// .releaserc.json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github"
  ]
}
```

需安装 devDependencies：
- `semantic-release`
- `@semantic-release/changelog`
- `@semantic-release/git`

（`@semantic-release/npm` 和 `@semantic-release/github` 为内置插件，不需要额外安装）

### npm provenance

由 `@semantic-release/npm` 插件负责执行 npm publish。在 release workflow 中通过环境变量启用 provenance：

```yaml
env:
  NPM_CONFIG_PROVENANCE: true
```

确保以下两项权限同时配置（当 workflow 显式声明任意一项权限时，GitHub Actions 会将所有未声明权限收缩为 `none`）：
- `permissions.id-token: write`（OIDC token，npm provenance 必须）
- `permissions.contents: write`（GitHub Release 和 tags 创建必须，`@semantic-release/github` 依赖此权限）

**禁止**在 workflow 中单独添加 `npm publish` 步骤，以避免重复发布。

### PR 模板建议

```markdown
## 变更描述

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 文档
- [ ] 测试

## 测试
- [ ] 单元测试已添加/更新
- [ ] 所有测试通过
- [ ] 覆盖率未下降

## 检查清单
- [ ] 代码遵循项目编码规范（P1-P16）
- [ ] 跨层引用通过 index.ts 门面
- [ ] 错误使用 CordError 子类
```

### 架构约束提醒

- **D7**: GitHub Actions 作为唯一 CI/CD 平台
- **D8**: 整体覆盖率 ≥ 80%
- Commit 消息遵循 Conventional Commits 规范（semantic-release 依赖）

### Project Structure Notes

- `.github/workflows/ci.yml` — PR 检查管道
- `.github/workflows/release.yml` — 发布流程
- `.github/workflows/cross-platform.yml` — 跨平台测试
- `.github/ISSUE_TEMPLATE/bug-report.yml` — Bug 报告模板
- `.github/ISSUE_TEMPLATE/feature-request.yml` — 功能请求模板
- `.github/PULL_REQUEST_TEMPLATE.md` — PR 模板

### References

- [Source: architecture/core-architectural-decisions.md#D7] — GitHub Actions CI/CD
- [Source: architecture/core-architectural-decisions.md#D8] — 80%+ 代码覆盖率
- [Source: architecture/project-structure-boundaries.md] — .github/ 目录结构
- [Source: prd.md#NFR15] — 数据库一致性
- [Source: planning-artifacts/epics/epic-1工程就绪开发者可开始编写功能代码.md#Story 1.5] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
