import { AnalyzerManager } from './AnalyzerManager';
import { JsEvaluator, RuleEvaluator } from './common';

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

  getString(context: AnalyzerManager, value: any): string {
    return this.evals
      .map((_eval) => _eval.getString(context, value))
      .join('')
      .trim();
  }

  getStrings(context: AnalyzerManager, value: any): string[] {
    return this.getString(context, value).split('\n');
  }

  toString(): string {
    return this.evals.join('');
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

    getString(context: AnalyzerManager, _value: any): string {
      return context.get(this.key);
    }

    toString(): string {
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

    getString(context: AnalyzerManager, value: any): string {
      if (this._eval instanceof JsEvaluator.Js) {
        const result = this._eval.eval(context, value);
        // 简化类型判断和转换
        return result === null ? '' : String(result);
      } else {
        return this._eval.getString(context, value);
      }
    }

    toString(): string {
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

    getString(context: AnalyzerManager, value: any): string {
      return this._eval.getString(context, value);
    }

    toString(): string {
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

    getString(_context: AnalyzerManager, value: any): string {
      const list: string[] | undefined = value as string[] | undefined;
      // 使用可选链和空值合并运算符简化代码
      return list?.[this.index] ?? `$${this.index}`;
    }

    toString(): string {
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

    getString(_context: AnalyzerManager, _value: any): string {
      // 对 str 进行基本的转义处理（例如，转义换行符）
      return this.str.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }

    toString(): string {
      return this.str;
    }
  };
}