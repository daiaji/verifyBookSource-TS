import { NetworkUtils } from '@any-reader/utils';
import { RuleEvaluator } from './RuleEvaluator';
import { SourceRuleParser } from './SourceRuleParser';
import { logger } from '@any-reader/utils'

export class AnalyzerManager {
  content: any | null;
  isJSON: boolean = false;
  baseUrl: string = '';
  redirectUrl: URL | null = null;

  constructor(content: string) {
    this.content = content;
  }

  setContent(content: any) {
    this.content = content;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setRedirectUrl(redirectUrl: string) {
    try {
      this.redirectUrl = new URL(redirectUrl);
    } catch (error) {
      logger.error('设置重定向 URL 失败:', { redirectUrl, error });
      this.redirectUrl = null; // 设置为 null
    }
  }

  getStringList(rule: string | RuleEvaluator | null, fieldName: string | null = null, content: any | null = null, isUrl: boolean = false) {
    if (!rule) {
      logger.warn(`接收到空规则, 字段: ${fieldName}`);
      return null;
    }

    if (typeof rule === 'string') {
      if (!rule.trim()) {
        logger.warn(`接收到空规则字符串, 字段: ${fieldName}`);
        return null;
      }
      logger.silly(`解析规则, 字段: ${fieldName}, 规则: ${rule}`);
      rule = SourceRuleParser.parseStrings(rule);
    }
    content ??= this.content;
    if (!content) {
      logger.silly(`内容为空, 字段: ${fieldName}, 返回 null`);
      return null;
    }

    const result = rule.getStrings(this, content);
    if (isUrl && Array.isArray(result)) {
      const urlList: string[] = [];
      for (const url of result) {
        const absoluteURL = NetworkUtils.getAbsoluteURL(this.redirectUrl, String(url));
        if (absoluteURL && !urlList.includes(absoluteURL)) {
          urlList.push(absoluteURL);
        }
      }
      logger.silly(`返回结果, 字段: ${fieldName}, 结果: ${JSON.stringify(urlList)}, (URL 已处理)`);
      return urlList;
    }

    logger.silly(`返回结果, 字段: ${fieldName}, 结果: ${JSON.stringify(result)}`);
    return result;
  }

  getString(
    rule: RuleEvaluator | string | null,
    fieldName: string | null = null,
    content: any | null = null,
    isUrl: boolean = false
  ) {
    if (!rule) {
      logger.warn(`接收到空规则, 字段: ${fieldName}`);
      return '';
    }
    if (typeof rule === 'string') {
      if (!rule.trim()) {
        logger.warn(`接收到空规则字符串, 字段: ${fieldName}`);
        return '';
      }
      logger.silly(`解析规则, 字段: ${fieldName}, 规则: ${rule}`);
      rule = SourceRuleParser.parseStrings(rule);
    }

    let result = '';
    content ??= this.content;

    if (content && rule) {
      result = isUrl ? rule.getString0(this, content) : rule.getString(this, content);
    }

    if (isUrl) {
      const absoluteUrl = result.trim() === '' ? this.baseUrl : NetworkUtils.getAbsoluteURL(this.redirectUrl, result);
      logger.silly(`返回结果, 字段: ${fieldName}, 结果: ${absoluteUrl}, (URL 已处理)`);
      return absoluteUrl;
    }

    // isUrl 为 false 时，只记录一个日志，并添加标记
    logger.silly(`返回结果, 字段: ${fieldName}, 结果: ${result}, (URL 未处理)`);
    return result;
  }

  getElement(rule: string, fieldName: string | null = null) {
    logger.silly('规则:', { rule, fieldName }); // 添加 fieldName
    if (!rule.trim()) {
      logger.warn(`规则为空, 返回 null. 字段: ${fieldName}`);  // 明确警告并显示字段名
      return null;
    }
    try {
      return SourceRuleParser.parseElements(rule).getElement(this, this.content);
    } catch (e: any) {
      logger.error(`获取单个元素失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e, stack: e.stack }); // 捕获并记录异常
      return null;
    }
  }

  getElements(rule: string, fieldName: string | null = null) {
    logger.silly('规则:', { rule, fieldName }); // 添加 fieldName
    if (!rule.trim()) {
      logger.warn(`规则为空, 返回空数组. 字段: ${fieldName}`); // 明确警告并显示字段名
      return [];
    }
    try {
      return SourceRuleParser.parseElements(rule).getElements(this, this.content);
    } catch (e: any) {
      logger.error(`获取元素列表失败, 字段: ${fieldName}, 规则: ${rule}`, { error: e, stack: e.stack }); // 捕获并记录异常
      return [];
    }
  }

  parseStrings(rule: string, fieldName: string | null = null) {
    if (typeof rule !== 'string' || !rule.trim()) {
      logger.silly(`规则为空, 返回 null. 字段: ${fieldName}`); // 降低级别
      return null; // 没有规则, 返回空白, 不然后面会报错
    }
    return SourceRuleParser.parseStrings(rule);
  }

  put(_key: string, _value: any | null) {
    throw new Error('未实现');
  }

  get(_key: string): string {
    throw new Error('未实现');
  }

  evalJS(_script: string, _result: any | null): any {
    throw new Error('未实现');
  }
}