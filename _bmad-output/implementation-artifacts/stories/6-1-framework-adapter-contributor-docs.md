# Story 6.1: 框架适配贡献者文档

Status: ready-for-dev

## Story

As a 社区开发者，
I want 完整的框架适配开发者指南，
So that 我可以在 4 小时内为自己使用的框架编写最小可用的 CORD 适配模块。

## Acceptance Criteria (AC)

1. **Given** Epic 2 框架适配层已稳定 **When** 编写文档 **Then** `docs/adapter-guide.md` 包含 IFrameworkAdapter 接口 API 完整说明（FR42）
2. **Given** 文档 **When** 检查教程 **Then** 包含最小适配模块开发教程（含代码示例）
3. **Given** 文档 **When** 检查测试指南 **Then** 包含集成测试编写指南（含测试模板）
4. **Given** 文档 **When** 检查贡献指南 **Then** `docs/contributing.md` 包含 PR 规范和审阅流程
5. **Given** 参考实现 **When** 检查 **Then** BMAD 适配模块含源码注释（FR37）
6. **Given** 贡献者体验 **When** 评估 **Then** 4 小时内完成最小可用适配模块
7. **Given** 扩展性 **When** 新增适配 **Then** 核心模块测试 100% 通过，无需修改核心源码（NFR8）

## Tasks / Subtasks

- [ ] Task 1: 编写 adapter-guide.md (AC: #1, #2, #3)
- [ ] Task 2: 编写 contributing.md (AC: #4)
- [ ] Task 3: 为 BMAD 适配模块添加源码注释 (AC: #5)
- [ ] Task 4: 创建集成测试模板 (AC: #3)
- [ ] Task 5: 验证 4 小时开发体验 (AC: #6, #7)

## Dev Notes

### adapter-guide.md 内容大纲

1. IFrameworkAdapter 接口 API 参考
2. AbstractFrameworkAdapter 基类说明
3. 从零创建适配器教程（步骤式）
4. 文档类型注册示例
5. 预设规则编写示例
6. 集成测试模板和编写指南
7. 提交 PR 流程

### 文档语言

所有文档使用中文编写（document_output_language: Mandarin）

### Project Structure Notes

- `docs/adapter-guide.md`
- `docs/contributing.md`

### References

- [Source: prd.md#FR37, FR42] — 贡献者文档需求
- [Source: prd.md#NFR8] — 核心模块零变更
- [Source: epics.md#Story 6.1] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
