# Technical Research Recommendations

## 技术选型结论

**✅ 确认选择：remark/unified.js 生态作为 CORD 文档解析引擎**

理由总结：
1. 唯一提供标准化 AST（mdast）的 Node.js Markdown 解析方案
2. 7 个能力维度中 6 个完全满足，1 个（增量解析）有成熟的替代策略
3. 54 亿月下载量验证的生产稳定性
4. 插件 DX 优秀，CORD 自定义插件开发成本低
5. 与 CORD 已确认的技术栈（TypeScript + Node.js + ESM + SQLite）完全兼容

## 核心依赖版本锁定建议

```json
{
  "unified": "^11.0.0",
  "remark-parse": "^11.0.0",
  "remark-frontmatter": "^5.0.0",
  "remark-gfm": "^4.0.0",
  "vfile": "^6.0.0",
  "vfile-matter": "^5.0.0",
  "to-vfile": "^8.0.0",
  "unist-util-visit": "^5.0.0",
  "mdast-util-to-string": "^4.0.0"
}
```

## 待验证事项（MVP 阶段）

1. **性能基准测试** — 用 CORD 实际目标文档集测试解析时间和内存占用
2. **ESM 集成验证** — 确保 unified 生态与 CORD 的 MCP Server SDK（v1.x）和 better-sqlite3 的 ESM 兼容性
3. **差量对比策略验证** — 验证"全量重解析 + 差量入库"在文件变更频繁时的实际表现
