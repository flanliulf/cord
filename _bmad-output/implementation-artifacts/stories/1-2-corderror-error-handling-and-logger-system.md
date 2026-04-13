# Story 1.2: CordError 错误处理体系与 Logger 日志系统

Status: ready-for-dev

## Story

As a 开发者，
I want 统一的错误处理类层级和四级日志系统，
So that 所有模块可以使用一致的错误报告和日志输出模式。

## Acceptance Criteria (AC)

1. **Given** Story 1.1 的项目骨架已就绪 **When** 引入 CordError 错误体系 **Then** `src/utils/errors.ts` 提供 CordError 基类（含 `code: string`、`suggestion: string`、`context: Record<string, unknown>`）
2. **Given** CordError 基类已定义 **When** 检查子类 **Then** 提供至少 5 个子类：ScanError、QueryError、ConfigError、StorageError、AdapterError
3. **Given** 错误子类已定义 **When** 检查错误码 **Then** 遵循 `CORD_{MODULE}_{NNN}` 命名规范
4. **Given** Story 1.1 的项目骨架已就绪 **When** 引入 Logger 日志系统 **Then** `src/utils/logger.ts` 提供 debug/info/warn/error 四个级别
5. **Given** Logger 已定义 **When** 默认状态 **Then** 隐藏 debug 级别，`CORD_DEBUG=1` 或 `--verbose` 启用
6. **Given** Logger 在 CLI 模式 **When** 输出日志 **Then** 使用 picocolors 着色输出到 stdout/stderr
7. **Given** Logger 在 MCP Server 模式 **When** 输出日志 **Then** 所有日志输出到 stderr（不污染 stdout JSON-RPC 通道）
8. **Given** 错误体系和日志系统已实现 **When** 运行测试 **Then** 单元测试覆盖所有错误子类和所有日志级别（≥ 90% 覆盖率）

## Tasks / Subtasks

- [ ] Task 1: 实现 CordError 基类 (AC: #1)
  - [ ] 1.1 在 `src/utils/errors.ts` 定义 CordError 继承 Error
  - [ ] 1.2 基类属性：`code: string`、`suggestion: string`、`context: Record<string, unknown>`
  - [ ] 1.3 构造函数接受 `{ message, code, suggestion, context?, cause? }`
  - [ ] 1.4 重写 `name` getter 返回类名
- [ ] Task 2: 实现 5+ 错误子类 (AC: #2, #3)
  - [ ] 2.1 `ScanError`——错误码前缀 `CORD_SCAN_`
  - [ ] 2.2 `QueryError`——错误码前缀 `CORD_QUERY_`
  - [ ] 2.3 `ConfigError`——错误码前缀 `CORD_CONFIG_`
  - [ ] 2.4 `StorageError`——错误码前缀 `CORD_STORAGE_`
  - [ ] 2.5 `AdapterError`——错误码前缀 `CORD_ADAPTER_`
  - [ ] 2.6 每个子类可接收额外的特定 context 字段
- [ ] Task 3: 实现 Logger (AC: #4, #5, #6, #7)
  - [ ] 3.1 在 `src/utils/logger.ts` 定义 Logger 类或模块
  - [ ] 3.2 四个级别方法：debug()、info()、warn()、error()
  - [ ] 3.3 运行模式检测：CLI 模式 vs MCP 模式（通过环境变量或初始化参数）
  - [ ] 3.4 CLI 模式：picocolors 着色，info/warn → stdout，error → stderr
  - [ ] 3.5 MCP 模式：所有级别输出到 stderr（P12 规则）
  - [ ] 3.6 debug 级别默认关闭，`CORD_DEBUG=1` 或 verbose 标志启用
  - [ ] 3.7 提供 `setVerbose(boolean)` 和 `setMode('cli' | 'mcp')` 方法
- [ ] Task 4: 更新 index.ts 门面 (AC: #1)
  - [ ] 4.1 更新 `src/utils/index.ts` 导出 CordError 及所有子类
  - [ ] 4.2 更新 `src/utils/index.ts` 导出 Logger
- [ ] Task 5: 编写单元测试 (AC: #8)
  - [ ] 5.1 `tests/unit/utils/errors.test.ts`——测试基类和每个子类
  - [ ] 5.2 `tests/unit/utils/logger.test.ts`——测试所有级别、模式切换、verbose 控制
  - [ ] 5.3 确保覆盖率 ≥ 90%

## Dev Notes

### CordError 实现要点

```typescript
// src/utils/errors.ts
export class CordError extends Error {
  readonly code: string;
  readonly suggestion: string;
  readonly context: Record<string, unknown>;

  constructor(params: {
    message: string;
    code: string;
    suggestion: string;
    context?: Record<string, unknown>;
    cause?: Error;
  }) {
    super(params.message, { cause: params.cause });
    this.code = params.code;
    this.suggestion = params.suggestion;
    this.context = params.context ?? {};
  }

  get name(): string {
    return this.constructor.name;
  }
}

// 子类示例
export class ScanError extends CordError {
  constructor(params: Omit<ConstructorParameters<typeof CordError>[0], 'code'> & { code?: string }) {
    super({ ...params, code: params.code ?? 'CORD_SCAN_000' });
  }
}
```

### 错误码规范

- 格式：`CORD_{MODULE}_{NNN}`
- MODULE 取值：SCAN / QUERY / CONFIG / STORAGE / ADAPTER
- NNN：三位数字，从 001 开始
- 预定义错误码（本 Story 仅定义结构，具体错误码在后续 Story 使用时逐步添加）：
  - `CORD_SCAN_001` — 扫描根目录无效
  - `CORD_QUERY_001` — 文档不存在
  - `CORD_CONFIG_001` — 配置文件解析失败
  - `CORD_STORAGE_001` — 数据库连接失败
  - `CORD_ADAPTER_001` — 适配器加载失败

### Logger 实现要点

- **不要使用 winston/pino 等日志库**——架构决策 D4 明确要求自研轻量 Logger
- picocolors 着色方案：
  - debug: `pc.gray()`
  - info: `pc.cyan()` 或 `pc.blue()`
  - warn: `pc.yellow()`
  - error: `pc.red()`
- stderr 输出使用 `process.stderr.write()`，不是 `console.error()`（避免额外换行处理差异）
- Logger 应为单例或模块级实例，所有模块共享同一个 Logger
- MCP 模式判断：可通过 `process.env.CORD_MCP_MODE` 或初始化时显式设置

### 错误处理流程（P12 规则）

```
Service 层 → throw CordError 子类（携带 code + suggestion）
    ↓
CLI 入口 → catch → picocolors 格式化 → process.exit(1)
MCP 入口 → catch → 转为 MCP 标准错误响应
```

**绝不：**
- Service 层直接 `console.log` 或 `process.exit`
- MCP 层输出到 stdout
- 吞掉异常不处理

### 测试要点

- 每个 CordError 子类测试：构造、属性检查、`instanceof` 链、`name` getter、`cause` 传递
- Logger 测试需要 mock `process.stdout.write`/`process.stderr.write` 和 `process.env`
- 测试 verbose 切换前后 debug 输出行为变化
- 测试 CLI 模式 vs MCP 模式输出目标差异

### 架构约束提醒

- **P6**: 必须通过 `src/utils/index.ts` 导出，其他层通过门面引用
- **P14**: 导入排序：Node 内置 → picocolors → 内部模块
- **P15**: 公共 API 必须有 JSDoc 注释

### Project Structure Notes

- `src/utils/errors.ts` — CordError 基类 + 5 个子类
- `src/utils/logger.ts` — 四级 Logger
- `src/utils/index.ts` — 更新门面导出
- `tests/unit/utils/errors.test.ts` — 错误体系测试
- `tests/unit/utils/logger.test.ts` — 日志系统测试

### References

- [Source: architecture/core-architectural-decisions.md#D3] — CordError 自定义错误类层级
- [Source: architecture/core-architectural-decisions.md#D4] — 自研轻量 Logger
- [Source: architecture/implementation-patterns-consistency-rules.md#P12] — 错误处理流程
- [Source: architecture/implementation-patterns-consistency-rules.md#P15] — 注释规范
- [Source: epics.md#Story 1.2] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
