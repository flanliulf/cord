# Technical Research Recommendations

## 实现路线图

### Phase 1：CLI 骨架（1-2 天）
- [ ] 初始化项目结构（package.json + tsup + TypeScript）
- [ ] 实现 `bin/cord.js` 入口 + Commander 主程序
- [ ] 实现 `cord --version`、`cord --help`
- [ ] 配置 Vitest 测试框架

### Phase 2：核心命令（3-5 天）
- [ ] `cord init`（@clack/prompts 交互式向导 + `--no-interactive` flag）
- [ ] `cord scan`（调用 ScanService，复用 TR3 remark 解析器）
- [ ] `cord relation add/remove/list/search`（调用 RelationService）
- [ ] `cord status`（项目状态总览）

### Phase 3：输出与体验（1-2 天）
- [ ] 双输出模式实现（人类可读 + `--json`）
- [ ] 全局选项（`--verbose`、`--quiet`、`--no-color`）
- [ ] 错误处理 + 退出码规范

### Phase 4：集成与测试（2-3 天）
- [ ] CLI ↔ MCP Server 共享 Service 层验证
- [ ] E2E 测试套件
- [ ] `cord init` 生成 IDE 配置文件（.mcp.json 等）

## 技术栈最终推荐

| 类别 | 推荐方案 | 置信度 |
|------|---------|-------|
| **CLI 框架** | Commander.js v14 | 🟢 高（行业标杆、零依赖、TS 内置） |
| **交互式提示** | @clack/prompts v1.2 | 🟢 高（美观、极简、init 向导最佳匹配） |
| **终端颜色** | picocolors v1.1 | 🟢 高（零依赖、性能 2x chalk、趋势向好） |
| **构建工具** | tsup v8.5 | 🟢 高（esbuild 加速、external 原生模块） |
| **开发运行** | tsx v4.21 | 🟢 高（TS 直接执行、watch 模式） |
| **测试框架** | Vitest v3 | 🟢 高（与 Vite 生态一致、ESM 原生支持） |
| **Spinner** | ora v9 或 @clack/prompts 内置 | 🟡 中（ora ESM-only；clack 自带 spinner） |
| **表格输出** | cli-table3 | 🟡 中（关系列表展示；可后续按需引入） |

## 成功指标与 KPI

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **冷启动速度** | < 200ms | `time cord --version` |
| **命令响应时间** | < 500ms（典型操作） | E2E 测试计时 |
| **测试覆盖率** | > 80%（Service 层 > 90%） | Vitest coverage |
| **npx 首次安装** | < 15s（网络正常） | 手动测试 |
| **包体积** | < 5MB（不含 better-sqlite3 prebuild） | `npm pack` |
| **零配置启动** | `npx cord init` 一步完成 | 用户测试 |

---
