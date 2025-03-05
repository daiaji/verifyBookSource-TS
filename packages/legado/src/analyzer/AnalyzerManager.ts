import { NetworkUtils } from '@any-reader/utils';
import { RuleEvaluator } from './RuleEvaluator';
import { SourceRuleParser } from './SourceRuleParser';
import { logger } from '@any-reader/utils'
import { isJson, isXml, safeString } from './utils'

/**
 * 分析器管理器类。
 * 负责管理整个分析过程，包括规则解析、数据提取、URL 处理等。
 */
export class AnalyzerManager {
  public isJSON: boolean = false;
  public baseUrl: string = '';
  public redirectUrl: URL | null = null;

  /**
   * 构造函数
   * @param content 要分析的内容（HTML 或 JSON 字符串）
   */
  constructor(public content: any | null) { }

  /**
   * 设置要分析的内容。
   * @param content 要分析的内容
   */
  public setContent(content: any): void {
    this.content = content;
    // 增加 JSON 判断逻辑
    const contentStr = safeString(content); // 先转换为字符串
    if (!isXml(contentStr)) {
      this.isJSON = isJson(contentStr);
    }
    logger.info(`isJSON的状态是: ${this.isJSON}`);
  }

  /**
   * 设置基础 URL。
   * @param baseUrl 基础 URL
   */
  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * 设置重定向 URL。
   * @param redirectUrl 重定向 URL
   */
  public setRedirectUrl(redirectUrl: string): void {
    try {
      this.redirectUrl = new URL(redirectUrl);
    } catch (error) {
      logger.error('设置重定向 URL 失败:', { redirectUrl, error });
      this.redirectUrl = null; // 设置为 null
    }
  }

  /**
   * 获取字符串列表。
   * @param rule 规则（字符串或 RuleEvaluator 对象）
   * @param fieldName 字段名称（用于日志记录）
   * @param content 要处理的内容（可选，默认为 this.content）
   * @param isUrl 是否为 URL（如果是，则进行 URL 拼接）
   * @returns 字符串列表或 null
   */
  public getStringList(
    rule: string | RuleEvaluator | null,
    fieldName: string | null = null,
    content: any | null = null,
    isUrl: boolean = false
  ): string[] | null {
    if (!rule) {
      logger.warn(`接收到空规则, 字段: ${fieldName}`);
      return null;
    }

    let evaluator: RuleEvaluator | null = null;
    if (typeof rule === 'string') {
      if (!rule.trim()) {
        logger.warn(`接收到空规则字符串, 字段: ${fieldName}`);
        return null;
      }
      logger.silly(`解析规则, 字段: ${fieldName}, 规则: ${rule}`);
      try {
        evaluator = SourceRuleParser.parseStrings(rule);
      } catch (e: any) {
        logger.error(`解析规则字符串失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e.message, stack: e.stack });
        return null; // 解析失败，返回 null
      }
    } else {
      evaluator = rule;
    }

    const targetContent = content ?? this.content;
    if (!targetContent) {
      logger.silly(`内容为空, 字段: ${fieldName}, 返回 null`);
      return null;
    }

    const result = evaluator.getStrings(this, targetContent);
    if (isUrl && Array.isArray(result)) {
      const urlList: string[] = [];
      for (const url of result) {
        const absoluteURL = NetworkUtils.getAbsoluteURL(this.redirectUrl, String(url));
        logger.silly(`原始 URL: ${url}, 绝对 URL: ${absoluteURL}`);
        if (absoluteURL && !urlList.includes(absoluteURL)) {
          urlList.push(absoluteURL);
        }
      }
      logger.silly(`返回结果, 字段: ${fieldName}, URL 数量: ${urlList.length}, 第一个 URL: ${urlList[0] ?? 'N/A'}`);
      return urlList;
    }

    logger.silly(`返回结果, 字段: ${fieldName}, 结果数量: ${result ? result.length : 0}`);
    return result;
  }

  /**
   * 获取单个字符串值。
   * @param rule 规则（字符串或 RuleEvaluator 对象）
   * @param fieldName 字段名称（用于日志记录）
   * @param content 要处理的内容（可选，默认为 this.content）
   * @param isUrl 是否为 URL（如果是，则进行 URL 拼接）
   * @returns 字符串值
   */
  public getString(
    rule: RuleEvaluator | string | null,
    fieldName: string | null = null,
    content: any | null = null,
    isUrl: boolean = false
  ): string {
    if (!rule) {
      logger.warn(`接收到空规则, 字段: ${fieldName}`);
      return '';
    }

    let evaluator: RuleEvaluator | null = null;
    if (typeof rule === 'string') {
      if (!rule.trim()) {
        logger.warn(`接收到空规则字符串, 字段: ${fieldName}`);
        return '';
      }
      logger.silly(`解析规则, 字段: ${fieldName}, 规则: ${rule}`);
      try {
        evaluator = SourceRuleParser.parseStrings(rule);
      } catch (e: any) {
        logger.error(`解析规则字符串失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e.message, stack: e.stack });
        return ''; // 解析失败，返回空字符串
      }
    } else {
      evaluator = rule;
    }
    const targetContent = content ?? this.content;

    if (!targetContent || !evaluator) {
      logger.silly(`内容或规则为空, 字段: ${fieldName}, 返回空字符串`);
      return '';
    }
    const result = isUrl ? evaluator.getString0(this, targetContent) : evaluator.getString(this, targetContent);

    if (isUrl) {
      const absoluteUrl = result.trim() === '' ? this.baseUrl : NetworkUtils.getAbsoluteURL(this.redirectUrl, result);
      logger.silly(`返回结果, 字段: ${fieldName}, 结果: ${absoluteUrl} (URL 已处理)`);
      return absoluteUrl;
    }

    logger.silly(`返回结果, 字段: ${fieldName}, 结果: ${result} (URL 未处理)`);
    return result;
  }

  /**
   * 获取单个元素。
   * @param rule 规则字符串
   * @param fieldName 字段名称（用于日志记录）
   * @returns 单个元素或 null
   */
  public getElement(rule: string, fieldName: string | null = null): any | null {
    logger.silly('规则:', { rule, fieldName });
    if (!rule.trim()) {
      logger.warn(`规则为空, 返回 null. 字段: ${fieldName}`);
      return null;
    }
    try {
      return SourceRuleParser.parseElements(rule).getElement(this, this.content);
    } catch (e: any) {
      logger.error(`获取单个元素失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e.message, stack: e.stack });
      return null;
    }
  }

  /**
   * 获取元素列表。
   * @param rule 规则字符串
   * @param fieldName 字段名称（用于日志记录）
   * @returns 元素列表
   */
  public getElements(rule: string, fieldName: string | null = null): any[] {
    logger.silly('规则:', { rule, fieldName });
    if (!rule.trim()) {
      logger.warn(`规则为空, 返回空数组. 字段: ${fieldName}`);
      return [];
    }
    try {
      return SourceRuleParser.parseElements(rule).getElements(this, this.content);
    } catch (e: any) {
      logger.error(`获取元素列表失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e.message, stack: e.stack });
      return [];
    }
  }

  /**
   * 解析规则字符串（用于获取字符串列表的场景）。
   * @param rule 规则字符串
   * @param fieldName 字段名称（用于日志记录）
   * @returns RuleEvaluator 对象或 null
   */
  public parseStrings(rule: string, fieldName: string | null = null): RuleEvaluator | null {
    if (typeof rule !== 'string' || !rule.trim()) {
      logger.silly(`规则为空, 返回 null. 字段: ${fieldName}`);
      return null; // 没有规则, 返回 null
    }
    try {
      return SourceRuleParser.parseStrings(rule);
    } catch (e: any) {
      logger.error(`解析规则字符串失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e.message, stack: e.stack });
      return null; // 解析失败，返回 null
    }
  }

  /**
   * 存储变量。
   * （暂未实现）
   * @param _key 键
   * @param _value 值
   */
  public put(_key: string, _value: any | null): void {
    // TODO: 实现变量存储逻辑
  }

  /**
   * 获取变量。
   * （暂未实现）
   * @param _key 键
   * @returns 值
   */
  public get(_key: string): string {
    // TODO: 实现变量获取逻辑
    return '';
  }

  /**
   * 执行 JavaScript 代码。
   * （暂未实现）
   * @param _script JavaScript 代码
   * @param _result 传递给 JavaScript 代码的参数
   * @returns 执行结果
   */
  public evalJS(_script: string, _result: any | null): any {
    // TODO: 实现 JavaScript 执行逻辑
    return null;
  }
}