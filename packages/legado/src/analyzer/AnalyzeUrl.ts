import { isolate } from '../javascript/vm';
import { parseJson } from './utils';
import { RuleAnalyzer } from './RuleAnalyzer';
import { NetworkUtils, NetworkManager, NetworkResponse } from '@any-reader/utils'; // 从 utils 包导入
import contentType from 'content-type';
import iconv from 'iconv-lite';
import chardet from 'chardet';
import { encode } from 'urlencode';
import { load } from 'cheerio';
import { logger } from '@any-reader/utils'; // 导入 logger

/**
 * 请求方法枚举
 */
enum RequestMethod {
  GET = 'GET',
  POST = 'POST'
}

/**
 * URL 选项配置接口
 */
interface UrlOptions {
  method?: RequestMethod;
  charset?: string;
  headers?: Record<string, string>;
  body?: string | null;
  retry?: number;
  type?: string | null;
  useWebView?: boolean;
  webJs?: string | null;
  js?: string | null;
  serverID?: number | null;
}
/**
 * URL 分析器类
 */
export class AnalyzeUrl {
  private JS_PATTERN: RegExp = /<js>([\s\S]*?)<\/js>|@js:([\s\S]*)/gi;
  private pagePattern: RegExp = /<(.*?)>/;
  private paramPattern: RegExp = /\s*,\s*(?=\{)/;

  public ruleUrl: string = '';
  private baseUrl: string = '';
  public method: RequestMethod = RequestMethod.GET;
  public headerMap: Record<string, string> = {};
  public body: string | null = null;
  public type: string | null = null;
  public charset: string | null = null;
  public retry: number = 0;
  public useWebView: boolean = false;
  public webJs: string | null = null;
  public serverID: number | null = null;
  public urlNoQuery: string = '';
  public fieldMap: Record<string, string> = {};

  /**
   * 构造函数
   * @param config URL 配置对象
   */
  constructor(
    public url: string,
    public key?: string | null,
    public page?: number | null,
    baseUrl?: string,
    private networkManager: NetworkManager = new NetworkManager() // 依赖注入 NetworkManager
  ) {
    this.baseUrl = baseUrl ?? '';
    const urlMatcher = this.paramPattern.exec(this.baseUrl);
    if (urlMatcher) {
      this.baseUrl = this.baseUrl.substring(0, urlMatcher.index);
    }
    this.headerMap['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  }

  /**
   * 初始化 URL 分析器
   */
  async init() {
    await this.initUrl();
    return this;
  }

  /**
   * 初始化 URL
   */
  private async initUrl() {
    this.ruleUrl = this.url;
    await this.analyzeJs();
    await this.replaceKeyPageJs();
    await this.analyzeUrl();
  }

  /**
   * 执行 @js,<js></js> 代码
   */
  private async analyzeJs(): Promise<void> {
    this.ruleUrl = await this.processJsBlocks(this.ruleUrl);
  }

  /**
   * 处理 JS 代码块
   * @param input 包含 JS 代码块的字符串
   * @returns 处理后的字符串
   */
  private async processJsBlocks(input: string): Promise<string> {
    let start = 0;
    let result = input;
    let match: RegExpExecArray | null;

    while ((match = this.JS_PATTERN.exec(input)) !== null) {
      if (match.index > start) {
        const substring = input.substring(start, match.index).trim();
        if (substring.length > 0) {
          result = substring.replace('@result', result);
        }
      }

      try {
        const jsResult = await this.evalJS(match[1] || match[2], result);
        result = jsResult ? String(jsResult) : '';
      } catch (e: any) {
        logger.error('执行 JS 失败:', { js: match[1] || match[2], error: e, stack: e.stack });
        result = ''; // 错误时设置为空字符串
      }

      start = match.index + match[0].length;
    }

    if (input.length > start) {
      const substring = input.substring(start).trim();
      if (substring.length > 0) {
        result = substring.replace('@result', result);
      }
    }

    return result;
  }

  /**
   * 替换关键字、页码和内嵌的 JS 代码
   */
  private async replaceKeyPageJs(): Promise<void> {
    this.ruleUrl = await this.processInnerJs(this.ruleUrl);
    this.ruleUrl = this.replacePagePlaceholder(this.ruleUrl);
  }

  /**
    * 处理内嵌的 {{...}} JS 代码
    * @param input 包含 {{...}} 的字符串
    * @returns 替换后的字符串
    */
  private async processInnerJs(input: string): Promise<string> {
    if (!input.includes('{{') || !input.includes('}}')) {
      return input;
    }

    const analyze = new RuleAnalyzer(input);
    return analyze.innerRule2('{{', '}}', async (jsCode: string) => {
      try {
        const jsEval = await this.evalJS(jsCode);
        return jsEval ? String(jsEval) : '';
      } catch (e: any) {
        logger.error('执行内嵌 JS 失败:', { js: jsCode, error: e, stack: e.stack });
        return ''; // 错误时返回空字符串
      }
    });
  }

  /**
   * 替换页码占位符 <...>
   * @param input 包含 <...> 的字符串
   * @returns 替换后的字符串
   */
  private replacePagePlaceholder(input: string): string {
    if (!this.page) {
      return input;
    }

    let match = this.pagePattern.exec(input);
    while (match) {
      const pages = match[1].split(',');
      const replacement = this.page < pages.length
        ? pages[this.page - 1].trim()
        : pages[pages.length - 1].trim();
      input = input.replace(match[0], replacement);
      match = this.pagePattern.exec(input); // 继续查找下一个匹配
    }
    return input;
  }

  /**
 * 解析 URL 和选项
 */
  private async analyzeUrl(): Promise<void> {
    const [urlNoOption, optionJson] = this.extractUrlAndOptions(this.ruleUrl);

    this.url = NetworkUtils.getAbsoluteURL(this.baseUrl, urlNoOption) ?? '';
    this.baseUrl = NetworkUtils.getBaseUrl(this.url) ?? this.baseUrl;

    if (optionJson) {
      await this.processUrlOptions(optionJson);
    }

    this.urlNoQuery = this.url;
    this.processQueryParameters();
  }

  /**
   * 提取 URL 和选项部分
   * @param ruleUrl 完整的 URL 规则字符串
   * @returns [URL, 选项 JSON 字符串]
   */
  private extractUrlAndOptions(ruleUrl: string): [string, string | null] {
    const urlMatcher = this.paramPattern.exec(ruleUrl);
    const urlNoOption = urlMatcher ? ruleUrl.substring(0, urlMatcher.index) : ruleUrl;
    const optionJson = urlMatcher ? ruleUrl.substring(urlMatcher.index + urlMatcher[0].length) : null;
    return [urlNoOption, optionJson];
  }

  /**
   * 处理 URL 选项
   * @param optionJson 选项 JSON 字符串
   */
  private async processUrlOptions(optionJson: string): Promise<void> {
    const option = parseJson<UrlOptions>(optionJson);
    if (!option) {
      return;
    }

    this.method = option.method?.toUpperCase() === 'POST' ? RequestMethod.POST : RequestMethod.GET;
    this.headerMap = { ...this.headerMap, ...option.headers };
    this.body = option.body ?? this.body;
    this.type = option.type ?? this.type;
    this.charset = option.charset ?? this.charset;
    this.retry = option.retry ?? this.retry;
    this.useWebView = !!option.useWebView;
    this.webJs = option.webJs ?? this.webJs;
    this.serverID = option.serverID ?? this.serverID;

    if (option.js) {
      try {
        const evalResult = await this.evalJS(option.js, this.url);
        this.url = evalResult ? String(evalResult) : this.url;
      } catch (e: any) {
        logger.error('解析 URL 参数时执行 JS 失败:', { js: option.js, error: e, stack: e.stack });
      }
    }
  }

  /**
   * 处理查询参数
   */
  private processQueryParameters(): void {
    if (this.method === RequestMethod.GET) {
      const pos = this.url.indexOf('?');
      if (pos !== -1) {
        this.analyzeFields(this.url.substring(pos + 1));
        this.urlNoQuery = this.url.substring(0, pos);
      }
    } else if (this.method === RequestMethod.POST && this.body && !this.headerMap['Content-Type']) {
      if (!this.isJson(this.body) && !this.isXml(this.body)) {
        this.analyzeFields(this.body);
      }
    }
  }

  /**
   * 解析查询参数或表单字段
   * @param fieldsTxt 查询参数或表单字段字符串
   */
  public analyzeFields(fieldsTxt: string): void {
    const queryPairs = fieldsTxt.split('&').filter(s => s.trim()).map(s => s.split('=', 2));

    for (const [key, value = ''] of queryPairs) {
      this.fieldMap[key] = this.encodeFieldValue(value);
    }
  }

  /**
   * 根据字符集编码字段值
   * @param value 字段值
   * @returns 编码后的字段值
   */
  private encodeFieldValue(value: string): string {
    if (!this.charset) {
      return NetworkUtils.isFullyUrlEncoded(value) ? value : encodeURIComponent(value);
    } else if (this.charset === 'escape') {
      return escape(value);
    } else {
      return encode(value, this.charset);
    }
  }

  /**
   * 获取字符串类型的响应
   * @returns 包含响应结果的 Promise
   */
  async getStrResponseAwait(): Promise<{ raw: any; body: string }> {
    const requestConfig: any = {
      responseType: 'arraybuffer',
      responseEncoding: undefined,
      validateStatus: (_status: number) => true,
      paramsSerializer: (params: any) =>
        Object.keys(params)
          .map((key) => `${key}=${params[key]}`)
          .join('&'),
      url: this.urlNoQuery,
      method: this.method,
      headers: this.headerMap,
      data: this.method === RequestMethod.POST ? (this.body || this.buildFormData()) : undefined,
      params: this.method === RequestMethod.GET ? this.fieldMap : undefined,

    };

    logger.debug('请求配置:', { requestConfig });
    const resp = await this.networkManager.request(requestConfig);  // 使用 networkManager
    logger.debug('响应头:', { headers: resp.headers });
    logger.debug('响应状态码:', { status: resp.status });

    return {
      raw: resp.raw, // 确保这里返回了原始响应对象
      body: this.decodeResponseBody(resp),
    };
  }

  /**
   * 构建表单数据
   * @returns 表单数据字符串
   */
  private buildFormData(): string {
    return Object.entries(this.fieldMap)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  /**
 * 解码响应体
 * @param response 
 * @returns 
 */
  private decodeResponseBody(response: NetworkResponse<any>): string {
    const ct = contentType.parse(response.headers['content-type'] || '');
    let encoding = ct.parameters.charset || this.charset;
    if (!encoding) encoding = chardet.detect(response.data);
    let str = iconv.decode(response.data, encoding || 'utf8');
    // 对 HTML 进行进一步处理
    if (ct.type === 'text/html' && /<!doctype html>/i.test(str)) {
      str = load(str, null, true).html();
    }
    return str
  }

  /**
   * 检查文本是否为 JSON 格式
   * @param text 要检查的文本
   * @returns 如果文本是 JSON 格式，则返回 true；否则返回 false
   */
  public isJson(text: string | null): boolean {
    if (!text) {
      return false;
    }
    const str = text.trim();
    return (str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'));
  }

  /**
   * 检查文本是否为 XML 格式
   * @param text 要检查的文本
   * @returns 如果文本是 XML 格式，则返回 true；否则返回 false
   */
  public isXml(text: string | null): boolean {
    if (!text) {
      return false;
    }
    const str = text.trim();
    return str.startsWith('<') && str.endsWith('>');
  }

  /**
   * 执行 JavaScript 代码
   * @param jsStr 要执行的 JavaScript 代码
   * @param result 传递给 JavaScript 代码的参数
   * @returns 执行结果
   */
  public async evalJS(jsStr: string, result: any = null): Promise<any> {
    const context = await isolate.createContext();
    const bindings = context.global;
    // await bindings.set("java", new ivm.Reference(this)); // 如果需要，可以暴露一些对象给 JS 环境
    await bindings.set('key', this.key);
    await bindings.set('page', this.page);
    await bindings.set('result', result);
    return context.eval(jsStr);
  }
}