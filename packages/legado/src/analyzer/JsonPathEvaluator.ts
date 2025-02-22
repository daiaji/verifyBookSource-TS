import { JSONPath } from 'jsonpath-plus';
import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { logger } from '@any-reader/utils'; // 导入 logger

/**
 * 模拟 JsonPath 上下文的类。
 */
class JsonPath {
  static parse(content: any): ReadContext {
    return new ReadContext(content);
  }
}

/**
 * JsonPath 读取上下文。
 */
class ReadContext {
  private _content: any;

  constructor(content: string | null) {
    //接收null
    try {
      this._content = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e: any) {
      logger.error('JSON 解析失败 (ReadContext):', { content, error: e, stack: e.stack }); // 中文 + 结构化
      this._content = null; // 解析失败时设置为 null
    }
  }

  read(jsonPath: string) {
    if (!this._content) {
      return []; // 如果内容无效，则返回空数组
    }
    try {
      const rows = JSONPath({
        path: jsonPath,
        json: this._content
      });
      if (Array.isArray(rows) && rows.length === 1) return rows[0];

      return rows;
    } catch (e: any) {
      logger.error('JSONPath 执行失败:', { jsonPath, error: e, stack: e.stack }); // 中文 + 结构化
      return []; //  JSONPath 执行失败返回空数组
    }
  }
}

/**
 * JsonPath 规则执行器。
 */
export class JsonPathEvaluator extends RuleEvaluator {
  private jsonpath: string;

  constructor(jsonpath: string) {
    super();
    this.jsonpath = jsonpath;
  }

  getString(context: AnalyzerManager, value: any): string {
    if (!this.jsonpath) return '';
    return this.getStrings(context, value).join('\n');
  }

  getStrings(_context: AnalyzerManager, value: any): string[] {
    const ctx = value as ReadContext;
    if (!this.jsonpath || !ctx) return [];
    const result: string[] = [];
    try {
      const obj = ctx.read(this.jsonpath);
      if (Array.isArray(obj)) {
        obj.forEach((item) => result.push(item ? item.toString() : ''));
      } else if (obj !== undefined && obj !== null) {
        result.push(obj.toString());
      }
    } catch (e: any) {
      logger.error('JsonPath 解析失败:', { jsonpath: this.jsonpath, error: e, stack: e.stack }); // 中文 + 结构化
    }
    return result;
  }

  getElements(_context: AnalyzerManager, value: any): any[] {
    const ctx = value as ReadContext;
    if (!ctx) return []; // 如果上下文无效，则返回空数组
    try {
      return ctx.read(this.jsonpath);
    } catch (e: any) {
      logger.error('JsonPath 获取元素失败:', { jsonpath: this.jsonpath, error: e, stack: e.stack }); // 中文 + 结构化
    }
    return [];
  }

  getElement(_context: AnalyzerManager, value: any): any {
    const ctx = value as ReadContext;
    if (!ctx) return null; // 如果上下文无效，则返回 null
    try {
      return ctx.read(this.jsonpath);
    } catch (e: any) {
      logger.error('JsonPath 获取单个元素失败:', { jsonpath: this.jsonpath, error: e, stack: e.stack }); // 中文 + 结构化
      return null; // 获取单个元素失败返回 null
    }
  }

  toString(): string {
    return this.jsonpath;
  }

  /**
   * JsonPath 转换包装器。
   */
  static ConvertWrapper = class extends RuleEvaluator {
    private _eval: RuleEvaluator;

    constructor(_eval: RuleEvaluator) {
      super();
      this._eval = _eval;
    }

    private parse(json: any): ReadContext {
      try {
        if (json instanceof ReadContext) {
          return json;
        } else if (typeof json === 'string') {
          return JsonPath.parse(json);
        } else {
          return JsonPath.parse(json);
        }
      } catch (e: any) {
        logger.error('JSON 解析失败 (ConvertWrapper):', { json, error: e, stack: e.stack }); // 中文 + 结构化
        return new ReadContext(''); // 解析失败时返回一个空的 ReadContext
      }
    }

    getString(context: AnalyzerManager, value: any): string {
      if (!value) return '';
      return this._eval.getString(context, this.parse(value));
    }

    getStrings(context: AnalyzerManager, value: any): string[] | null {
      if (!value) return null;
      return this._eval.getStrings(context, this.parse(value));
    }

    getElements(context: AnalyzerManager, value: any): any[] {
      if (!value) return [];
      return this._eval.getElements(context, this.parse(value));
    }

    getElement(context: AnalyzerManager, value: any): any | null {
      if (!value) return null;
      return this._eval.getElement(context, this.parse(value));
    }

    toString(): string {
      return this._eval.toString();
    }
  };
}