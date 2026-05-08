---
Story: 2-3
Round: 1
Date: 2026-05-08
Model Used: GitHub Copilot (model-id-not-exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成：Blind Hunter、Edge Case Hunter、Acceptance Auditor 均可用。`npm test`、`npm run test:coverage`、`npm run lint`、`npm run build` 全部通过；BMAD 适配模块覆盖率 95%+，满足 AC #6 的覆盖率门槛。本轮未发现阻塞问题，建议通过，但可在后续小修中补强检测器的异常容错和 frontmatter 边界处理。

## 新发现

### 1. [低] BMAD 检测器遇到不可读目录或路径竞态时会抛出异常

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/adapters/framework/bmad/detector.ts:64` 直接调用 `readdirSync(skillsPath)`；`src/adapters/framework/bmad/detector.ts:124` 和 `src/adapters/framework/bmad/detector.ts:131` 直接调用 `lstatSync()` / `readdirSync()`。
  - 这些调用没有局部 `try/catch`，与同文件中 `package.json` 解析和单文件 frontmatter 读取的容错风格不一致。

- **影响**
  - 如果 `.claude/.agents` skills 目录不可读，或 Markdown 候选遍历期间出现权限变化、目录删除等竞态，自动检测可能抛出文件系统异常，而不是把该检测信号视为未命中并继续后续适配器解析。

- **建议**
  - 在 skills 目录读取和 Markdown 遍历的 `lstatSync()` / `readdirSync()` 外增加局部容错：不可读目录返回 `false` 或跳过当前路径。
  - 补充一个权限/竞态模拟测试，确认 `detectBmadFramework()` 不因单个不可读路径中断。

### 2. [低] frontmatter 结束标记匹配过宽，可能把非标准分隔符当作有效 YAML frontmatter

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/adapters/framework/bmad/detector.ts:152-162` 中 `extractYamlFrontmatter()` 使用 `content.indexOf('\n---', 4)` 查找结束标记，但没有校验结束标记是独立一行。
  - 例如正文中出现 `\n---not-a-delimiter` 时也会被截断为 frontmatter 结束位置。

- **影响**
  - 可能在非标准 Markdown 中制造 `bmad-frontmatter` 误检测信号，增加非 BMAD 项目被误识别的概率。

- **建议**
  - 将结束标记解析收窄为行级匹配，例如要求结束行为 `---` 或 `---\r`，并为 `---not-a-delimiter` 增加反例测试。

### 3. [低] BMAD frontmatter 检测只扫描前 64 个 Markdown 候选，可能漏掉真实 BMAD 信号

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/adapters/framework/bmad/detector.ts:13` 定义 `MAX_FRONTMATTER_FILES = 64`；`src/adapters/framework/bmad/detector.ts:95` 只检查这批候选；`src/adapters/framework/bmad/detector.ts:116-146` 达到上限即停止遍历。

- **影响**
  - 大型仓库中，如果带 BMAD frontmatter 的文档排序靠后，且项目只有另一个 BMAD 信号，`detectBmadFramework()` 可能无法达到 2 信号阈值，出现 false negative。

- **建议**
  - 优先扫描高价值目录（如 `_bmad-output/`、`docs/`、项目根核心文档），或将上限策略改为可解释的分层预算。
  - 增加一个超过 64 个 Markdown 文件且 BMAD frontmatter 位于靠后文件的检测测试。

## 验证摘要

- `npm test` ✅ 通过（243 / 243）
- `npm run test:coverage` ✅ 通过（243 / 243）；`src/adapters/framework/bmad` 语句覆盖率 95.29%，分支覆盖率 94.87%，函数覆盖率 100%，行覆盖率 95.06%
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核 ✅
  - AC #1：`BmadFrameworkAdapter` 已实现并继承 `AbstractFrameworkAdapter`
  - AC #2：v0.1 返回 16 种 Markdown BMAD 文档类型，不包含 YAML 类型
  - AC #3/#5：预设规则存在且置信度均 ≥ 0.90
  - AC #4：5 层检测信号已实现
  - AC #6：真实 BMAD 文件正例、`_bmad/` 模板反例、fixture 补齐类型测试均存在并通过

## 通过项

- BMAD adapter 注册顺序正确，`BmadFrameworkAdapter` 位于 `GenericFrameworkAdapter` 之前，并已有测试覆盖。
- `_bmad/` 模板目录被默认排除，反例测试确认模板 Markdown 不进入 BMAD 文档候选。
- 预设规则与文档类型定义的核心 AC 已满足，未发现阻塞性 AC 缺口。
- 子审查中关于 `_bmad-output/` 未排除的担忧判定为误报：该目录正是 BMAD 实际产物扫描目标，不应默认排除。
- 子审查中关于 `RELATION_TYPES` 未定义的担忧判定为误报：该符号来自既有类型模块导出，当前 build 已验证通过。
