import { JSONPath } from 'jsonpath-plus';
import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { logger } from '@any-reader/utils'; // 导入 logger
import { handleError, joinNonEmpty, parseSafely, safeString } from './utils';

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
    this._content = parseSafely(
      () => typeof content === 'string' ? JSON.parse(content) : content,
      'JSON 解析失败 (ReadContext):',
      { content }
    ) ?? null; // 使用 parseSafely
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
      // 使用 handleError
      return handleError('JSONPath 执行失败:', { jsonPath, error: e, stack: e.stack }, []);
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

  override getString(context: AnalyzerManager, value: any): string {
    return joinNonEmpty('\n', this.getStrings(context, value))
  }

  override getStrings(_context: AnalyzerManager, value: any): string[] {
    const ctx = value as ReadContext;
    if (!this.jsonpath || !ctx) return [];
    const result: string[] = [];
    try {
      const obj = ctx.read(this.jsonpath);
      if (Array.isArray(obj)) {
        // 使用 map 和 safeString
        obj.forEach((item) => result.push(safeString(item)));
      } else if (obj !== undefined && obj !== null) {
        result.push(safeString(obj)); // 使用 safeString
      }
    } catch (e: any) {
      // 使用 handleError
      handleError('JsonPath 解析失败:', { jsonpath: this.jsonpath, error: e, stack: e.stack }, []);
    }
    return result;
  }

  override getElements(_context: AnalyzerManager, value: any): any[] {
    const ctx = value as ReadContext;
    // 使用 handleError
    return ctx ? ctx.read(this.jsonpath) : handleError('JsonPath 获取元素失败: ctx 为空', { jsonpath: this.jsonpath }, []);
  }

  override getElement(_context: AnalyzerManager, value: any): any {
    const ctx = value as ReadContext;
    // 使用 handleError
    return ctx ? ctx.read(this.jsonpath) : handleError('JsonPath 获取单个元素失败: ctx 为空', { jsonpath: this.jsonpath }, null);
  }

  override toString(): string {
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
      return parseSafely(
        () => {
          if (json instanceof ReadContext) {
            return json;
          }
          return JsonPath.parse(json);
        },
        'JSON 解析失败 (ConvertWrapper):',
        { json }
      ) ?? new ReadContext(''); // 使用 parseSafely
    }

    override getString(context: AnalyzerManager, value: any): string {
      return safeString(value) ? this._eval.getString(context, this.parse(value)) : ''; // 使用 safeString
    }

    override getStrings(context: AnalyzerManager, value: any): string[] | null {
      return value ? this._eval.getStrings(context, this.parse(value)) : null;
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      return value ? this._eval.getElements(context, this.parse(value)) : [];
    }

    override getElement(context: AnalyzerManager, value: any): any | null {
      return value ? this._eval.getElement(context, this.parse(value)) : null;
    }

    override toString(): string {
      return this._eval.toString();
    }
  };
}