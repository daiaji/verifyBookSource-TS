import { AnalyzerManager } from './AnalyzerManager';

/**
 * 规则执行器的基类。
 * 所有具体的规则执行器都应该继承此类，并实现相应的方法。
 */
export abstract class BaseRuleEvaluator {
  /**
   * 获取规则执行器的类名。
   * @returns 类名
   */
  private getClassName() {
    return this.constructor.name;
  }

  /**
   * 获取单个字符串值。
   * 子类应该实现此方法。
   * @param _context AnalyzerManager 实例
   * @param _value 要处理的值
   * @returns 字符串值，默认为空字符串
   */
  getString(_context: AnalyzerManager, _value: any): string {
    return '';
  }

  /**
   * 获取单个元素。
   * 子类应该实现此方法。
   * @param _context AnalyzerManager 实例
   * @param _value 要处理的值
   * @returns 元素，默认为 null
   */
  getElement(_context: AnalyzerManager, _value: any): any | null {
    return null;
  }

  /**
   * 获取字符串值（不进行 URL 编码）。
   * 子类应该实现此方法。
   * @param _context AnalyzerManager 实例
   * @param _value 要处理的值
   * @returns 字符串值，默认为空字符串
   */
  getString0(_context: AnalyzerManager, _value: any): string {
    return '';
  }

  /**
   * 获取字符串列表。
   * 子类应该实现此方法。
   * @param _context AnalyzerManager 实例
   * @param _value 要处理的值
   * @returns 字符串数组，默认为 null
   */
  getStrings(_context: AnalyzerManager, _value: any): string[] | null {
    return null;
  }

  /**
   * 获取元素列表。
   * 子类应该实现此方法。
   * @param _context AnalyzerManager 实例
   * @param _value 要处理的值
   * @returns 元素数组，默认为空数组
   */
  getElements(_context: AnalyzerManager, _value: any): any[] {
    return [];
  }

  /**
   * 执行规则。
   * 子类应该实现此方法。
   * @param _context AnalyzerManager 实例
   * @param _value 要处理的值
   * @returns 任意值，默认为 null
   */
  eval(_context: AnalyzerManager, _value: any): any | null {
    return null;
  }
}