---
Story: 2-2
Round: 1
Date: 2026-05-07
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。审查层状态：Blind Hunter、Edge Case Hunter、Acceptance Auditor 均完成，无失败层。`npm test`、`npm run lint`、`npm run build`、`npm run type-check` 均通过；但存在 1 个 AC8 阻塞问题，建议修复后再通过本 Story。

## 新发现

### 1. [高] ScanPipeline.process 未调用预检，非 Markdown 与超大文件不会被管道跳过

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/scanner/pipeline.ts:26` 定义了 `precheckScannableFile(filePath, fileSizeBytes)`，并在 `src/scanner/pipeline.ts:31` 判断 `fileSizeBytes > MAX_SCANNABLE_FILE_SIZE_BYTES`。
  - `src/scanner/pipeline.ts:79-81` 的 `ScanPipeline.process` 入口直接执行 `readFileOrThrow(filePath)` 和 `decodeUtf8OrSkip(filePath, rawFile)`，未调用预检逻辑。
  - `tests/unit/scanner/pipeline.test.ts:132-139` 只验证 helper 返回 warning 字符串，没有验证 `process()` 对非 Markdown 或 >1MB 文件会跳过并记录 WARNING。

- **影响**
  - Story AC8 要求异常文档扫描时跳过并记录 WARNING（编码错误/非 Markdown/超大 >1MB）。当前编码错误路径满足，但直接调用 `ScanPipeline.process()` 时，非 Markdown 和超大文件仍会被读入并交给 remark 解析，既可能违反验收标准，也削弱 NFR16 的资源防护意图。

- **建议**
  - 在 `ScanPipeline.process()` 读取/解析前补上文件大小与扩展名预检；命中时记录 warning 并返回 `null`，或明确将预检责任移到调用方并在 Story 2.2 中提供调用方集成与测试证据。
  - 增加 `process()` 级别测试：非 `.md` 文件跳过、`MAX_SCANNABLE_FILE_SIZE_BYTES + 1` 文件跳过、warning 可被调用方获取。

### 2. [低] Markdown 链接规则仅过滤 http/https，其他 URI scheme 仍进入路径解析

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/scanner/rules/markdown-link-rule.ts:100-112` 的 `sanitizeReference` 仅过滤空值、锚点、`http://`、`https://`，随后继续剥离 fragment/query 并返回路径。
  - `tests/unit/scanner/rules.test.ts:132-146` 包含 `mailto:test@example.com`，但该测试只证明当前 fixture 下没有额外关系，没有明确锁定所有非文件 URI scheme 都应跳过。

- **影响**
  - `mailto:`、`tel:`、`file:` 等 URI 会进入普通路径解析与唯一后缀匹配。通常不会命中，但一旦候选文档路径出现相同后缀，可能产生噪声关系；同时也让“跳过外部链接”的规则边界不够清晰。

- **建议**
  - 在 `sanitizeReference` 中用通用 URI scheme 判断过滤非文档协议，或明确只允许相对路径、根路径和 `.md` 目标进入解析。
  - 补充测试覆盖 `mailto:`、`tel:`、`file:` 不会生成关系。

## 验证摘要

- `npm test` ✅ 通过（226 / 226）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- `npm run type-check` ✅ 通过
- 覆盖率 ✅ `coverage/coverage-summary.json` 显示 scanner 相关总覆盖率：statements 98.52%、branches 91.26%、functions 100%、lines 98.51%
- 定向复核 ✅ 已对照 Story AC1-AC9、File List、scanner 源码与测试进行首轮 CR

## 通过项

- AC1：`ScanPipeline` 已编排 unified/remarkParse/remarkFrontmatter/remarkGfm 与三类提取插件。
- AC2：extract-frontmatter、extract-links、extract-headings 三个插件均存在并有测试覆盖。
- AC3：`IScanRule`、`ScanRuleRegistry` 与默认规则注册已实现。
- AC4/AC6/AC7：三条规则均输出文档级 `DiscoveredRelation`，并设置要求范围内的 confidence。
- AC9：覆盖率门槛满足，测试门禁通过。
- 已知非阻塞：AC5 当前使用 9 种关系类型中的相关子集（references、derived_from、contains、lifecycle_bound）；未看到本 Story 输入中要求强行覆盖全部 9 种自动识别逻辑的证据，暂不作为阻塞。
