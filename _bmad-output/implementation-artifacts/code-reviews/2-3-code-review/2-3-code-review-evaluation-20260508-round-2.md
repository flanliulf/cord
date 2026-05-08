---
Story: 2-3
Round: 2
Date: 2026-05-08
Model Used: GitHub Copilot (model-id-not-exposed)
Review Source: 2-3-code-review-summary-20260508-round-2.md
Review Model: GitHub Copilot (model-id-not-exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-3 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查未提出新的阻塞项或中高优先级问题，主要复核 Round 1 evaluation 已确认的 3 条 P2 非阻塞 TODO 是否仍存在、是否需要调整优先级。经独立代码验证，3 条历史问题仍存在，复审描述准确；但风险边界未扩大，仍不构成当前 Story 交付阻塞。评估结论如下。

---

## 上轮问题回顾确认

### Round 1 Finding #1 — BMAD 检测器遇到不可读目录或路径竞态时会抛出异常：仍存在 / 维持 P2 非阻塞

经代码验证，该问题尚未修复。`src/adapters/framework/bmad/detector.ts:64` 仍在 skills 目录存在后直接调用 `readdirSync(skillsPath)`；`src/adapters/framework/bmad/detector.ts:124` 仍直接调用 `lstatSync(currentPath)`；`src/adapters/framework/bmad/detector.ts:131` 仍直接调用 `readdirSync(currentPath)`。这些调用外层没有局部容错，Round 2 审查对此项的复核准确。

### Round 1 Finding #2 — frontmatter 结束标记匹配过宽：仍存在 / 维持 P2 非阻塞

经代码验证，该问题尚未修复。`src/adapters/framework/bmad/detector.ts:153` 仍只接受 `---\n` 开头，`src/adapters/framework/bmad/detector.ts:157` 仍使用 `content.indexOf('\n---', 4)` 查找结束标记，未校验结束标记是否独立成行。Round 2 审查对此项的复核准确。

### Round 1 Finding #3 — BMAD frontmatter 检测只扫描前 64 个 Markdown 候选：仍存在 / 维持 P2 非阻塞

经代码验证，该问题尚未修复。`src/adapters/framework/bmad/detector.ts:13` 仍定义 `MAX_FRONTMATTER_FILES = 64`，`src/adapters/framework/bmad/detector.ts:95` 仍按该上限收集候选，`src/adapters/framework/bmad/detector.ts:117` 仍在 `results.length < maxFiles` 条件下遍历。Round 2 审查对此项的复核准确。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#1 | BMAD 检测器遇到不可读目录或路径竞态时会抛出异常 | CR TODO / 非阻塞 | 同意维持 P2；属于文件系统鲁棒性补强，不阻塞 AC #1-#6 |
| R1-#2 | frontmatter 结束标记匹配过宽 | CR TODO / 非阻塞 | 同意维持 P2；属于误检边界收窄，不阻塞当前交付 |
| R1-#3 | BMAD frontmatter 检测只扫描前 64 个 Markdown 候选 | CR TODO / 非阻塞 | 同意维持 P2；属于大型仓库漏检风险优化，当前风险边界未扩大 |

---

## 发现 #1 评估

### 审查原文

> **Round 1 / Finding #1 — BMAD 检测器遇到不可读目录或路径竞态时会抛出异常**
> - 维持既有评估结论：CR TODO / P2 非阻塞。
> - 复核证据：`src/adapters/framework/bmad/detector.ts:64`、`src/adapters/framework/bmad/detector.ts:124`、`src/adapters/framework/bmad/detector.ts:131` 仍直接调用 `readdirSync()` / `lstatSync()`。

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

Round 2 审查准确复核了该历史发现。`src/adapters/framework/bmad/detector.ts:64` 对 skills 目录直接执行 `readdirSync()`，`src/adapters/framework/bmad/detector.ts:124` 对遍历路径直接执行 `lstatSync()`，`src/adapters/framework/bmad/detector.ts:131` 对目录直接执行 `readdirSync()`。这些路径仍可能在权限变化或遍历竞态下抛出异常。

**严重性判断：合理**

维持 P2 非阻塞合理。该问题影响异常文件系统场景下的自动检测稳定性，但不会改变正常路径下 BMAD adapter 注册、检测阈值、文档类型和预设规则的核心验收结果。Round 2 未提供新的证据表明风险扩大到阻塞交付。

**修复建议：可行但非必要**

继续建议在 skills 目录读取和 Markdown 候选遍历处增加局部 `try/catch`，不可读目录跳过或视为信号未命中，并补充异常路径测试。该修复可后续独立处理。

**误报评估：非误报**

代码状态与审查复核一致，非误报。

---

## 发现 #2 评估

### 审查原文

> **Round 1 / Finding #2 — frontmatter 结束标记匹配过宽，可能把非标准分隔符当作有效 YAML frontmatter**
> - 维持既有评估结论：CR TODO / P2 非阻塞。
> - 复核证据：`src/adapters/framework/bmad/detector.ts:152-162` 仍使用 `content.indexOf('\n---', 4)` 查找结束标记。

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

Round 2 审查准确复核了该历史发现。`src/adapters/framework/bmad/detector.ts:153` 仍只要求文件以 `---\n` 开头，`src/adapters/framework/bmad/detector.ts:157` 仍用 `content.indexOf('\n---', 4)` 定位结束标记，`src/adapters/framework/bmad/detector.ts:163` 仍直接截取内容；该逻辑仍未保证结束标记是独立一行。

**严重性判断：合理**

维持 P2 非阻塞合理。该问题可能增加 `bmad-frontmatter` 信号误检概率，但仍需结合双信号阈值才会触发 BMAD 框架识别；当前没有证据表明它破坏 Story AC 或造成实际扫描错误。

**修复建议：可行但非必要**

继续建议改为行级结束标记解析，只接受独立 `---` 行，并补充 `---not-a-delimiter`、带尾随文本、CRLF 等反例测试。该修复适合作为后续检测器健壮性补强。

**误报评估：非误报**

代码状态与审查复核一致，非误报。

---

## 发现 #3 评估

### 审查原文

> **Round 1 / Finding #3 — BMAD frontmatter 检测只扫描前 64 个 Markdown 候选，可能漏掉真实 BMAD 信号**
> - 维持既有评估结论：CR TODO / P2 非阻塞。
> - 复核证据：`src/adapters/framework/bmad/detector.ts:13` 仍定义 `MAX_FRONTMATTER_FILES = 64`，`src/adapters/framework/bmad/detector.ts:95` 仍按该上限收集候选。

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

Round 2 审查准确复核了该历史发现。`src/adapters/framework/bmad/detector.ts:13` 固定候选预算为 64，`src/adapters/framework/bmad/detector.ts:95` 使用该预算调用候选收集，`src/adapters/framework/bmad/detector.ts:117` 在达到上限后停止遍历，`src/adapters/framework/bmad/detector.ts:145` 每命中 Markdown 文件即占用预算。因此，大型仓库中确实可能出现有效 BMAD frontmatter 文件排序靠后而未被检测的情况。

**严重性判断：合理**

维持 P2 非阻塞合理。该问题主要影响特定大型仓库的 false negative 风险；检测器仍有 `_bmad`、`_bmad-output`、skills 目录、package 依赖等其他信号，且当前 Story 的核心验收路径未受影响。

**修复建议：可行但非必要**

继续建议优先扫描 `_bmad-output/`、`docs/`、项目根核心文档等高价值路径，或采用分层预算；同时补充超过 64 个 Markdown 候选且有效 frontmatter 位于靠后文件的测试。

**误报评估：非误报**

代码状态与审查复核一致，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮未确认阻塞交付问题 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | BMAD 检测器遇到不可读目录或路径竞态时会抛出异常 | [低] | **P2** | 历史发现仍存在，建议后续补局部 FS 容错和异常路径测试 |
| 2 | frontmatter 结束标记匹配过宽 | [低] | **P2** | 历史发现仍存在，建议后续改为行级结束标记解析并补反例测试 |
| 3 | BMAD frontmatter 检测只扫描前 64 个 Markdown 候选 | [低] | **P2** | 历史发现仍存在，建议后续采用高价值路径优先或分层预算策略 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮复核项均非误报，且无新增误报项 |

### 评估决定

- **发现 #1（不可读目录或路径竞态异常）**：确认仍存在；维持 CR TODO / P2 非阻塞。
- **发现 #2（frontmatter 结束标记匹配过宽）**：确认仍存在；维持 CR TODO / P2 非阻塞。
- **发现 #3（frontmatter 候选扫描上限可能漏检）**：确认仍存在；维持 CR TODO / P2 非阻塞。
- **新增发现**：本轮未确认新的阻塞项、中高优先级问题或误报项。
- **总体决定**：同意 Round 2 CR 的通过建议；Story 2-3 可继续流转，3 条 P2 鲁棒性补强项继续由 CR TODO 后续跟踪。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-08
- **Model Used**: GPT-5.4
- **Fix Items**: 0

#### 执行总结

- 根据 round 2 评估文件“需要修复（阻塞交付）”章节，本轮无需要修复条目。
- 未修改任何源码、测试文件或 Story 文档。
- 未执行额外编译或测试验证；原因是本轮无代码改动，沿用评估文件中既有验证结论。
