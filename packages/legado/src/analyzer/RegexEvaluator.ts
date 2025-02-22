import { AnalyzerManager } from './AnalyzerManager';
import { RuleEvaluator } from './common';

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
    if (Array.isArray(value)) {
      return this.replaceList(context, value, value);
    } else {
      return this.replace(context, value, value?.toString() || '').split('\n');
    }
  }

  override getString(context: AnalyzerManager, value: any): string {
    return this.replace(context, value, value?.toString() || '');
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
      const vResult = content?.toString() || '';
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
        console.error(`正则表达式替换失败: ${e.message}`, { regex: regex?.toString(), replacement, content: vResult });
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
        console.error(`正则表达式替换列表失败: ${e.message}`, { regex: regex?.toString(), replacement, content: resultList });
        return resultList.map(String); // 发生错误时，返回原始字符串数组
      }
    }

    override toString(): string {
      const replacement = this.replacementEval.toString();
      return replacement ? `##${this.regexEval}##${this.replacementEval}` : `##${this.regexEval}`;
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
      const result = beforeContent?.toString() || '';
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
        // 捕获正则表达式相关的异常
        console.error(`正则表达式首次替换失败: ${e.message}`, { regex: regex.toString(), replacement, content });
        return String(content); // 发生错误时，返回原始字符串
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
        console.error(`正则表达式首次替换列表失败: ${e.message}`, { regex: regex?.toString(), replacement, content: resultList });
        return resultList.map(String); // 发生错误时，返回原始字符串数组
      }
    }

    override toString(): string {
      return `##${this.regexEval}##${this.replacementEval}###`;
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

    private compileRegex(str: string): RegExp | null {
      try {
        return new RegExp(str);
      } catch (e: any) {
        console.error(`编译正则表达式失败: ${e.message}`, { regex: str });
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
        console.error(`编译正则表达式失败: ${e.message}`, { regex });
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

    constructor(private regexStrList: string[]) {
      super();
      try {
        this.patterns = regexStrList.map((str) => new RegExp(str));
      } catch (e: any) {
        console.error(`编译正则表达式失败: ${e.message}`, { regexStrList });
        this.patterns = []; // 编译失败时设置为空数组
      }
    }

    private prepare(value: any): string | null {
      let result = value?.toString() || '';
      const sb = [];

      for (let i = 0; i < this.patterns.length - 1; i++) {
        const pattern = this.patterns[i];
        try {
          const matcher = result.match(pattern);
          if (!matcher) return null;

          sb.push(...matcher);
          result = sb.join('');
          sb.length = 0;
        } catch (e: any) {
          console.error(`正则表达式匹配失败: ${e.message}`, { pattern: pattern.toString(), content: result });
          return null; // 匹配失败时返回 null
        }
      }

      return result;
    }

    override getElement(_context: AnalyzerManager, value: any): any | null {
      const result = this.prepare(value);
      if (!result) return null;

      const pattern = this.patterns[this.patterns.length - 1];
      try {
        const matcher = result.match(pattern);
        if (!matcher) return null;

        return [...matcher];
      } catch (e: any) {
        console.error(`正则表达式匹配失败: ${e.message}`, { pattern: pattern.toString(), content: result });
        return null; // 匹配失败时返回 null
      }
    }

    override getElements(_context: AnalyzerManager, value: any): any[] {
      const result = this.prepare(value);
      if (!result) return [];

      const pattern = this.patterns[this.patterns.length - 1];
      const matches = [];
      let match;

      try {
        while ((match = pattern.exec(result))) {
          matches.push([...match]);
        }
      } catch (e: any) {
        console.error(`正则表达式匹配失败: ${e.message}`, { pattern: pattern.toString(), content: result });
        return []; // 匹配失败时返回空数组
      }

      return matches;
    }

    override toString(): string {
      return ':' + this.regexStrList.join('&&');
    }
  };
}