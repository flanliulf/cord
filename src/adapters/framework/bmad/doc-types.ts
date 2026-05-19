import type { DocTypeDefinition } from '../interfaces.js';

/**
 * BMAD v0.1 文档类型定义。
 *
 * 贡献者可复制此声明式结构为新框架注册文档类型：`name` 是图谱分类值，
 * `patterns` 只负责匹配候选 Markdown 文件，扫描边界仍由适配器 scanPaths 控制。
 * 仅包含 Markdown 文档；YAML 类型 `sprint-status` 与 `config` 延后到 v0.2。
 */
export const BMAD_DOCUMENT_TYPES: DocTypeDefinition[] = [
  {
    name: 'prd',
    patterns: ['**/prd*.md'],
    description: 'Product Requirements Document',
  },
  {
    name: 'architecture',
    patterns: ['**/*architecture*.md', '**/architecture/**/*.md'],
    description: 'Architecture design documents',
  },
  {
    name: 'epic',
    patterns: ['**/epics/epic*.md'],
    description: 'Epic planning documents',
  },
  {
    name: 'story',
    patterns: ['**/[0-9]-[0-9]-*.md'],
    description: 'Implementation story documents',
  },
  {
    name: 'sprint-plan',
    patterns: ['**/sprint-plan*.md'],
    description: 'Sprint planning documents',
  },
  {
    name: 'technical-research',
    patterns: ['**/technical-*research*.md'],
    description: 'Technical research documents',
  },
  {
    name: 'domain-research',
    patterns: ['**/domain-*research*.md'],
    description: 'Domain research documents',
  },
  {
    name: 'market-research',
    patterns: ['**/market-*research*.md'],
    description: 'Market research documents',
  },
  {
    name: 'product-brief',
    patterns: ['**/product-brief*.md'],
    description: 'Product brief documents',
  },
  {
    name: 'project-context',
    patterns: ['**/project-context*.md'],
    description: 'Project context and agent guidance documents',
  },
  {
    name: 'brainstorming',
    patterns: ['**/brainstorming*.md'],
    description: 'Brainstorming session documents',
  },
  {
    name: 'ux-design',
    patterns: ['**/ux*.md'],
    description: 'UX design documents',
  },
  {
    name: 'retrospective',
    patterns: ['**/retrospective*.md', '**/retrospectives/**/*.md'],
    description: 'Retrospective documents',
  },
  {
    name: 'index',
    patterns: ['**/index.md'],
    description: 'Index documents',
  },
  {
    name: 'validation-report',
    patterns: ['**/*validation*.md'],
    description: 'Validation report documents',
  },
  {
    name: 'distillate',
    patterns: ['**/*distillat*.md'],
    description: 'Distilled summary documents',
  },
];