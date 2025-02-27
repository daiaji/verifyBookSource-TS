import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { isolate } from '../javascript/vm'; // 导入已定义的 isolate
import { joinNonEmpty, safeString, handleError } from './utils';

/**
 * JavaScript 执行器抽象基类。
 * 所有具体的 JavaScript 执行器都应该继承此类。
 */
export abstract class JsEvaluator extends RuleEvaluator {
  /**
   * 执行 JavaScript 代码并返回元素（通常是 DOM 元素）。
   * 子类必须实现此方法。
   * @param context AnalyzerManager 实例
   * @param value 要处理的值
   * @returns 执行结果
   */
  abstract evalElements(context: AnalyzerManager, value?: any): any;

  /**
   * Js 执行器。
   * 用于执行 JavaScript 代码。
   */
  static Js = class extends JsEvaluator {
    private script: JsEvaluator;
    private prefix: string;

    constructor(script: JsEvaluator, prefix: string) {
      super();
      this.script = script;
      this.prefix = prefix;
    }

    /**
     * 执行 JavaScript 代码并返回单个字符串值。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 执行结果（字符串）
     */
    override getString(context: AnalyzerManager, value?: any): string {
      try {
        const result = this.eval(context, value);
        return safeString(result); // 使用 safeString
      } catch (e: any) {
        return handleError('JsEvaluator.getString 执行失败:', { script: this.script.toString(), error: e }, '');
      }
    }

    /**
     * 执行 JavaScript 代码并返回字符串数组。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 执行结果（字符串数组或 null）
     */
    override getStrings(context: AnalyzerManager, value?: any): string[] | null {
      try {
        const result = this.eval(context, value);
        if (Array.isArray(result)) {
          return result.map(item => safeString(item)); // 使用 safeString
        }
        return result ? [safeString(result)] : null; // 使用 safeString
      } catch (e: any) {
        return handleError('JsEvaluator.getStrings 执行失败:', { script: this.script.toString(), error: e }, null);
      }
    }

    /**
     * 执行 JavaScript 代码并返回单个元素。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 执行结果
     */
    override getElement(context: AnalyzerManager, value?: any): any {
      try {
        return this.eval(context, value); // 类型已经在 eval 中处理
      } catch (e: any) {
        return handleError('JsEvaluator.getElement 执行失败:', { script: this.script.toString(), error: e }, null);
      }
    }

    /**
     * 执行 JavaScript 代码并返回元素数组。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 执行结果（元素数组）
     */
    override getElements(context: AnalyzerManager, value?: any): any[] {
      try {
        const script = this.script.evalElements(context, value);
        return context.evalJS(script, value); // 类型已经在 evalJS 中处理
      } catch (e: any) {
        return handleError('JsEvaluator.getElements 执行失败:', { script: this.script.toString(), error: e }, []);
      }
    }

    /**
     * 执行 JavaScript 代码。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 执行结果
     */
    override eval(context: AnalyzerManager, value?: any): any {
      try {
        const script = this.script.eval(context, value);
        return context.evalJS(script, value);
      } catch (e: any) {
        return handleError('JsEvaluator.eval 执行失败:', { script: this.script.toString(), error: e }, null);
      }
    }

    /**
     * 执行 JavaScript 代码并返回元素（通常是 DOM 元素）。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 执行结果
     */
    override evalElements(context: AnalyzerManager, value?: any): any {
      const script = this.script.evalElements(context, value);
      return context.evalJS(script, value); // 类型已经在 evalJS 中处理
    }

    /**
     * 返回规则的字符串表示形式。
     * @returns 规则的字符串表示形式
     */
    override toString(): string {
      // 使用 joinNonEmpty
      return joinNonEmpty('', [
        this.prefix === '<js>' ? '<js>' : undefined,
        this.prefix === '@js:' ? '@js:' : undefined,
        this.script.toString(),
        this.prefix === '<js>' ? '</js>' : undefined,
      ]);
    }
  };

  /**
   * 字面量脚本执行器。
   * 用于直接执行给定的 JavaScript 代码。
   */
  static ScriptLiteral = class extends JsEvaluator {
    private script: string;
    // private compiledScript: CompiledScript;   // 移除

    constructor(script: string) {
      super();
      this.script = script;
      // this.compiledScript = RhinoScriptEngine.compile(script); // 这里只是模拟编译  //移除
    }

    /**
     * 返回编译后的脚本（模拟）。
     * @param _context AnalyzerManager 实例
     * @param _value 要处理的值
     * @returns 编译后的脚本
     */
    override eval(_context: AnalyzerManager, _value?: any): any {
      return this.script; // 直接返回
    }

    /**
     * 返回编译后的脚本（模拟）。
     * @param _context AnalyzerManager 实例
     * @param _value 要处理的值
     * @returns 编译后的脚本
     */
    override evalElements(_context: AnalyzerManager, _value?: any): any {
      return this.script;  // 直接返回
    }

    /**
     * 返回脚本的字符串表示形式。
     * @returns 脚本的字符串表示形式
     */
    override toString(): string {
      return this.script;
    }
  };

  /**
   * 脚本求值执行器。
   * 用于执行从其他规则获取的 JavaScript 代码。
   */
  static ScriptEval = class extends JsEvaluator {
    private script: RuleEvaluator;
    // private compiledScript: CompiledScript; // 移除未使用的属性

    constructor(script: RuleEvaluator) {
      super();
      this.script = script;
      // this.compiledScript = RhinoScriptEngine.compile(script.toString()); // 不需要预编译
    }

    /**
     * 编译从其他规则获取的 JavaScript 代码（模拟）。
     * @param context AnalyzerManager 实例
     * @param value 要处理的值
     * @returns 编译后的脚本（模拟）
     */
    override eval(context: AnalyzerManager, value?: any): any {
      // 每次 eval 时动态编译
      return this.script.getString(context, value);   // 直接返回, 不需要编译
    }

    /**
      * 返回编译后的脚本（模拟）。
      * @param _context AnalyzerManager 实例
      * @param _value 要处理的值
      * @returns 编译后的脚本
      */
    override evalElements(context: AnalyzerManager, value?: any): any {
      return this.script.getString(context, value); // 直接返回, 不需要编译
    }

    /**
     * 返回规则的字符串表示形式。
     * @returns 规则的字符串表示形式
     */
    override toString(): string {
      return this.script.toString();
    }
  };
}