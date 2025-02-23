import { AnalyzerManager } from './AnalyzerManager';
import { BaseRuleEvaluator } from './BaseRuleEvaluator';
import { isExplicitObject, joinNonEmpty, safeString, splitLines } from './utils';
import { FormatEvaluator, JsEvaluator, RegexEvaluator } from './common';

/**
 * 规则执行器。
 * 实现了基本的规则处理逻辑，包括字符串提取、元素提取、序列执行、变量存储等。
 */
export abstract class RuleEvaluator extends BaseRuleEvaluator {
  /**
   * 获取单个字符串值。
   * 如果结果为空数组，则返回空字符串；如果只有一个元素，则返回该元素；否则返回换行符连接的字符串。
   * @param context AnalyzerManager 实例
   * @param value 要处理的值
   * @returns 字符串值
   */
  override getString(context: AnalyzerManager, value?: any): string {
    const list = this.getStrings(context, value);

    if (!list || list.length === 0) {
      return '';
    }

    if (list.length === 1) {
      return list[0];
    }
    // 使用 joinNonEmpty，以换行符连接
    return joinNonEmpty('\n', list);
  }

  /**
   * 获取字符串值（不进行 URL 编码）。
   * @param context AnalyzerManager 实例
   * @param value 要处理的值
   * @returns 字符串值
   */
  override getString0(context: AnalyzerManager, value?: any): string {
    return this.getString(context, value);
  }

  /**
   * 规则执行序列。
   * 用于按顺序执行多个规则。
   */
  static Sequence = class extends RuleEvaluator {
    private evals: RuleEvaluator[];

    constructor(evals: RuleEvaluator[]) {
      super();
      this.evals = evals;
    }

    /**
      * 统一执行规则的方法
      * @param context AnalyzerManager 实例
      * @param value  输入值
      * @param method 执行的方法名
      * @param isArray 是否为数组
      * @returns 执行结果
      */
    private executeRules(context: AnalyzerManager, value: any, method: string, isArray: boolean = false): any {
      let lastResult = value;
      let result: any = value;

      for (const _eval of this.evals) {
        if (_eval instanceof RuleEvaluator.Put) {
          result = _eval.eval(context, lastResult);
        } else if (_eval instanceof JsEvaluator.Js) {
          result = _eval.eval(context, result);
        } else if (_eval instanceof FormatEvaluator) {
          result = _eval.getString(context, result);
        } else if (_eval instanceof RegexEvaluator) {
          if (isArray) {
            // 添加类型判断
            if (typeof (_eval as any).replaceList === 'function') {
              result = (_eval as any).replaceList(context, lastResult, result);
            } else {
              // 如果 replaceList 不存在，可以选择抛出异常或者使用 replace 代替
              console.warn('replaceList method not found in RegexEvaluator, using replace instead.');
              result = (_eval as any).replace(context, lastResult, result);
            }
          } else {
            result = (_eval as any).replace(context, lastResult, result);
          }
        } else {
          result = (_eval as any)[method](context, result);
        }
        lastResult = result;
        if (isExplicitObject(value)) break;
      }
      // 统一处理结果
      if (method === 'getStrings' && typeof result === 'string') {
        return splitLines(result); // 使用 splitLines
      }
      return (method === 'getElements' && !Array.isArray(result)) ? [] : result;
    }


    override getString0(context: AnalyzerManager, value?: any): string {
      return safeString(this.executeRules(context, value, 'getString0'));
    }

    override getString(context: AnalyzerManager, value?: any): string {
      return safeString(this.executeRules(context, value, 'getString'));
    }

    override getStrings(context: AnalyzerManager, value?: any): string[] | null {
      return this.executeRules(context, value, 'getStrings', true);
    }

    override getElement(context: AnalyzerManager, value?: any): any {
      return this.executeRules(context, value, 'getElement');
    }

    override getElements(context: AnalyzerManager, value?: any): any[] {
      return this.executeRules(context, value, 'getElements');
    }

    override toString(): string {
      return joinNonEmpty('', this.evals.map((_eval) => _eval.toString()));
    }
  };

  /**
   * 变量存储规则。
   * 用于将规则提取的结果存储到变量中。
   */
  static Put = class extends RuleEvaluator {
    private putMap: Map<string, RuleEvaluator>;

    constructor(putMap: Map<string, RuleEvaluator>) {
      super();
      this.putMap = putMap;
    }

    /**
     * 执行变量存储操作。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 原始值
     */
    override eval(context: AnalyzerManager, value?: any): any {
      this.putMap.forEach((_eval, key) => {
        // 此处不直接修改 context, 而是通过 context.put 方法
        context.put(key, _eval.getString(context, value));
      });
      return value;
    }

    override getStrings(context: AnalyzerManager, value?: any): string[] | null {
      this.eval(context, value);
      return null;
    }

    override getElement(context: AnalyzerManager, value?: any): any {
      return this.getElements(context, value); //保持原有逻辑
    }

    override getElements(context: AnalyzerManager, value?: any): any[] {
      this.eval(context, value);  //保持原有逻辑
      return [];
    }

    override toString(): string {
      return `@put:${JSON.stringify(Array.from(this.putMap.entries()))}`;
    }
  };

  /**
     * 原生对象求值
     */
  static NativeObjectEvaluator = class extends RuleEvaluator {
    private key: string;

    constructor(key: string) {
      super();
      this.key = key;
    }

    override getString(context: AnalyzerManager, value?: any): string {
      const nativeObject = value;
      return safeString(nativeObject?.[this.key]);
    }

    override getStrings(context: AnalyzerManager, value?: any): string[] | null {
      const nativeObject = value;
      // 进行空值检查
      if (!nativeObject || nativeObject[this.key] === undefined) {
        return null;
      }

      const result = nativeObject[this.key];
      // 统一处理为数组
      if (Array.isArray(result)) {
        // 使用 safeString 和 map
        return result.map(item => safeString(item));
      } else {
        // 使用 splitLines 和 safeString
        return splitLines(safeString(result));
      }
    }

    override toString(): string {
      return this.key;
    }
  };

  /**
    * 原生对象适配器
    */
    static NativeObjectAdapter = class extends RuleEvaluator {
    private _eval: RuleEvaluator;
    private nativeObjectEvaluator: RuleEvaluator;

    constructor(_eval: RuleEvaluator, nativeObjectEvaluator: RuleEvaluator) {
      super();
      this._eval = _eval;
      this.nativeObjectEvaluator = nativeObjectEvaluator;
    }
        // 使用统一的方法进行判断
        private check(value: any): boolean {
            return isExplicitObject(value);
        }

    override getString(context: AnalyzerManager, value?: any): string {
      return this.check(value)
        ? this.nativeObjectEvaluator.getString(context, value)
        : this._eval.getString(context, value);
    }

    override getStrings(context: AnalyzerManager, value?: any): string[] | null {
      return this.check(value)
        ? this.nativeObjectEvaluator.getStrings(context, value)
        : this._eval.getStrings(context, value);
    }

    override getString0(context: AnalyzerManager, value?: any): string {
      return this.check(value)
        ? this.nativeObjectEvaluator.getString(context, value)
        : this._eval.getString0(context, value);
    }

    override toString(): string {
      return this._eval.toString();
    }
  };
}