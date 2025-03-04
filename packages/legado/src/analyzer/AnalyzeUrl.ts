import { isolate } from '../javascript/vm';
import { parseJson, isJson, isXml } from './utils';
import { RuleAnalyzer } from './RuleAnalyzer';
import { NetworkUtils, NetworkManager, NetworkResponse } from '@any-reader/utils';
import contentType from 'content-type';
import iconv from 'iconv-lite';
import chardet from 'chardet';
import { encode } from 'urlencode';
import { load } from 'cheerio';
import { logger } from '@any-reader/utils';

/**
 * 请求方法枚举。
 */
enum RequestMethod {
  GET = 'GET',
  POST = 'POST'
}

/**
 * URL 解析选项接口。
 */
interface UrlOptions {
  /** 请求方法 */
  method?: RequestMethod;
  /** 字符编码 */
  charset?: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: string | null;
  /** 重试次数 */
  retry?: number;
  /** 请求类型 */
  type?: string | null;
  /** 是否使用 WebView */
  useWebView?: boolean;
  /** WebView 加载的 JavaScript 代码 */
  webJs?: string | null;
  /** 直接执行的 JavaScript 代码 */
  js?: string | null;
  /** 服务器 ID */
  serverID?: number | null;
}

/**
 * URL 解析类。
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
   * 构造函数。
   * @param {string} url 要解析的 URL
   * @param {string | null} [key] 搜索关键字
   * @param {number | null} [page] 页码
   * @param {string} [baseUrl] 基础 URL
   * @param {NetworkManager} [networkManager] 网络请求管理器实例
   */
  constructor(
    public url: string,
    public key?: string | null,
    public page?: number | null,
    baseUrl?: string,
    private networkManager: NetworkManager = new NetworkManager()
  ) {
    this.baseUrl = baseUrl ?? '';
    const urlMatcher = this.paramPattern.exec(this.baseUrl);
    if (urlMatcher) {
      this.baseUrl = this.baseUrl.substring(0, urlMatcher.index);
    }
    this.headerMap['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  }

  /**
   * 初始化 AnalyzeUrl 实例。
   * @returns {Promise<this>}  返回自身
   */
  async init() {
    await this.initUrl();
    return this;
  }

  /**
   * 初始化 URL。
   * @private
   */
  private async initUrl() {
    this.ruleUrl = this.url;
    await this.analyzeJs();
    await this.replaceKeyPageJs();
    await this.analyzeUrl();
  }

  /**
   * 解析 URL 中的 JS 代码。
   * @private
   */
  private async analyzeJs(): Promise<void> {
    this.ruleUrl = await this.processJsBlocks(this.ruleUrl);
  }

  /**
   * 处理 JS 代码块。
   * @param {string} input 包含 JS 代码的字符串
   * @returns {Promise<string>} 处理后的字符串
   * @private
   */
  private async processJsBlocks(input: string): Promise<string> {
    let result = input;
    let start = 0;
    let match: RegExpExecArray | null;

    while ((match = this.JS_PATTERN.exec(input)) !== null) {
      if (match.index > start) {
        const preJsStr = input.substring(start, match.index).trim();
        if (preJsStr.length > 0) {
          result = preJsStr.replace('@result', result);
        }
      }

      const jsCode = match[1] || match[2];
      result = await this.executeAndHandleJs(jsCode, result);

      start = match.index + match[0].length;
    }

    if (input.length > start) {
      const lastStr = input.substring(start).trim();
      if (lastStr.length > 0) {
        result = lastStr.replace('@result', result);
      }
    }

    return result;
  }

  /**
   * 执行 JS 代码并处理异常。
   * @param {string} jsCode 要执行的 JS 代码
   * @param {any} context JS 执行的上下文
   * @returns {Promise<string>} 执行结果
   * @private
   */
  private async executeAndHandleJs(jsCode: string, context: any): Promise<string> {
    try {
      const jsResult = await this.evalJS(jsCode, context);
      return jsResult ? String(jsResult) : '';
    } catch (e: any) {
      logger.error('执行 JS 失败:', { js: jsCode, error: e, stack: e.stack, fieldName: 'executeJs', ruleContent: jsCode });
      return '';
    }
  }

  /**
   * 替换 URL 中的关键字和页码占位符。
   * @private
   */
  private async replaceKeyPageJs(): Promise<void> {
    this.ruleUrl = await this.processInnerJs(this.ruleUrl);
    this.ruleUrl = this.replacePagePlaceholder(this.ruleUrl);
  }

  /**
   * 处理内嵌的 JS 代码。
   * @param {string} input 包含内嵌 JS 代码的字符串
   * @returns {Promise<string>} 处理后的字符串
   * @private
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
        logger.error('执行内嵌 JS 失败:', { js: jsCode, error: e, stack: e.stack, fieldName: 'innerJs', ruleContent: jsCode });
        return '';
      }
    });
  }

  /**
   * 替换页码占位符。
   * @param {string} input 包含页码占位符的字符串
   * @returns {string} 替换后的字符串
   * @private
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
      match = this.pagePattern.exec(input);
    }
    return input;
  }

  /**
   * 解析 URL 和选项。
   * @private
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
   * 提取 URL 和选项。
   * @param {string} ruleUrl 包含 URL 和选项的字符串
   * @returns {[string, string | null]} URL 和选项的元组
   * @private
   */
  private extractUrlAndOptions(ruleUrl: string): [string, string | null] {
    const urlMatcher = this.paramPattern.exec(ruleUrl);
    const urlNoOption = urlMatcher ? ruleUrl.substring(0, urlMatcher.index) : ruleUrl;
    const optionJson = urlMatcher ? ruleUrl.substring(urlMatcher.index + urlMatcher[0].length) : null;
    return [urlNoOption, optionJson];
  }

  /**
   * 处理 URL 选项。
   * @param {string} optionJson 选项的 JSON 字符串
   * @private
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
        logger.error('解析 URL 参数时执行 JS 失败:', { js: option.js, error: e, stack: e.stack, fieldName: 'urlOptions.js', ruleContent: option.js });
      }
    }
  }

  /**
   * 处理查询参数。
   * @private
   */
  private processQueryParameters(): void {
    if (this.method === RequestMethod.GET) {
      const pos = this.url.indexOf('?');
      if (pos !== -1) {
        this.analyzeFields(this.url.substring(pos + 1));
        this.urlNoQuery = this.url.substring(0, pos);
      }
    } else if (this.method === RequestMethod.POST && this.body && !this.headerMap['Content-Type']) {
      if (!isJson(this.body) && !isXml(this.body)) {
        this.analyzeFields(this.body);
      }
    }
  }

  /**
   * 解析字段。
   * @param {string} fieldsTxt 字段字符串
   */
  public analyzeFields(fieldsTxt: string): void {
    const queryPairs = fieldsTxt.split('&').filter(s => s.trim()).map(s => s.split('=', 2));

    for (const [key, value = ''] of queryPairs) {
      this.fieldMap[key] = this.encodeFieldValue(value);
    }
  }

  /**
   * 编码字段值。
   * @param {string} value 字段值
   * @returns {string} 编码后的字段值
   * @private
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
   * 获取字符串响应。
   * @returns {Promise<{ raw: any; body: string }>} 包含原始响应和解码后响应体的对象
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
    const resp = await this.networkManager.request(requestConfig);
    logger.debug('响应头:', { headers: resp.headers });
    logger.debug('响应状态码:', { status: resp.status });

    return {
      raw: resp.raw,
      body: this.decodeResponseBody(resp),
    };
  }

  /**
   * 构建表单数据。
   * @returns {string} 表单数据字符串
   * @private
   */
  private buildFormData(): string {
    return Object.entries(this.fieldMap)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  /**
   * 解码响应体。
   * @param {NetworkResponse<any>} response 网络响应对象
   * @returns {string} 解码后的响应体字符串
   * @private
   */
  private decodeResponseBody(response: NetworkResponse<any>): string {
    let contentTypeHeader = response.headers['content-type'] || '';
    // 移除末尾多余的分号
    contentTypeHeader = contentTypeHeader.trim().replace(/;+$/, '');

    const ct = contentType.parse(contentTypeHeader);
    let encoding = ct.parameters.charset || this.charset;
    if (!encoding) encoding = chardet.detect(response.data);
    let str = iconv.decode(response.data, encoding || 'utf8');
    if (ct.type === 'text/html' && /<!doctype html>/i.test(str)) {
      str = load(str, null, true).html();
    }
    return str
  }

  /**
   * 执行 JS 代码。
   * @param {string} jsStr 要执行的 JS 代码
   * @param {any} [result] 传递给 JS 代码的参数
   * @returns {Promise<any>} 执行结果
   */
  public async evalJS(jsStr: string, result: any = null): Promise<any> {
    const context = await isolate.createContext();
    const bindings = context.global;
    await bindings.set('key', this.key);
    await bindings.set('page', this.page);
    await bindings.set('result', result);
    return context.eval(jsStr);
  }
}