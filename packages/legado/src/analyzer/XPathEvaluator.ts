import xpath from 'xpath';
import { DOMParser, MIME_TYPE, Document } from '@xmldom/xmldom'; // 导入 Document
import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { logger } from '@any-reader/utils';

/**
 * 模拟 JXDocument 的类。
 */
class JXDocument {
  static create(content: string) {
    return new JXNode(content);
  }
}

/**
 * JXNode 类，用于封装 XML/HTML 内容和 XPath 查询。
 */
class JXNode {
  private _content: string;
  private _doc: Document | null; // 使用导入的 Document 类型

  constructor(content: string) {
    this._content = content;
    this._doc = this.parseContent(content);
  }

  /**
   * 解析 XML/HTML 内容。
   * @param content 要解析的内容
   * @returns 解析后的 Document 对象，如果解析失败则返回 null
   */
  private parseContent(content: string): Document | null { // 使用导入的 Document 类型
    try {
      return new DOMParser().parseFromString(content, MIME_TYPE.HTML);
    } catch (e: any) {
      logger.error('XML/HTML 解析失败:', { content, error: e, stack: e.stack }); // 中文 + 结构化
      return null; // 解析失败时返回 null
    }
  }

  /**
   * 执行 XPath 查询。
   * @param rule XPath 表达式
   * @returns 查询结果数组
   */
  sel(rule: string): any[] {
    if (!this._doc) {
      return []; // 如果文档无效，则返回空数组
    }
    try {
      const node: any[] = xpath.parse(rule).select({ node: this._doc, isHtml: true });
      return node.map((e) => e.toString());
    } catch (e: any) {
      logger.error('XPath 执行失败:', { rule, error: e, stack: e.stack }); // 中文 + 结构化
      return []; // XPath 执行失败返回空数组
    }
  }
}

/**
 * XPath 规则执行器。
 */
export class XPathEvaluator extends RuleEvaluator {
  constructor(private xpath: string) {
    super();
  }

  override getStrings(context: AnalyzerManager, value: any): string[] {
    const result = this.getElements(context, value);
    return result;
  }

  override getElements(context: AnalyzerManager, value: any): any[] {
    if (!value) return [];
    return value.sel(this.xpath);
  }

  override getElement(context: AnalyzerManager, value: any): any {
    // XPath 通常返回多个节点，这里仍然返回数组，保持和 getElements 一致
    return this.getElements(context, value);
  }

  override toString(): string {
    return this.xpath;
  }

  /**
   * XPath 转换包装器。
   */
  static ConvertWrapper = class extends RuleEvaluator {
    constructor(private _eval: RuleEvaluator) {
      super();
    }

    private parse(doc: string): any {
      // parse 方法也需要捕获异常
      try {
        return JXDocument.create(doc);
      } catch (e: any) {
        logger.error('XML/HTML 解析失败 (ConvertWrapper):', { doc, error: e, stack: e.stack }); // 中文 + 结构化
        return null; // 解析失败时返回 null
      }
    }

    override getStrings(context: AnalyzerManager, value: any): string[] | null {
      if (!value) return null;
      return this._eval.getStrings(context, this.parse(value));
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      if (!value) return [];
      return this._eval.getElements(context, this.parse(value));
    }
    override getElement(context: AnalyzerManager, value: any): any[] {
      if (!value) return [];
      return this._eval.getElements(context, this.parse(value));
    }
  };
}