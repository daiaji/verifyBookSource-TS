import xpath from 'xpath';
import { DOMParser, MIME_TYPE, Document } from '@xmldom/xmldom'; // 导入 Document
import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { logger } from '@any-reader/utils';
import { handleError, parseSafely, safeString } from './utils';

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
  private parseContent(content: string): Document | null {
    return parseSafely(
      () => new DOMParser().parseFromString(content, MIME_TYPE.HTML),
      'XML/HTML 解析失败:',
      { content }
    ); // 使用 parseSafely
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
      // 使用 handleError
      return handleError('XPath 执行失败:', { rule, error: e, stack: e.stack }, []);
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
    return this.getElements(context, value);
  }

  override getElements(context: AnalyzerManager, value: any): any[] {
    // 使用 handleError
    return value ? value.sel(this.xpath) : handleError('XPath 获取元素失败: value 为空', { xpath: this.xpath }, []);
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
      return parseSafely(
        () => JXDocument.create(doc),
        'XML/HTML 解析失败 (ConvertWrapper):',
        { doc }
      ) ?? null; // 使用 parseSafely
    }

    override getStrings(context: AnalyzerManager, value: any): string[] | null {
      return safeString(value) ? this._eval.getStrings(context, this.parse(value)) : null; // 使用 safeString
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      return value ? this._eval.getElements(context, this.parse(value)) : [];
    }
    override getElement(context: AnalyzerManager, value: any): any[] {
      return value ? this._eval.getElements(context, this.parse(value)) : [];
    }
  };
}