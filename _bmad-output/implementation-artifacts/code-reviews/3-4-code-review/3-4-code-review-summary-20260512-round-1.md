---
Story: 3-4
Round: 1
Date: 2026-05-12
Model Used: GitHub Copilot (VS Code Chat)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成（blind / edge / auditor，无失败层）。`npm test`、`npm run lint`、`npm run build` 均通过；但当前存在 1 个需要产品/架构裁决的问题和 2 个明确补丁项，建议暂不通过，先完成裁决与修复后进入复审。

## 新发现

### 1. [高] project 字段来源与 Story Dev Notes 裁决不一致

- **来源**：blind+edge
- **分类**：decision_needed

- **证据**
  - `_bmad-output/implementation-artifacts/stories/3-4-json-snapshot-export.md:47-49` 明确写明 `project` 字段应优先读取配置文件中的项目名，缺失时再使用项目根目录名。
  - `src/services/export-service.ts:96-109` 当前始终使用 `basename(resolve(projectRoot))`。
  - `src/schemas/config.ts:18-42` 当前 `cord.config` schema 未定义 `projectName` / `name` 字段。

- **影响**
  - 若项目显示名不等于目录名，导出的 snapshot 会记录错误项目身份；但现有配置契约也缺少可读取字段，无法在不新增规则的情况下直接修复。

- **建议**
  - 先裁决 `project` 来源：新增 `cord.config` 项目名字段、读取 `package.json name`，或正式接受目录名作为 v0.1 契约。
  - 裁决后补充服务层测试，覆盖配置项目名优先级与 fallback 行为。

### 2. [中] `--output` 可解析到 projectRoot 外，违反路径型 CLI 输入边界契约

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/services/export-service.ts:116-121` 对用户传入 `outputPath` 直接执行 `resolve(projectRoot, outputPath)`。
  - `src/services/export-service.ts:83-84` 随后会 `mkdir` 并 `writeFile` 到解析后的路径。
  - `src/cli/commands/export.ts:41-53` CLI 只 trim/validate，未拒绝绝对路径或 `../` 逃逸。
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md:35` 要求路径型 CLI 输入归一化后若落到 projectRoot 外，必须在入口层返回 `ConfigError`。

- **影响**
  - `cord export --output ../snapshot.json` 或绝对路径会写到项目外，和“导出到项目 git 审阅快照”的契约不一致，也可能误写本机任意位置。

- **建议**
  - 在 CLI 层将 `--output` 归一化为 project-relative 路径，拒绝 `''`、`..`、`../...` 以及项目外绝对路径，并在 `serviceFactory()` 前抛出稳定 `ConfigError`。
  - 补测试覆盖相对路径、绝对路径、`../`、带空白的项目外路径，断言被拒绝时不会初始化 service。

### 3. [中] 快照排序使用默认 `localeCompare`，跨环境稳定性不足

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/export-service.ts:153-161` 使用未固定 locale/options 的 `localeCompare()` 对文档和关系排序。
  - `tests/unit/services/export-service.test.ts:164-285` 仅覆盖简单 ASCII 路径，未覆盖大小写、数字段或非 ASCII 文件名。

- **影响**
  - JSON 快照用于 git 审阅时，同一图谱在不同 Node/ICU/locale 环境下可能产生不同顺序，制造无意义 diff。

- **建议**
  - 改为显式二进制字符串比较，或固定 `localeCompare` 的 locale/options。
  - 补充排序稳定性测试，覆盖大小写、数字段和非 ASCII 路径/ID。

## 验证摘要

- `npm test` ✅ 通过（335 / 335，35 个测试文件）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过（ESM 与 DTS 构建成功）
- 定向复核 ✅ 已完成
  - 三层审查输出均成功写入并完成合并去重。
  - 复核 Story AC、导出服务、CLI 命令、schema、服务测试和 CLI 测试。
  - 确认 AC1-AC7 主路径有实现和测试覆盖。

## 通过项

- `ExportService` 已输出 `schemaVersion: "1.0"`、ISO `exportedAt`、`project`、`documents`、`relations`。
- 快照顶层字段使用 camelCase，普通可空字段与 metadata 内部 null 值均保留。
- `cord export` 命令已注册到主 CLI，并覆盖 human-readable / JSON 成功输出、错误输出、service close 与空白 output 校验。
- 空图谱导出、默认项目根输出、自定义相对输出目录创建均有测试覆盖。
- 已知既有/非阻塞加固项（defer）：`src/services/export-service.ts:83-84` 直接覆盖写入目标文件，未做原子写入或覆盖语义测试；建议后续作为可靠性增强项处理，不阻塞本轮 AC 主路径判断。
