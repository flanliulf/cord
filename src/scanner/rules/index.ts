import type { DiscoveredRelation, ParsedDocument } from '../types.js';
import { DirectoryRule } from './directory-rule.js';
import { FrontmatterRule } from './frontmatter-rule.js';
import { MarkdownLinkRule } from './markdown-link-rule.js';

/**
 * IScanRule 定义扫描规则的统一接口。
 */
export interface IScanRule {
  /** 规则名称。 */
  readonly name: string;

  /**
   * 基于单文档与全量文档列表评估关系。
   *
   * @param doc - 当前文档
   * @param allDocPaths - 全量文档绝对路径
   * @returns 发现的关系列表
   */
  evaluate(doc: ParsedDocument, allDocPaths: string[]): DiscoveredRelation[];
}

/**
 * ScanRuleRegistry 负责维护规则注册顺序。
 */
export class ScanRuleRegistry {
  private readonly rules: IScanRule[] = [];

  /**
   * @param rule - 要注册的规则
   */
  register(rule: IScanRule): void {
    this.rules.push(rule);
  }

  /**
   * @returns 按注册顺序返回规则列表副本
   */
  getRules(): IScanRule[] {
    return [...this.rules];
  }
}

/**
 * @returns Story 2.2 要求的默认扫描规则集合
 */
export function createDefaultScanRules(): IScanRule[] {
  return [new FrontmatterRule(), new MarkdownLinkRule(), new DirectoryRule()];
}

export { DirectoryRule, FrontmatterRule, MarkdownLinkRule };