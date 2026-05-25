# npm 构建与发布操作指南

本文记录 CORD 发布到 npm 的标准流程、验证命令和本项目已遇到的常见问题。适用于维护者从本地仓库发布 `@fancyliu/cord` 新版本。

## 当前发布形态

- npm 包名：`@fancyliu/cord`
- CLI 命令名：`cord`
- npm registry：`https://registry.npmjs.org/`
- Node.js 要求：`>=20`
- 构建产物目录：`dist/`
- CLI bin 入口：`dist/cli/index.js`
- 发布访问级别：public

`package.json` 中的关键字段应保持如下形态：

```json
{
  "name": "@fancyliu/cord",
  "bin": {
    "cord": "dist/cli/index.js"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  },
  "files": ["dist", "README.zh.md", "docs/*.md"]
}
```

注意：`bin.cord` 不要写成 `./dist/cli/index.js`。`npm publish --dry-run` 会提示 auto-correct，并可能移除无效 bin 配置；发布前必须修成 `dist/cli/index.js`。

## 发布前检查

### 1. 确认 npm 登录态

```bash
npm whoami --registry https://registry.npmjs.org/
```

期望输出当前 npm 用户名，例如：

```text
fancyliu
```

如果返回 `E401 Unauthorized`，说明本机 npm 登录态失效，需要重新登录：

```bash
npm login --registry https://registry.npmjs.org/ --auth-type=legacy
```

登录过程中如出现密码、OTP/2FA 或安全密钥提示，必须直接在终端完成，不要通过聊天、文档、脚本或日志传递。

### 2. 确认当前本地版本

```bash
node -p "require('./package.json').name + '@' + require('./package.json').version"
```

示例输出：

```text
@fancyliu/cord@<version>
```

### 3. 确认远端版本是否已存在

```bash
version=$(node -p "require('./package.json').version")
npm view "@fancyliu/cord@$version" version --registry https://registry.npmjs.org/
```

如果目标版本不存在，npm 会返回 404，这是可以继续发布的信号。

如果目标版本已存在，不要重复发布同一版本；npm 不允许覆盖已发布版本，应先升级补丁、次版本或主版本。

### 4. 运行发布门禁

```bash
npm run release:check
```

该命令会依次执行：

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run pack:check
```

重点检查：

- ESLint 通过。
- TypeScript 类型检查通过。
- Vitest 测试全部通过。
- `tsup` 构建成功。
- `npm pack --dry-run` 的 tarball 内容只包含可公开发布的文件。
- `README.md`、`README.zh.md` 和 `docs/*.md` 被正确包含。
- 不包含内部仓库地址、token、缓存目录、测试源码或本地 AI 工具目录。

## 修改版本号

补丁版本发布使用：

```bash
npm version patch --no-git-tag-version
```

该命令会同时更新 `package.json` 和 `package-lock.json`。

强制规则：凡是会随 npm 包发布的变更，都必须先提升到一个新的、尚未发布过的版本号。适用范围包括源码、README、`docs/*.md`、`package.json` 元数据，以及任何会进入 npm tarball 的文件。

不要在已经发布到 npm 的版本号上继续修改并尝试重新发布。npm 不允许覆盖同一版本；如果本地文件相对 npm `latest` 有任何新变更，必须先执行 `npm version patch|minor|major --no-git-tag-version`，再运行发布检查和正式发布。

版本升级注意事项：

- 运行前确认当前目录是仓库根目录。
- 不要在临时安装目录中执行版本升级。
- 升级版本前先确认当前变更确实需要进入 npm 包。
- 升级后不要再回退到已发布版本号。
- 不要自动创建 git tag，除非发布流程明确要求。
- 若 README 或 docs 中标注了当前 npm 发布版本，必须同步为本次待发布版本；发布完成后该版本号必须与 npm registry 上的 `latest` dist-tag 保持一致。

## 后续版本更新发布命令

后续每次完成需要进入 npm 包的代码或文档变更后，第一步必须按版本类型选择一个版本升级命令，然后执行发布检查和正式发布。

补丁版本，例如修复文档、修复 bug、兼容性小改动：

```bash
npm version patch --no-git-tag-version
npm run release:check
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

次版本，例如新增向后兼容的功能：

```bash
npm version minor --no-git-tag-version
npm run release:check
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

主版本，例如包含破坏性变更：

```bash
npm version major --no-git-tag-version
npm run release:check
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

如果发布过程中提示 `Enter OTP:`，在终端输入 npm 认证器当前的 6 位一次性验证码。不要把 OTP 写入文档、脚本、聊天记录或 shell 历史。

## 正式发布

在仓库根目录执行：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

发布过程中会自动执行 `prepack`：

```bash
npm run build
```

如果 npm 提示：

```text
This operation requires a one-time password.
Enter OTP:
```

请输入 npm 认证器当前显示的 6 位一次性验证码。建议等待验证码刚刷新后立即输入，避免过期。

发布成功时会看到类似输出：

```text
+ @fancyliu/cord@<version>
```

新 scoped package 第一次发布后，npm registry 元数据可能短暂延迟。若再次发布同一版本返回：

```text
You cannot publish over the previously published versions: <version>
```

说明该版本已经被 npm 接收，不要继续重复发布。等待一段时间后再验证 `npm view` 和 `npx`。

## 发布后验证

### 1. 验证 npm 远端版本和 latest 标签

```bash
npm view @fancyliu/cord name version dist-tags bin --registry https://registry.npmjs.org/
```

期望输出包含：

```text
name = '@fancyliu/cord'
version = '<version>'
dist-tags = { latest: '<version>' }
bin = { cord: 'dist/cli/index.js' }
```

### 2. 验证 CLI 可执行

不要在 CORD 仓库根目录直接运行 `npx @fancyliu/cord@<version>` 验证远端包。当前目录本身就是同名 npm package，npm/npx 可能优先使用本地项目上下文，导致验证结果被本地源码、当前 `node_modules` 或当前 `package.json` 干扰。

推荐切到干净临时目录验证指定版本：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/cord-npx-check.XXXXXX)
(cd "$tmpdir" && npx --yes "@fancyliu/cord@$version" --version)
```

期望输出：

```text
<version>
```

也可以使用临时目录做干净安装验证：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/cord-install-check.XXXXXX)
cd "$tmpdir"
npm init -y >/dev/null
npm install "@fancyliu/cord@$version" --registry https://registry.npmjs.org/
./node_modules/.bin/cord --version
```

### 3. 验证 npm README 中的中文链接

npm 包页面不会可靠地服务 tarball 内的相对 README 文件；同时，部分外部 Markdown 链接如果响应头没有显式 UTF-8 charset，可能在 npm 的预览弹窗中显示乱码。因此 npm 包页 README 中的中文 README 链接应指向带显式 UTF-8 charset 的 jsDelivr 地址：

```markdown
[简体中文](https://cdn.jsdelivr.net/npm/@fancyliu/cord@latest/README.zh.md)
```

验证命令：

```bash
curl -L -I https://cdn.jsdelivr.net/npm/@fancyliu/cord@latest/README.zh.md
```

期望状态包含：

```text
HTTP/2 200
content-type: text/markdown; charset=utf-8
```

如果刚发布后 `@latest` 仍返回旧的 404，可清理 jsDelivr 缓存：

```bash
curl -sS https://purge.jsdelivr.net/npm/@fancyliu/cord@latest/README.zh.md
curl -sS https://purge.jsdelivr.net/npm/@fancyliu/cord@<version>/README.zh.md
```

然后重新执行 `curl -L -I` 验证。

## `npx` 使用场景差异

### 用户项目中已安装 CORD

在用户项目中安装 scoped package：

```bash
npm install -D @fancyliu/cord
```

安装后可以使用本地 bin 命令：

```bash
npx cord init --ide vscode-copilot
npx cord scan --rebuild --force
npx cord impact docs/getting-started.md
```

这里的 `npx cord` 依赖当前项目 `node_modules/.bin/cord`，对应的是 `@fancyliu/cord` 包暴露的 CLI 命令名。

### 没有安装 CORD 的任意目录

不要直接运行：

```bash
npx cord --version
```

裸包名 `cord` 不属于本项目，可能解析到 npm 上的其他包。若要一次性执行远端 CORD 包，应显式指定 scoped package：

```bash
npx --yes @fancyliu/cord@latest --version
```

或验证固定版本：

```bash
npx --yes @fancyliu/cord@<version> --version
```

### CORD 源码仓库根目录

如果你是在本仓库中本地开发或验证，请使用源码构建后的入口：

```bash
npm install
npm run build
node dist/cli/index.js --version
node dist/cli/index.js status
```

不要用仓库根目录里的 `npx @fancyliu/cord@<version>` 判断远端包是否可用；请切到干净临时目录验证，避免本地 package 上下文干扰结果。

## 常见问题

### 包名 `cord` 已被占用

现象：无法发布裸包名 `cord`。

处理：使用 scoped package：

```json
{
  "name": "@fancyliu/cord"
}
```

CLI 命令名仍保持为 `cord`：

```json
{
  "bin": {
    "cord": "dist/cli/index.js"
  }
}
```

### 使用了错误 registry

现象：登录或发布走到了镜像源，例如 npmmirror/cnpm，导致认证或发布失败。

处理：所有发布相关命令显式指定官方 registry：

```bash
--registry https://registry.npmjs.org/
```

可检查当前配置：

```bash
npm config get registry
```

### `E401 Unauthorized`

现象：

```text
npm error code E401
npm error 401 Unauthorized
```

处理：

```bash
npm login --registry https://registry.npmjs.org/ --auth-type=legacy
npm whoami --registry https://registry.npmjs.org/
```

### `EOTP`

现象：

```text
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

处理：重新执行发布命令，等认证器验证码刷新后输入当前 6 位 OTP：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

不要把 OTP 写入脚本、文档、聊天记录或 shell 历史。

### npm 包页 README 的中文链接失效或显示乱码

现象：npm 包页面中的 `[简体中文](README.zh.md)` 打开为 Not Found，或外链可以打开但中文内容显示乱码。

原因：npm 包页面渲染 README 时，不会按普通 GitHub 仓库页面方式解析 tarball 内的相对文件链接；部分 CDN 或重定向后的 Markdown 响应头也可能缺少显式 UTF-8 charset。

处理：

- 将 README 语言切换链接改为 jsDelivr `@latest` 绝对链接。
- 确认 `README.zh.md` 会进入 npm tarball。
- 发布前运行 `npm run release:check`。
- 发布后运行 `curl -L -I https://cdn.jsdelivr.net/npm/@fancyliu/cord@latest/README.zh.md`。

## 推荐发布清单

发布前：

```bash
npm whoami --registry https://registry.npmjs.org/
node -p "require('./package.json').name + '@' + require('./package.json').version"
version=$(node -p "require('./package.json').version")
npm view "@fancyliu/cord@$version" version --registry https://registry.npmjs.org/
npm run release:check
```

其中 `<version>` 必须是 `package.json` 中的当前版本，并且 `npm view "@fancyliu/cord@$version"` 应返回 404，表示该版本尚未发布。若该命令能查到版本，必须先升级到新的补丁、次版本或主版本后再发布。

发布：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

发布后：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/cord-npx-check.XXXXXX)
npm view @fancyliu/cord name version dist-tags bin --registry https://registry.npmjs.org/
(cd "$tmpdir" && npx --yes "@fancyliu/cord@$version" --version)
curl -L -I https://cdn.jsdelivr.net/npm/@fancyliu/cord@latest/README.zh.md
```
