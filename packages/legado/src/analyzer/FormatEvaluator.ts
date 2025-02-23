import { AnalyzerManager } from './AnalyzerManager';
import { JsEvaluator, RuleEvaluator } from './common';
import { joinNonEmpty, safeString } from './utils'; // 导入工具函数

/**
 * 格式化规则执行器。
 * 用于对提取的结果进行格式化，例如获取变量、插值、JSONPath、正则表达式等。
 */
export class FormatEvaluator extends RuleEvaluator {
  evals: RuleEvaluator[];

  constructor(evals: RuleEvaluator[]) {
    super();
    this.evals = evals;
  }

  override getString(context: AnalyzerManager, value: any): string {
    // 使用 joinNonEmpty 和 map
    return joinNonEmpty('', this.evals.map((_eval) => _eval.getString(context, value))).trim();
  }

  override getStrings(context: AnalyzerManager, value: any): string[] {
    return this.getString(context, value).split('\n');
  }

  override toString(): string {
    // 使用 joinNonEmpty
    return joinNonEmpty('', this.evals.map(e => e.toString()));
  }

  /**
   * 获取变量值。
   */
  static Get = class extends RuleEvaluator {
    key: string;

    constructor(key: string) {
      super();
      this.key = key;
    }

    override getString(context: AnalyzerManager, _value: any): string {
      return safeString(context.get(this.key)); // 使用 safeString
    }

    override toString(): string {
      return `@get:{${this.key}}`;
    }
  };

  /**
   * Mustache 插值。
   */
  static Mustache = class extends RuleEvaluator {
    _eval: RuleEvaluator;

    constructor(_eval: RuleEvaluator) {
      super();
      this._eval = _eval;
    }

    override getString(context: AnalyzerManager, value: any): string {
        if (this._eval instanceof JsEvaluator.Js) {
            const result = this._eval.eval(context, value);
            return safeString(result);
        } else {
            // 添加类型检查和安全调用
            if (typeof this._eval.getString === 'function') {
                return safeString(this._eval.getString(context, value));
            } else {
                // 如果 getString 不存在，可以选择抛出异常或者返回一个默认值
                console.warn('getString method not found in _eval, returning empty string.');
                return '';
            }
        }
    }

    override toString(): string {
      return `{{${this._eval}}}`;
    }
  };

  /**
   * JSONPath 格式化。
   */
  static JsonPath = class extends RuleEvaluator {
    _eval: RuleEvaluator;

    constructor(_eval: RuleEvaluator) {
      super();
      this._eval = _eval;
    }

    override getString(context: AnalyzerManager, value: any): string {
      return safeString(this._eval.getString(context, value)); // 使用 safeString
    }

    override toString(): string {
      return `{${this._eval}}`;
    }
  };

  /**
   * 正则表达式格式化。
   */
  static Regex = class extends RuleEvaluator {
    index: number;

    constructor(index: number) {
      super();
      this.index = index;
    }

    override getString(_context: AnalyzerManager, value: any): string {
      const list: string[] | undefined = value as string[] | undefined;
      return list?.[this.index] ?? '';
    }

    override toString(): string {
      return `$${this.index}`;
    }
  };

  /**
   * 字面量格式化。
   */
  static Literal = class extends RuleEvaluator {
    str: string;

    constructor(str: string) {
      super();
      this.str = str;
    }

    override getString(_context: AnalyzerManager, _value: any): string {
      return safeString(this.str.replace(/\n/g, '\\n').replace(/\r/g, '\\r')); // 使用 safeString
    }

    override toString(): string {
      return this.str;
    }
  };
}