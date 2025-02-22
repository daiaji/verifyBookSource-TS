import { Elements } from '../javascript/jsoup/Elements';
import { Element } from '../javascript/jsoup/Element';
import { Jsoup } from '../javascript/jsoup/Jsoup';
import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import os from 'os';

/**
 * 默认规则执行器。
 * 用于处理 HTML 文档的解析，基于 Jsoup。
 */
export class DefaultEvaluator extends RuleEvaluator {
  private evals: RuleEvaluator[];

  constructor(evals: RuleEvaluator[]) {
    super();
    this.evals = evals;
  }

  override getString0(context: AnalyzerManager, value: any): string {
    return this.getStrings(context, value)?.[0] || '';
  }

  override getStrings(context: AnalyzerManager, value: any): string[] | null {
    if (!value) return [];
    const doc = value as Elements;
    const elements = new Elements(doc);

    for (const _eval of this.evals) {
      if (_eval instanceof Last) {
        return _eval.getStrings(context, elements);
      }
      const els = new Elements();

      for (const element of elements) {
        const result = _eval.getElements(context, element);
        els.push(...result);
      }

      elements.clear();
      elements.push(...els);
    }
    // 代码永远不会运行到此处
    return [];
  }

  override getElement(context: AnalyzerManager, value: any): any {
    return this.getElements(context, value);
  }

  override getElements(context: AnalyzerManager, value: any): any[] {
    if (!value) return [];
    const doc = value as Elements;
    const elements = new Elements(doc);

    for (const _eval of this.evals) {
      if (_eval instanceof Last) {
        throw new Error('不应存在获取文本规则');
      }
      const els = new Elements();

      for (const element of elements) {
        const result = _eval.getElements(context, element);
        els.push(...result);
      }

      elements.clear();
      elements.addAll(els);
    }

    return elements;
  }

  toString(): string {
    return this.evals.map((_eval) => _eval.toString()).join('@');
  }

  /**
   * 适配器，用于在 JSON 和 HTML 之间切换解析器。
   */
  static Adapter = class extends RuleEvaluator {
    private defaultEvaluator: RuleEvaluator;
    private jsonPathEvaluator: RuleEvaluator;

    constructor(defaultEvaluator: RuleEvaluator, jsonPathEvaluator: RuleEvaluator) {
      super();
      this.defaultEvaluator = defaultEvaluator;
      this.jsonPathEvaluator = jsonPathEvaluator;
    }

    override getStrings(context: AnalyzerManager, value: any): string[] | null {
      return context.isJSON ? this.jsonPathEvaluator.getStrings(context, value) : this.defaultEvaluator.getStrings(context, value);
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      return context.isJSON ? this.jsonPathEvaluator.getElements(context, value) : this.defaultEvaluator.getElements(context, value);
    }

    override getString0(context: AnalyzerManager, value: any): string {
      return context.isJSON ? this.jsonPathEvaluator.getString(context, value) : this.defaultEvaluator.getString0(context, value);
    }

    override getElement(context: AnalyzerManager, value: any): any {
      return context.isJSON ? this.jsonPathEvaluator.getElement(context, value) : this.defaultEvaluator.getElement(context, value);
    }

    toString(): string {
      return this.defaultEvaluator.toString();
    }
  };

  /**
   * 转换包装器，用于将不同类型的输入转换为 Elements 对象。
   */
  static ConvertWrapper = class extends RuleEvaluator {
    private _eval: RuleEvaluator;

    constructor(_eval: RuleEvaluator) {
      super();
      this._eval = _eval;
    }

    private parse(doc: any): any {
      if (doc instanceof Elements || doc instanceof Element) {
        return doc;
      }
      //  这里暂时移除 JXNode 的判断
      // if (doc instanceof JXNode) {
      //     return doc.isElement() ? doc.asElement() : Jsoup.parse(doc.toString());
      // }

      // try {   这里暂时移除xml判断
      //     if (doc.toString().startsWith("<?xml", 0)) {
      //         return Jsoup.parse(doc.toString(), Jsoup.parser.xmlParser());
      //     }
      // } catch (e) {
      //     logger.error("尝试解析为 XML 失败", {error:e}) // 记录异常
      // }

      return Jsoup.parse(doc.toString());
    }

    override getStrings(context: AnalyzerManager, value: any): string[] | null {
      if (!value) return null;
      return this._eval.getStrings(context, this.parse(value));
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      if (!value) return [];
      return this._eval.getElements(context, this.parse(value));
    }

    override getString0(context: AnalyzerManager, value: any): string {
      if (!value) return '';
      return this._eval.getString0(context, this.parse(value));
    }

    override getElement(context: AnalyzerManager, value: any): any {
      if (!value) return null;
      return this._eval.getElement(context, this.parse(value));
    }

    toString(): string {
      return this._eval.toString();
    }
  };

  /**
   * 子元素选择器。
   */
  static Children = class extends RuleEvaluator {
    constructor(
      private explicit: boolean,
      public index: RuleEvaluator | null
    ) {
      super();
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      const element = value as Elements;
      const result = element.children();
      return this.index ? this.index.getElements(context, result) : result;
    }

    override toString(): string {
      // 添加空值检查
      return `${this.explicit ? 'children' : ''}${this.index ? this.index.toString() : ''}`;
    }
  };

  /**
   * 索引选择器。
   */
  static Index = class extends RuleEvaluator {
    private exclude: boolean;
    private indexDefault: number[];
    private indexes: Array<number | [number | null, number | null, number]>;


    constructor(exclude: boolean, indexDefault: number[], indexes: Array<number | [number | null, number | null, number]>) {
      super();
      this.exclude = exclude;
      this.indexDefault = indexDefault;
      this.indexes = indexes;
    }
    /**
     * 根据索引获取元素。
     * @param context AnalyzerManager 实例
     * @param value 要处理的 Elements 对象
     * @returns 选中的 Elements 对象
     */
    getElements(context: AnalyzerManager, value: any): Elements {
      const elements: Elements = value as Elements;
      const len = elements.length;

      // 如果索引和默认索引都为空，则直接返回原始的 Elements
      if (this.indexes.length === 0 && this.indexDefault.length === 0) {
        return elements;
      }

      const indexSet = new Set<number>();

      // 处理默认索引（简写形式）
      if (this.indexDefault.length > 0) {
        for (let ix = this.indexDefault.length - 1; ix >= 0; ix--) {
          const it = this.indexDefault[ix];
          this.addIndexToSet(indexSet, it, len);
        }
      }

      // 处理常规索引
      if (this.indexes.length > 0) {
        for (let ix = this.indexes.length - 1; ix >= 0; ix--) {
          const index = this.indexes[ix];
          if (Array.isArray(index)) {
            this.addRangeToSet(indexSet, index, len);
          } else {
            this.addIndexToSet(indexSet, index, len);
          }
        }
      }

      return this.applyIndexSet(elements, indexSet);
    }

    /**
     * 将单个索引添加到集合中。
     * @param indexSet 索引集合
     * @param index 要添加的索引
     * @param len 元素总数
     */
    private addIndexToSet(indexSet: Set<number>, index: number, len: number): void {
      if (index >= 0 && index < len) {
        indexSet.add(index);
      } else if (index < 0 && len >= -index) {
        indexSet.add(index + len);
      }
    }

    /**
     * 将范围索引添加到集合中。
     * @param indexSet 索引集合
     * @param range 要添加的范围
     * @param len 元素总数
     */
    private addRangeToSet(indexSet: Set<number>, range: [number | null, number | null, number], len: number): void {
      const [startX, endX, stepX] = range;

      const start = startX === null ? 0 : Math.max(0, startX >= 0 ? Math.min(startX, len - 1) : len + startX);
      const end = endX === null ? len - 1 : Math.max(0, endX >= 0 ? Math.min(endX, len - 1) : len + endX);
      const step = stepX > 0 ? stepX : Math.abs(stepX) < len ? stepX + len : 1;

      if (start === end || Math.abs(step) >= len) {
        indexSet.add(start);
        return;
      }

      if (end > start) {
        for (let i = start; i <= end; i += step) {
          indexSet.add(i);
        }
      } else {
        for (let i = start; i >= end; i += step) {
          indexSet.add(i);
        }
      }
    }

    /**
     * 根据索引集合，从 Elements 中选取元素。
     * @param elements 原始 Elements 对象
     * @param indexSet 索引集合
     * @returns 选中的 Elements 对象
     */
    private applyIndexSet(elements: Elements, indexSet: Set<number>): Elements {
      if (this.exclude) {
        // 排除模式
        const result = new Elements();
        for (let i = 0; i < elements.length; i++) {
          if (!indexSet.has(i)) {
            result.push(elements[i]);
          }
        }
        return result;
      } else {
        // 选择模式
        const result = new Elements();
        for (const index of indexSet) {
          result.push(elements[index]);
        }
        return result;
      }
    }

    toString(): string {
      const result: string[] = [];
      if (this.indexDefault.length > 0) {
        result.push(this.exclude ? '!' : '.');
        result.push(this.indexDefault.reverse().join(':'));
      } else {
        result.push('[');
        if (this.exclude) result.push('!');
        this.indexes.reverse().forEach((index, i) => {
          if (i > 0) result.push(',');
          if (Array.isArray(index) && index.length === 3) {
            const [start, end, step] = index;
            if (start !== null) result.push(`${start}`);
            result.push(':');
            if (end !== null) result.push(`${end}`);
            if (step !== 1) {
              result.push(':');
              result.push(`${step}`);
            }
          } else {
            result.push(`${index}`);
          }
        });
        result.push(']');
      }
      return result.join('');
    }
  };
}

/**
 * 选择器抽象基类。
 */
export abstract class Select extends RuleEvaluator {
  protected index?: RuleEvaluator | null;

  constructor(index?: RuleEvaluator | null) {
    super();
    this.index = index;
  }

  /**
   * 执行选择器。
   * @param value 要处理的 Elements 对象
   * @returns 选中的 Elements 对象
   */
  abstract evaluator(value: Elements): Elements;

  override getElement(context: AnalyzerManager, value: any): any {
    return this.getElements(context, value);
  }

  override getElements(context: AnalyzerManager, value: any): any[] {
    const result = this.evaluator(value as Elements);
    return this.index ? this.index.getElements(context, result) : result;
  }

  /**
   * 类选择器。
   */
  static Class = class extends Select {
    private name: string;

    constructor(name: string, index?: RuleEvaluator | null) {
      super(index);
      this.name = name;
    }

    override evaluator(value: Elements): Elements {
      return value.select(`.${this.name}`);
    }

    override toString(): string {
      return `class.${this.name}${this.index ? this.index.toString() : ''}`;
    }
  };

  /**
   * 标签选择器。
   */
  static Tag = class extends Select {
    private name: string;

    constructor(name: string, index?: RuleEvaluator | null) {
      super(index);
      this.name = name;
    }

    override evaluator(value: Elements): Elements {
      return value.select(this.name);
    }

    // 使用模板字符串简化
    override toString(): string {
      return `tag.${this.name}${this.index ? this.index.toString() : ''}`;
    }
  };

  /**
   * ID 选择器。
   */
  static Id = class extends Select {
    private name: string;

    constructor(name: string, index?: RuleEvaluator | null) {
      super(index);
      this.name = name;
    }

    override evaluator(value: Elements): Elements {
      return value.select(`#${this.name}`);
    }

    // 使用模板字符串简化
    override toString(): string {
      return `id.${this.name}${this.index ? this.index.toString() : ''}`;
    }
  };

  /**
   * 文本选择器。
   */
  static Text = class extends Select {
    private searchText: string;

    constructor(searchText: string, index?: RuleEvaluator | null) {
      super(index);
      this.searchText = searchText;
    }

    override evaluator(value: Elements): Elements {
      // cheerio 没有实现 containsOwn ，需要自己扩展 cheerio 实现，先用 contains 代替
      return value.select(`:contains(${this.searchText})`);
    }

    // 使用模板字符串简化
    override toString(): string {
      return `text.${this.searchText}${this.index ? this.index.toString() : ''}`;
    }
  };

  /**
   * CSS 选择器。
   */
  static Css = class extends Select {
    private query: string;
    private prefix: boolean;

    constructor(query: string, prefix: boolean, index?: RuleEvaluator | null) {
      super(index);
      this.query = query;
      this.prefix = prefix;
    }

    override evaluator(value: Elements): Elements {
      return value.select(this.query);
    }

    // 使用模板字符串简化
    override toString(): string {
      return `${this.prefix ? '@css:' : ''}${this.query}${this.index ? this.index.toString() : ''}`;
    }
  };
}

/**
 * 最终处理规则抽象基类。
 */
export abstract class Last extends RuleEvaluator {
  /**
   * 获取字符串列表。
   * @param context AnalyzerManager 实例
   * @param value 要处理的 Elements 对象
   * @returns 字符串数组
   */
  abstract getStrings(context: AnalyzerManager, value: any): string[];

  /**
   * 获取文本节点内容。
   */
  static Text = new (class extends Last {
    getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      const elements = value as Elements;

      for (let i = 0; i < elements.length; i++) {
        const text = elements[i].text();
        if (text) {
          result.push(text);
        }
      }

      return result;
    }

    toString(): string {
      return 'text';
    }
  })();

  /**
   * 获取文本节点内容（包括换行符）。
   */
  static TextNodes = new (class extends Last {
    getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      const elements = value as Elements;

      for (let i = 0; i < elements.length; i++) {
        const contentEs = elements[i].textNodes();
        const textContent: string[] = []; // 使用临时数组

        for (let a = 0; a < contentEs.length; a++) {
          const item = contentEs[a];
          const text = item.text().trim();

          if (text) {
            if (a > 0) textContent.push(os.EOL); // 使用 os.EOL
            textContent.push(text);
          }
        }

        if (textContent.length > 0) {
          result.push(textContent.join(''));
        }
      }

      return result;
    }

    toString(): string {
      return 'textNodes';
    }
  })();

  /**
   * 获取自身文本内容（不包括子元素）。
   */
  static OwnText = new (class extends Last {
    getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      const elements = value as Elements;

      for (let i = 0; i < elements.length; i++) {
        const text = elements[i].ownText();
        if (text) {
          result.push(text);
        }
      }

      return result;
    }

    toString(): string {
      return 'ownText';
    }
  })();

  /**
   * 获取 HTML 内容（不包括 script 和 style 标签）。
   */
  static Html = new (class extends Last {
    getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      const elements = value as Elements;

      elements.select('script, style').remove(); // 移除 script 和 style 标签
      const html = elements.outerHtml();

      if (html) {
        result.push(html);
      }

      return result;
    }

    toString(): string {
      return 'html';
    }
  })();

  /**
   * 获取所有 HTML 内容。
   */
  static All = new (class extends Last {
    getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      const elements = value as Elements;
      // 这里不移除 script, style
      result.push(elements.outerHtml());
      return result;
    }

    toString(): string {
      return 'all';
    }
  })();

  /**
   * 获取属性值。
   */
  static Attr = class extends Last {
    private name: string;

    constructor(name: string) {
      super();
      this.name = name;
    }

    getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      const elements = value as Elements;

      for (let i = 0; i < elements.length; i++) {
        const url = elements[i].attr(this.name);
        if (!url || result.includes(url)) continue;
        result.push(url);
      }

      return result;
    }

    toString(): string {
      return this.name;
    }
  };
}