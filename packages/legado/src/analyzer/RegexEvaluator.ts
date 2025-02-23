import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';
import { handleError, joinNonEmpty, safeString } from './utils';

/**
 * 正则表达式规则执行器抽象基类。
 * 所有具体的正则表达式规则执行器都应该继承此类。
 */
export abstract class RegexEvaluator extends RuleEvaluator {
  /**
   * 使用正则表达式替换字符串。
   * @param context AnalyzerManager 实例
   * @param beforeContent 上一个规则执行后的内容
   * @param content 当前规则要处理的内容
   * @returns 替换后的字符串
   */
  abstract replace(context: AnalyzerManager, beforeContent: any, content: any): string;

  /**
   * 使用正则表达式替换字符串列表。
   * @param context AnalyzerManager 实例
   * @param beforeContent 上一个规则执行后的内容
   * @param content 当前规则要处理的内容
   * @returns 替换后的字符串数组
   */
  abstract replaceList(context: AnalyzerManager, beforeContent: any, content: any): string[];

  override getStrings(context: AnalyzerManager, value: any): string[] {
    return Array.isArray(value)
      ? this.replaceList(context, value, value)
      : this.replace(context, value, safeString(value)).split('\n'); // 使用 safeString
  }

  override getString(context: AnalyzerManager, value: any): string {
    return this.replace(context, value, safeString(value)); // 使用 safeString
  }

  /**
   * 全局替换。
   */
  static Replace = class extends RegexEvaluator {
    constructor(
      private regexEval: RuleEvaluator,
      private replacementEval: RuleEvaluator
    ) {
      super();
    }

    override replace(context: AnalyzerManager, beforeContent: any, content: any): string {
      const vResult = safeString(content); // 使用 safeString
      if (!vResult) return '';

      const replacement = this.replacementEval.getString(context, beforeContent);
      const regex = this.regexEval.eval(context, beforeContent);

      try {
        if (regex instanceof RegExp) {
          return vResult.replace(regex, replacement);
        } else if (typeof regex === 'string') {
          return vResult.replace(new RegExp(regex), replacement);
        } else {
          throw new Error('Invalid state: unsupport regex type.');
        }
      } catch (e: any) {
        // 捕获正则表达式相关的异常
        handleError('正则表达式替换失败:', { regex: regex?.toString(), replacement, content: vResult, error: e, stack: e.stack }, vResult);
        return vResult; // 发生错误时，返回原始字符串
      }
    }

    override replaceList(context: AnalyzerManager, beforeContent: any, content: any): string[] {
      const resultList = content as any[];
      if (resultList.length === 0) return [];

      const replacement = this.replacementEval.getString(context, beforeContent);
      const regex = this.regexEval.eval(context, beforeContent);

      try {
        if (regex instanceof RegExp) {
          return resultList.map((result) => result ? result.toString().replace(regex, replacement) : '');
        } else if (typeof regex === 'string') {
          return resultList.map((result) => result ? result.toString().replace(new RegExp(regex), replacement) : '');
        } else {
          throw new Error('Invalid state: unsupport regex type.');
        }
      } catch (e: any) {
        // 捕获正则表达式相关的异常
        handleError('正则表达式替换列表失败:', { regex: regex?.toString(), replacement, content: resultList, error: e, stack: e.stack }, resultList.map(String));
        return resultList.map(String); // 发生错误时，返回原始字符串数组
      }
    }

    override toString(): string {
      const replacement = this.replacementEval.toString();
      // 使用 joinNonEmpty
      return joinNonEmpty('', [
        '##',
        this.regexEval.toString(),
        '##',
        replacement,
      ]);
    }
  };

  /**
   * 替换第一个匹配项。
   */
  static ReplaceFirst = class extends RegexEvaluator {
    constructor(
      private regexEval: RuleEvaluator,
      private replacementEval: RuleEvaluator
    ) {
      super();
    }

    override replace(context: AnalyzerManager, beforeContent: any, content: any): string {
      const result = safeString(beforeContent); // 使用 safeString
      const replacement = this.replacementEval.getString(context, result);
      const regex = this.regexEval.eval(context, result) as RegExp;


      if (!(regex instanceof RegExp)) {
        return replacement;
      }
      try {
        const match = String(content).match(regex);
        if (!match) {
          return '';
        }
        return match[0].replace(regex, replacement);
      } catch (e: any) {
        handleError('正则表达式首次替换失败:', { regex: regex.toString(), replacement, content, error: e, stack: e.stack }, String(content));
        return String(content);
      }
    }

    override replaceList(context: AnalyzerManager, beforeContent: any, content: any): string[] {
      const resultList = beforeContent as any[];
      const replacement = this.replacementEval.getString(context, content);
      const regex = this.regexEval.eval(context, content);

      try {
        return resultList.map((result) => {
          if (regex instanceof RegExp) {
            const match = String(result).match(regex);
            if (!match) {
              return '';
            }
            return match[0].replace(regex, replacement);
          } else {
            return replacement;
          }
        });
      } catch (e: any) {
        // 捕获正则表达式相关的异常
        handleError('正则表达式首次替换列表失败: ', { regex: regex?.toString(), replacement, content: resultList, error: e, stack: e.stack }, resultList.map(String));
        return resultList.map(String); // 发生错误时，返回原始字符串数组
      }
    }

    override toString(): string {
      // 使用 joinNonEmpty
      return joinNonEmpty('', [
        '##',
        this.regexEval.toString(),
        '##',
        this.replacementEval.toString(),
        '###',
      ]);
    }
  };

  /**
   * 字面量正则表达式。
   */
  static RegexLiteral = class extends RuleEvaluator {
    private regex: RegExp | null;

    constructor(private str: string) {
      super();
      this.regex = this.compileRegex(str);
    }
    /**
     * 编译正则表达式。
     * @param str 正则表达式字符串
     * @returns 编译后的 RegExp 对象，如果编译失败则返回 null
     */
    private compileRegex(str: string): RegExp | null {
      try {
        return new RegExp(str);
      } catch (e: any) {
        handleError('编译正则表达式失败:', { regex: str, error: e, stack: e.stack }, null);
        return null; // 编译失败时返回 null
      }
    }

    override eval(_context: AnalyzerManager, _value: any): any {
      return this.regex || this.str;
    }

    override getString(_context: AnalyzerManager, _value: any): string {
      return this.str;
    }

    override toString(): string {
      return this.str;
    }
  };

  /**
   * 正则表达式求值。
   */
  static RegexEval = class extends RuleEvaluator {
    constructor(private _eval: RuleEvaluator) {
      super();
    }

    override eval(context: AnalyzerManager, value: any): any {
      const regex = this._eval.getString(context, value);
      try {
        return new RegExp(regex);
      } catch (e: any) {
        handleError('编译正则表达式失败:', { regex, error: e, stack: e.stack }, regex);
        return regex; // 编译失败时返回原始字符串
      }
    }

    override toString(): string {
      return this._eval.toString();
    }
  };

  /**
   * 字面量替换字符串。
   */
  static ReplacementLiteral = class extends RuleEvaluator {
    constructor(private str: string) {
      super();
    }

    override getString(_context: AnalyzerManager, _value: any): string {
      return this.str;
    }

    override toString(): string {
      return this.str;
    }
  };

  /**
   * 替换字符串求值。
   */
  static ReplacementEval = class extends RuleEvaluator {
    constructor(private _eval: RuleEvaluator) {
      super();
    }

    override getString(context: AnalyzerManager, value: any): string {
      return this._eval.getString(context, value);
    }

    override toString(): string {
      return this._eval.toString();
    }
  };

  /**
   * 多合一正则表达式。
   */
  static AllInOne = class extends RuleEvaluator {
    private patterns: RegExp[];
    private static readonly MAX_PATTERN_LENGTH = 200; // 最大模式长度，防止 ReDoS
    private static readonly MAX_INPUT_LENGTH = 10000; // 最大输入长度, 防止 ReDoS
    constructor(private regexStrList: string[]) {
      super();
      this.patterns = this.compilePatterns(regexStrList);
    }
    /**
     * 编译正则表达式模式。
     * @param regexStrList 正则表达式字符串列表
     * @returns 编译后的 RegExp 对象数组
     */
    private compilePatterns(regexStrList: string[]): RegExp[] {
      try {
        return regexStrList.map(str => {
          if (str.length > RegexEvaluator.AllInOne.MAX_PATTERN_LENGTH) {
            handleError('正则表达式过长，可能存在 ReDoS 风险:', { regex: str }, null);
            return /./; // 返回一个无害的正则表达式
          }
          return new RegExp(str);
        });
      } catch (e: any) {
        handleError('编译正则表达式失败:', { regexStrList, error: e, stack: e.stack }, []);
        return []; // 编译失败时设置为空数组
      }
    }
    /**
     * 匹配并提取字符串。
     * @param content 要匹配的字符串
     * @param pattern 正则表达式模式
     * @returns 匹配结果数组，如果没有匹配则返回 null
     */
    private matchAndExtract(content: string, pattern: RegExp): string[] | null {
      try {
        const matcher = content.match(pattern);
        return matcher;
      } catch (e: any) {
        handleError('正则表达式匹配失败: ', { pattern: pattern.toString(), content: content, error: e, stack: e.stack }, null);
        return null; // 匹配失败时返回 null
      }
    }
    /**
     * 处理匹配结果。
     * @param content 要处理的字符串
     * @returns 提取的字符串数组，如果没有匹配则返回 null
     */
    private processMatches(content: string): string[] | null {
      let result = safeString(content); // 使用 safeString
      const sb = [];

      for (let i = 0; i < this.patterns.length - 1; i++) {
        if (result.length > RegexEvaluator.AllInOne.MAX_INPUT_LENGTH) {
          handleError('输入字符串过长，可能存在 ReDoS 风险:', { content }, null);
          return null;
        }
        const matcher = this.matchAndExtract(result, this.patterns[i]);
        if (!matcher) return null;
        sb.push(...matcher);
        result = sb.join('');
        sb.length = 0;
      }

      const lastPattern = this.patterns[this.patterns.length - 1];
      return this.matchAndExtract(result, lastPattern);
    }
    /**
     * 处理所有匹配结果。
     * @param content 要处理的字符串
     * @returns 所有匹配结果的数组
     */
    private processAllMatches(content: string): any[] {
      let result = safeString(content); // 使用 safeString
      const sb = [];

      for (let i = 0; i < this.patterns.length - 1; i++) {
        if (result.length > RegexEvaluator.AllInOne.MAX_INPUT_LENGTH) {
          handleError('输入字符串过长，可能存在 ReDoS 风险: ', { content }, []);
          return [];
        }
        const matcher = this.matchAndExtract(result, this.patterns[i]);
        if (!matcher) return [];
        sb.push(...matcher);
        result = sb.join('');
        sb.length = 0;
      }

      const lastPattern = this.patterns[this.patterns.length - 1];
      const matches = [];
      let match;

      try {
        while ((match = lastPattern.exec(result))) {
          matches.push([...match]);
        }
      } catch (e: any) {
        handleError('正则表达式匹配失败: ', { pattern: lastPattern.toString(), content: result, error: e, stack: e.stack }, []);
        return []; // 匹配失败时返回空数组
      }
      return matches;
    }


    override getElement(_context: AnalyzerManager, value: any): any | null {
      return this.processMatches(value);
    }

    override getElements(_context: AnalyzerManager, value: any): any[] {
      return this.processAllMatches(value);
    }

    override toString(): string {
      return ':' + this.regexStrList.join('&&');
    }
  };
}