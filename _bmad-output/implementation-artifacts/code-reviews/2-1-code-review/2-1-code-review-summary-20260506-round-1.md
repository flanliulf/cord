---
Story: 2-1
Round: 1
Date: 2026-05-06
Model Used: GitHub Copilot (copilot)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均返回结果；子代理输出落点发生降级（b1 未在工作区落盘，b2/b3 写入会话内存），已从返回摘要和会话内存恢复并纳入分类。`npm test`、`npm run lint`、`npm run build`、`npm run test:coverage` 均通过；但发现 1 个高严重性阻塞问题，建议修复后复审。

## 新发现

### 1. [高] 递归扫描未处理符号链接，可能扫描项目外文件或陷入循环

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/adapters/framework/abstract-base.ts:83-96` 使用 `statSync(currentPath)` 判断条目类型，`statSync` 会跟随符号链接；随后目录分支直接 `readdirSync(currentPath)` 并递归进入子路径。
  - 项目边界检查发生在 `toProjectRelativePath(projectRoot, currentPath)`，它基于 symlink 路径本身计算相对路径，而不是基于 `realpath`。项目内 symlink 若指向项目外目录，仍会被当作项目内路径继续扫描。

- **影响**
  - Generic 默认从项目根扫描，项目内的 symlink 可能把项目外 Markdown 纳入候选文档，带来数据泄露/扫描越界风险。
  - 指向祖先目录或循环目录的 symlink 可能造成无限递归或堆栈溢出，阻塞扫描流程。

- **建议**
  - 在递归入口使用 `lstatSync()` 识别并跳过 symlink，或使用 `realpathSync()` + visited set 检测循环并再次校验真实路径仍位于 `projectRoot` 内。
  - 补充单元测试：项目内 symlink 指向项目外目录不应被扫描；循环 symlink 不应导致递归失控。

### 2. [中] 文件系统竞态或权限错误会以原生异常中断扫描

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/adapters/framework/abstract-base.ts:46-52` 只在入口 `scanPath` 上使用 `existsSync()` 检查存在性。
  - `src/adapters/framework/abstract-base.ts:83-88` 在递归过程中直接调用 `statSync()` / `readdirSync()`，没有错误包装或恢复策略。

- **影响**
  - 扫描期间文件被删除、权限不足、目录不可读等常见文件系统竞态会直接抛出 Node 原生异常，中断整个文档发现流程。
  - 这与项目错误处理规则中“异常应包装为 CordError 子类并携带 code/suggestion”的方向不一致，后续 CLI/MCP 层难以给出稳定诊断。

- **建议**
  - 明确不可读路径的契约：要么跳过并记录诊断，要么转换为结构化 `CordError`。
  - 给 `statSync()` / `readdirSync()` 分支补充定向测试：文件消失、权限不可读、非目录扫描入口等场景。

### 3. [低] 深层大目录使用同步递归扫描会阻塞 CLI/MCP 调用

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/adapters/framework/abstract-base.ts:41-55` 的 `discoverDocuments()` 同步遍历所有 scanPaths。
  - `src/adapters/framework/abstract-base.ts:83-96` 递归过程中使用 `statSync()` / `readdirSync()`，且 Generic 默认扫描项目根目录。

- **影响**
  - 对包含大量文档、归档目录或深层目录的项目，扫描会阻塞 Node.js 事件循环。
  - 在 MCP Server 场景下，该阻塞可能表现为请求响应卡顿；在 CLI 场景下则表现为长时间无反馈。

- **建议**
  - 若当前 Story 保持同步接口，至少增加目录规模/深度保护或可配置排除建议。
  - 后续接入 ScanService 时评估异步文件 I/O 或分批遍历，并增加大目录行为测试。

## 验证摘要

- `npm test` ✅ 通过（209 / 209）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- `npm run test:coverage` ✅ 通过（209 / 209）
  - All files: Stmts 95.85%、Branch 91.86%、Funcs 97.61%、Lines 96.13%
  - `src/adapters/framework`: Stmts 86.79%、Branch 80.55%、Funcs 91.66%、Lines 86.79%
- 定向复现：未写入额外复现测试；本轮基于 diff、代码路径和三层审查输出完成静态验证。

## 通过项

- AC#1-AC#3：`IFrameworkAdapter`、`AbstractFrameworkAdapter`、`GenericFrameworkAdapter` 均已实现，接口契约与基本职责匹配 Story 要求。
- AC#4-AC#5：`scanPaths` / `excludePaths` 合并逻辑存在，Generic 默认排除 `src/`、`node_modules/`、`.git/`、`dist/`。
- AC#6：适配器通过 `frameworkAdapters` 声明式注册，且测试覆盖 Generic 位于末尾的兜底顺序。
- AC#7：新增 framework adapter 单元测试覆盖接口契约、文档发现、路径排除和 adapter resolution；覆盖率门槛已通过。
- 未纳入新发现：glob 模式支持、文档类型 name 格式约束、Generic 注册表未来扩展顺序等属于后续设计增强或规则约束，不构成本轮明确阻塞。
