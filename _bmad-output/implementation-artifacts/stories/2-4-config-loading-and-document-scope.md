# Story 2.4: 配置加载与文档管辖范围

Status: ready-for-dev

## Story

As a 用户，
I want 通过 cord.config 配置文件控制文档扫描范围和行为，
So that 我可以自定义哪些文档被扫描、哪些路径被排除。

## Acceptance Criteria (AC)

1. **Given** Stories 2.1-2.3 就绪 **When** 实现配置加载 **Then** `src/utils/config-loader.ts` 支持加载 `cord.config.yaml`（优先）和 `cord.config.json`
2. **Given** 配置加载 **When** 验证 **Then** 配置通过 Zod schema 验证
3. **Given** 配置系统 **When** 检查配置项 **Then** 支持 7 项配置：framework、ide、scanPaths、excludePaths、confidenceThreshold、relationTypes、adapters
4. **Given** 未配置时 **When** 使用默认值 **Then** 所有配置项均可选，使用合理默认值
5. **Given** 管辖范围 **When** 检查 **Then** 包括框架产出文档、AI IDE 指令规范文档、用户文档（FR38）
6. **Given** 排除规则 **When** 检查 **Then** 排除 src/、node_modules/、.git/、dist/（FR39）
7. **Given** 框架预设 **When** 检查 **Then** 支持已支持框架和 IDE 的预设文档路径（FR40）
8. **Given** 用户自定义 **When** 覆盖配置 **Then** 用户配置可覆盖预设（FR41）
9. **Given** 实现完毕 **When** 运行测试 **Then** 覆盖 YAML/JSON 加载 + Zod 验证 + 默认值回退 + 路径排除

## Tasks / Subtasks

- [ ] Task 1: 实现 config-loader.ts (AC: #1, #2, #3, #4)
  - [ ] 1.1 加载优先级：cord.config.yaml > cord.config.json
  - [ ] 1.2 Zod schema 验证
  - [ ] 1.3 默认值合并
- [ ] Task 2: 默认配置定义 (AC: #4, #6)
  - [ ] 2.1 默认 excludePaths: ["src/", "node_modules/", ".git/", "dist/"]
  - [ ] 2.2 默认 confidenceThreshold: 0.50
  - [ ] 2.3 默认 scanPaths: ["."]
- [ ] Task 3: 框架/IDE 预设路径集成 (AC: #5, #7, #8)
- [ ] Task 4: 更新 index.ts 门面
- [ ] Task 5: 编写测试 (AC: #9)

## Dev Notes

### 配置加载函数签名

```typescript
// src/utils/config-loader.ts
export function loadConfig(projectRoot: string): CordConfig
```

- 同步函数（启动阶段调用）
- 文件不存在时返回默认配置（不报错）
- 文件存在但无效时抛出 ConfigError

### YAML 解析

使用 `gray-matter`（已安装）的 YAML 解析能力，或直接解析 YAML。配置文件不含 frontmatter，直接解析整个文件为 YAML 对象。

### 默认配置

```typescript
const DEFAULT_CONFIG: CordConfig = {
  scanPaths: ['.'],
  excludePaths: ['src/', 'node_modules/', '.git/', 'dist/', '.cord/'],
  confidenceThreshold: 0.50,
};
```

### 架构约束

- **D6**: YAML + JSON 双格式，YAML 优先
- Zod 验证失败 → ConfigError

### Project Structure Notes

- `src/utils/config-loader.ts` — 配置加载器
- `tests/unit/utils/config-loader.test.ts` — 测试
- `tests/fixtures/configs/valid-config.yaml` — 有效配置 fixture
- `tests/fixtures/configs/invalid-config.yaml` — 无效配置 fixture

### References

- [Source: architecture/core-architectural-decisions.md#D6] — 配置文件格式
- [Source: prd.md#FR38-FR41] — 文档管辖范围
- [Source: prd.md#cord.config] — 配置 schema
- [Source: epics.md#Story 2.4] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
