---
Story: 2-1
Round: 1
Date: 2026-05-07
Model Used: GitHub Copilot (copilot)
Review Source: 2-1-code-review-summary-20260506-round-1.md
Review Model: GitHub Copilot (copilot)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-1 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 3 条发现：递归扫描未处理符号链接、递归过程中的文件系统异常未结构化处理、同步递归扫描可能阻塞 CLI/MCP 调用。经代码核验，3 条均不是误报；其中 #1 命中项目边界与递归终止风险，应作为 P1 阻塞项修复；#2 与 #3 有效但建议降级为 P2 CR TODO，不阻塞当前 Story 交付。

---

## 发现 #1 评估

### 审查原文

> **[高] 递归扫描未处理符号链接，可能扫描项目外文件或陷入循环**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`AbstractFrameworkAdapter.discoverDocuments()` 默认会对去重后的 `scanPaths` 逐个递归扫描，并将 `projectRoot + scanPath` 解析成绝对路径后进入 `collectMarkdownFiles()`（`src/adapters/framework/abstract-base.ts:41-52`）。递归入口先用 `toProjectRelativePath(projectRoot, currentPath)` 基于当前路径字符串判断是否仍在项目根内（`src/adapters/framework/abstract-base.ts:74-82`），但随后用 `statSync(currentPath)` 判断文件类型（`src/adapters/framework/abstract-base.ts:84`）。Node 的 `statSync()` 会跟随 symlink，因此项目内 symlink 指向项目外目录时，边界判断仍看到的是项目内 symlink 路径，而目录遍历实际进入的是 symlink 目标。

目录分支继续对 `readdirSync(currentPath).sort()` 的结果递归调用自身（`src/adapters/framework/abstract-base.ts:86-94`），没有 `lstatSync()`、`realpathSync()` 或 visited set。若项目内 symlink 指向祖先目录或形成目录环，递归路径会不断增长并重复进入同一真实目录。Generic 适配器默认排除仅包含 `src/`、`node_modules/`、`.git/`、`dist/`（`src/adapters/framework/generic/adapter.ts:4`、`src/adapters/framework/generic/adapter.ts:32`），并不包含 symlink 防护。现有单元测试只创建普通目录和普通文件夹夹具（`tests/unit/adapters/framework.test.ts:46-62`），文档发现测试也只覆盖普通目录、排除目录和自定义扫描路径（`tests/unit/adapters/framework.test.ts:104-139`），没有覆盖 symlink 越界或循环。

**严重性判断：合理**

原始严重性为 [高] 合理。该问题不只是性能退化：它会突破 Story 声称的“项目根目录边界保护”实现意图，并可能把项目外 Markdown 纳入候选文档集合；同时，目录环会造成递归失控。由于 `GenericFrameworkAdapter` 是兜底适配器且默认从项目根扫描，该风险会影响未命中特定框架的普通项目，建议作为 P1 阻塞项处理。

**修复建议：可行**

审查建议可行。最小修复路径是递归入口改用 `lstatSync()` 识别并跳过 symlink；如果未来需要支持跟随 symlink，则应使用 `realpathSync()` 维护 visited set，并在真实路径层面重新校验仍位于 `projectRoot` 内。对应测试应至少覆盖“项目内 symlink 指向项目外目录不被扫描”和“循环 symlink 不导致递归失控”。

**误报评估：非误报**

非误报。代码路径和现有测试缺口均支持该发现。

---

## 发现 #2 评估

### 审查原文

> **[中] 文件系统竞态或权限错误会以原生异常中断扫描**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`discoverDocuments()` 只在每个 scan path 入口使用 `existsSync(absoluteScanPath)` 做一次存在性检查（`src/adapters/framework/abstract-base.ts:46-52`）。进入递归后，`collectMarkdownFiles()` 直接调用 `statSync(currentPath)` 和 `readdirSync(currentPath)`（`src/adapters/framework/abstract-base.ts:84-87`），没有 try/catch，也没有转换为项目内定义的 `CordError` 子类。项目错误处理规则要求 Service 方法不抛非 `CordError` 的异常（`_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:160-173`），并要求 Service 层抛出携带 code 与 suggestion 的 `CordError` 子类，CLI/MCP 再统一转换展示或协议错误（`_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:175-183`）。虽然当前代码位于 adapter 层而非 Service 层，但它的 public API 会被 ScanService 编排调用，原生 `ENOENT` / `EACCES` 等异常若不上抛前转换，会削弱上层诊断稳定性。

现有测试没有权限不可读、扫描期间文件消失或入口类型异常的用例。`tests/unit/adapters/framework.test.ts` 目前只验证普通夹具目录、普通 Markdown 文件、排除路径和 adapter resolution（`tests/unit/adapters/framework.test.ts:104-177`）。

**严重性判断：偏高**

原始严重性为 [中]，问题本身有效，但作为 Story 2-1 的交付阻塞依据偏高。Story 2-1 的 AC 关注接口、抽象基类、Generic fallback、scanPaths/excludePaths 和基础单元测试；错误包装契约更接近后续 ScanService 编排接入时的边界治理。建议降级为 P2 CR TODO：不阻塞当前 Story，但应在 ScanService 接入或本递归逻辑修补时一并处理。

**修复建议：可行**

审查建议可行，但需要先明确契约：不可读路径是跳过并记录诊断，还是直接转换为 `ScanError` / `AdapterError`。若直接转换为 `CordError`，应避免把单个临时文件竞态升级为整个项目扫描失败，除非入口 scan path 本身不可读。

**误报评估：非误报**

非误报。实现确实会让原生 fs 异常逃逸；只是优先级建议降为 P2。

---

## 发现 #3 评估

### 审查原文

> **[低] 深层大目录使用同步递归扫描会阻塞 CLI/MCP 调用**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

`discoverDocuments()` 当前返回 `string[]`，并同步遍历全部 `scanPaths`（`src/adapters/framework/abstract-base.ts:41-55`）。递归过程使用同步 `statSync()` / `readdirSync()`（`src/adapters/framework/abstract-base.ts:84-96`）。接口本身也将 `discoverDocuments()` 定义为同步返回 `string[]`（`src/adapters/framework/interfaces.ts:59`）。因此，在大量目录或深层目录下阻塞 Node.js 事件循环的判断成立。

但该同步行为也符合当前 Story 的接口形态和 Dev Notes：Story 2-1 要求实现通用文件发现，Dev Notes 明确写的是“递归遍历 scanPaths，过滤 excludePaths，只保留 .md 文件”和“使用 node:fs 和 node:path”（`_bmad-output/implementation-artifacts/stories/2-1-framework-adapter-interface-and-generic-fallback.md:72-73`）。架构规则 P13 也并未要求所有文件 I/O 一律异步，而是规定 Service 层“同步为主（文件 I/O 用 async）”、Scanner 引擎 async、CLI/MCP 入口 async（`_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:189-196`）。

**严重性判断：合理但不阻塞**

原始严重性为 [低] 合理。它是实际性能风险，但当前 Story 不是完整 ScanService 冷启动扫描，也没有大目录 SLA 或异步接口 AC。建议作为 P2 CR TODO 记录到后续扫描编排阶段：在接入 ScanService、目录规模保护、进度反馈或异步文件 I/O 策略时统一解决。

**修复建议：可行但非必要**

“增加目录规模/深度保护或可配置排除建议”可行，但若在 Story 2-1 中直接改变接口为 async，可能扩大改动范围并影响后续 Story 契约。更合适的短期动作是记录 CR TODO，并在后续 ScanService 设计中决定是否异步化、分批遍历或加入上限保护。

**误报评估：非误报**

非误报。同步递归阻塞风险真实存在；只是当前阶段不应作为交付阻塞项。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 递归扫描未处理符号链接，可能扫描项目外文件或陷入循环 | [高] | **P1** | `statSync()` 跟随 symlink 且边界检查基于 symlink 路径字符串，存在越界扫描和递归失控风险 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | 文件系统竞态或权限错误会以原生异常中断扫描 | [中] | **P2** | 问题有效，但错误包装契约更适合在 ScanService 编排接入时统一落地 |
| 3 | 深层大目录使用同步递归扫描会阻塞 CLI/MCP 调用 | [低] | **P2** | 性能风险真实存在，但当前 Story 接口即为同步返回，建议后续扫描编排阶段治理 |

### 可忽略（误报）

无。3 条发现均不是误报。

### 评估决定

- **发现 #1（符号链接越界/循环扫描）**：确认有效，维持高优先级，建议必须修复后再进入下一轮 CR。
- **发现 #2（原生 fs 异常逃逸）**：确认有效但降级为 P2，建议纳入 CR TODO；如果修复 #1 时已集中重写递归入口，可顺手补充 try/catch 与结构化错误策略，但不作为独立阻塞项。
- **发现 #3（同步递归阻塞）**：确认有效但降级为 P2，建议纳入 CR TODO，在 ScanService 冷启动扫描或性能治理 Story 中统一处理。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-07
- **Model Used**: GPT-5.4
- **Fix Items**: 1

#### Fix Item 1：发现 #1 符号链接越界/循环扫描
- **评估结论**: 需要修复（P1）
- **修改文件**:
	- `src/adapters/framework/abstract-base.ts`
	- `tests/unit/adapters/framework.test.ts`
- **修复内容**:
	- 将递归入口的文件类型判断从 `statSync()` 改为 `lstatSync()`。
	- 在进入目录/文件分支前直接跳过 `isSymbolicLink()` 命中的路径，避免跟随 symlink 扫描项目外目录或进入循环路径。
	- 新增 2 条回归测试，分别覆盖“项目内 symlink 指向项目外目录不被扫描”和“循环 symlink 不会递归失控”。
- **关键差异**:
	- 修复前：递归会跟随 symlink 进入目标目录，可能产生 `external-link/outside.md` 这类越界候选路径，并存在循环递归入口。
	- 修复后：发现阶段把 symlink 视为不可递归边界，既不扫描其目标内容，也不进入循环路径。
- **验证结果**:
	- `npm test -- tests/unit/adapters/framework.test.ts` ✅
	- `npm run type-check` ✅
	- `npm run lint` ✅
	- `npm test` ✅
- **执行结果**: 已完成