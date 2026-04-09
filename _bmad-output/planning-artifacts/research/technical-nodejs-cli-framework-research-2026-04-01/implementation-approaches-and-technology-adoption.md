# Implementation Approaches and Technology Adoption

## 开发工作流与工具链

### package.json 核心配置

```json
{
  "name": "cord",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "cord": "./dist/cli/index.js"
  },
  "main": "./dist/mcp/index.js",
  "exports": {
    ".": "./dist/mcp/index.js",
    "./cli": "./dist/cli/index.js"
  },
  "files": ["dist", "bin"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/cli/index.ts",
    "dev:mcp": "tsx src/mcp/index.ts",
    "build": "tsup",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "@clack/prompts": "^1.2.0",
    "better-sqlite3": "^11.0.0",
    "picocolors": "^1.1.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.5.0",
    "tsx": "^4.21.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0"
  }
}
```

**关键设计决策：**

| 字段 | 值 | 原因 |
|------|------|------|
| `"type": "module"` | ESM-first | 与 picocolors、@clack/prompts 等 ESM 库对齐 |
| `"bin"` | 指向 `dist/cli/index.js` | 构建后的 CLI 入口，`npx cord` 直接执行 |
| `"engines"` | `>=18.0.0` | better-sqlite3 和 MCP SDK 的最低要求 |
| `"exports"` | 双入口 | CLI 和 MCP Server 分别可导入 |

_Source: [npm registry - tsup](https://registry.npmjs.org/tsup/latest), [npm registry - tsx](https://registry.npmjs.org/tsx/latest)_

### bin/cord.js 入口文件

```javascript
#!/usr/bin/env node

// 快速失败：Node.js 版本检查
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('CORD requires Node.js 18 or higher. Current: ' + process.version);
  process.exit(1);
}

import('../dist/cli/index.js');
```

### tsup 构建配置

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI 构建
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist/cli',
    external: ['better-sqlite3'],
    clean: true,
    sourcemap: true,
    splitting: true,    // 共享代码拆分（Service/Repository 层）
    treeshake: true,
  },
  // MCP Server 构建
  {
    entry: ['src/mcp/index.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist/mcp',
    external: ['better-sqlite3'],
    clean: true,
    sourcemap: true,
    splitting: true,
    treeshake: true,
  },
]);
```

_Source: [tsup v8.5.1](https://registry.npmjs.org/tsup/latest)_

### 开发阶段工作流

```bash
# 1. CLI 开发（热重载）
npm run dev              # tsx watch src/cli/index.ts

# 2. 本地测试 CLI 命令
npx tsx src/cli/index.ts scan ./docs
npx tsx src/cli/index.ts relation list --json

# 3. MCP Server 开发测试
npm run dev:mcp          # tsx src/mcp/index.ts

# 4. 构建 + 本地链接测试 npx 体验
npm run build
npm link
cord init                # 像用户一样测试

# 5. 运行测试
npm test                 # vitest（watch 模式）
npm run test:coverage    # 覆盖率报告
```

_Source: [tsx v4.21.0](https://registry.npmjs.org/tsx/latest)_

---

## 测试与质量保障策略

### 测试分层架构

| 层级 | 测试类型 | 工具 | 覆盖目标 |
|------|---------|------|---------|
| **Service 层** | 单元测试 | Vitest + mock DB | 业务逻辑正确性 |
| **Repository 层** | 集成测试 | Vitest + 内存 SQLite | SQL 查询正确性 |
| **CLI 命令层** | E2E 测试 | Vitest + execa | 命令行为完整性 |
| **MCP Tool 层** | 集成测试 | Vitest + MCP Client mock | Tool 注册和响应 |

### CLI 测试模式

**模式 A：Commander `.exitOverride()` + `.parseAsync()` 测试**

```typescript
// tests/cli/commands/relation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { createRelationCommand } from '../../../src/cli/commands/relation';

describe('cord relation add', () => {
  it('should call RelationService.add with correct params', async () => {
    const mockAdd = vi.fn().mockResolvedValue({ id: 1 });
    // 注入 mock service
    const cmd = createRelationCommand({ relationService: { add: mockAdd } });

    const program = new Command();
    program.addCommand(cmd);
    program.exitOverride(); // 防止 process.exit

    await program.parseAsync(['node', 'cord', 'relation', 'add', 'a.md', 'b.md', '-t', 'extends']);

    expect(mockAdd).toHaveBeenCalledWith('a.md', 'b.md', 'extends');
  });
});
```

**模式 B：E2E 测试（真实 CLI 进程）**

```typescript
// tests/e2e/cli.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execaCommand } from 'execa';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('cord CLI E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cord-test-'));
  });

  it('cord init creates .cord directory', async () => {
    const { stdout, exitCode } = await execaCommand(
      `npx tsx src/cli/index.ts init --no-interactive`,
      { cwd: tempDir }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('initialized');
  });

  it('cord relation list --json returns valid JSON', async () => {
    // 先初始化
    await execaCommand(`npx tsx src/cli/index.ts init --no-interactive`, { cwd: tempDir });
    // 再查询
    const { stdout } = await execaCommand(
      `npx tsx src/cli/index.ts relation list --json`,
      { cwd: tempDir }
    );
    expect(() => JSON.parse(stdout)).not.toThrow();
  });
});
```

### better-sqlite3 测试隔离策略

```typescript
// tests/helpers/test-db.ts
import Database from 'better-sqlite3';

export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');  // 内存数据库，测试间完全隔离
  // 运行 migration
  db.exec(getMigrationSQL());
  return db;
}
```

---

## 部署与分发策略

### npm 发布清单

```bash
# 发布前检查
npm pack --dry-run       # 预览将发布的文件
npm publish --dry-run    # 模拟发布

# 正式发布
npm version patch/minor/major
npm publish
```

### better-sqlite3 跨平台 prebuild 兼容矩阵

| 平台 | 架构 | prebuild 状态 | 备注 |
|------|------|--------------|------|
| **macOS** | x64 | ✅ 预编译可用 | Intel Mac |
| **macOS** | arm64 | ✅ 预编译可用 | Apple Silicon (M1/M2/M3/M4) |
| **Linux** | x64 | ✅ 预编译可用 | 主流 CI 环境 |
| **Linux** | arm64 | ✅ 预编译可用 | AWS Graviton、树莓派 |
| **Windows** | x64 | ✅ 预编译可用 | 主流 Windows 开发机 |
| **Windows** | arm64 | 🟡 需本地编译 | Surface Pro X 等 |
| **musl Linux** | x64 | ✅ 预编译可用 | Alpine Docker 镜像 |

**风险评估：** 99%+ 的目标用户环境有 prebuild 覆盖，无需本地编译。Windows arm64 是唯一潜在问题，但市占率极低。

---

## 风险评估与缓解策略

| 风险 | 等级 | 影响 | 缓解策略 |
|------|------|------|---------|
| **better-sqlite3 prebuild 缺失** | 🟢 低 | npx 首次执行需本地编译（需 C++ 工具链） | prebuild 覆盖 99%+ 平台；文档说明 fallback |
| **ESM 兼容性问题** | 🟡 中 | 部分旧工具/插件不支持 ESM-only 模块 | Commander v14 支持 CJS+ESM；构建输出为 ESM |
| **npx 冷启动慢** | 🟡 中 | 首次 `npx cord` 需下载 + 安装依赖 | 推荐全局安装 `npm i -g cord`；懒加载优化 |
| **Commander 大版本升级** | 🟢 低 | API 变化导致代码修改 | Commander API 稳定性极高（v9→v14 基本兼容） |
| **SQLite 数据库损坏** | 🟢 低 | 用户数据丢失 | WAL 模式 + 定期备份提示 + `cord doctor` 修复命令 |
| **TypeScript 版本冲突** | 🟢 低 | 与用户项目的 TS 版本冲突 | CLI 使用打包后的 JS，不暴露 TS 依赖给用户 |

---
