import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { joinNonEmpty } from './utils'; // 导入 joinNonEmpty

/**
 * 组合规则执行器。
 * 用于组合多个规则执行器，实现 AND、OR、转置等操作。
 */
export class CombineEvaluator {
  /**
   * AND 组合。
   * 将多个规则执行器的结果合并为一个数组。
   */
  static And = class extends RuleEvaluator {
    private evals: RuleEvaluator[];

    constructor(evals: RuleEvaluator[]) {
      super();
      this.evals = evals;
    }

    override getStrings(context: AnalyzerManager, value: any): string[] {
      const result: string[] = [];
      for (const _eval of this.evals) {
        const strings = _eval.getStrings(context, value);
        if (strings) {
          result.push(...strings);
        }
      }
      return result;
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      const result: any[] = [];
      for (const _eval of this.evals) {
        const elements = _eval.getElements(context, value);
        result.push(...elements);
      }
      return result;
    }

    override getElement(context: AnalyzerManager, value: any): any {
      // AND 组合通常返回多个元素，这里返回数组
      return this.getElements(context, value);
    }

    override toString(): string {
      return joinNonEmpty('&&', this.evals.map((_eval) => _eval.toString()));
    }
  };

  /**
   * OR 组合。
   * 返回第一个非空的结果。
   */
  static Or = class extends RuleEvaluator {
    private evals: RuleEvaluator[];

    constructor(evals: RuleEvaluator[]) {
      super();
      this.evals = evals;
    }

    override getStrings(context: AnalyzerManager, value: any): string[] | null {
      for (const _eval of this.evals) {
        const result = _eval.getStrings(context, value);
        if (result && result.length > 0) {
          return result;
        }
      }
      return null;
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      for (const _eval of this.evals) {
        const result = _eval.getElements(context, value);
        if (result.length > 0) {
          return result;
        }
      }
      return [];
    }

    override getElement(context: AnalyzerManager, value: any): any {
      // OR 组合通常返回第一个匹配的元素，这里返回数组
      return this.getElements(context, value);
    }

    override toString(): string {
      return joinNonEmpty('||', this.evals.map((_eval) => _eval.toString()));
    }
  };

  /**
   * 转置组合。
   * 将多个规则执行器的结果按列合并。
   */
  static Transpose = class extends RuleEvaluator {
    private evals: RuleEvaluator[];

    constructor(evals: RuleEvaluator[]) {
      super();
      this.evals = evals;
    }

    override getStrings(context: AnalyzerManager, value: any): string[] {
      const arrays: string[][] = [];
      for (const _eval of this.evals) {
        const strings = _eval.getStrings(context, value);
        if (strings) {
          arrays.push(strings);
        }
      }
      const result: string[] = [];
      // 假设所有子数组长度相同，以第一个子数组为基准
      if (arrays.length > 0) {
        for (let i = 0; i < arrays[0].length; i++) {
          for (const array of arrays) {
            if (i < array.length) {
              result.push(array[i]);
            }
          }
        }
      }
      return result;
    }

    override getElements(context: AnalyzerManager, value: any): any[] {
      const arrays: any[][] = [];
      for (const _eval of this.evals) {
        arrays.push(_eval.getElements(context, value));
      }
      const result: any[] = [];
      // 假设所有子数组长度相同，以第一个子数组为基准
      if (arrays.length > 0) {
        for (let i = 0; i < arrays[0].length; i++) {
          for (const array of arrays) {
            if (i < array.length) {
              result.push(array[i]);
            }
          }
        }
      }
      return result;
    }

    override getElement(context: AnalyzerManager, value: any): any {
      // 转置组合通常返回多个元素，这里返回数组
      return this.getElements(context, value);
    }

    override toString(): string {
      return joinNonEmpty('%%', this.evals.map((_eval) => _eval.toString()));
    }
  };
}