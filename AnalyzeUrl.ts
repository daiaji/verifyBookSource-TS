import cheerio from 'cheerio';
import fetch from 'node-fetch';
import vm from 'vm';
import RuleAnalyzer from './RuleAnalyzer';

interface BaseSource {
  // Define the BaseSource interface here
}

interface RuleDataInterface {
  // Define the RuleDataInterface interface here
}

interface Book {
  // Define the Book interface here
}

interface BookChapter {
  // Define the BookChapter interface here
}

enum RequestMethod {
  GET = 'GET',
  POST = 'POST',
}

interface StrResponse {
  // Define the StrResponse interface here
}

class AnalyzeUrl {
  private static readonly paramPattern = /\s*,\s*(?=\{)/;
  private static readonly pagePattern = /<(.*?)>/;
  private static readonly concurrentRecordMap: Record<string, ConcurrentRecord> = {};

  public readonly ruleUrl: string;
  public readonly url: string;
  public body: string | null;
  public type: string | null;
  public readonly headerMap: Record<string, string>;
  private readonly urlNoQuery: string;
  private queryStr: string | null;
  private readonly fieldMap: Record<string, string>;
  private charset: string | null;
  private method: RequestMethod;
  private proxy: string | null;
  private retry: number;
  private readonly domain: string;
  public serverID: number | null;

  constructor(
    public readonly mUrl: string,
    public readonly key: string | null = null,
    public readonly page: number | null = null,
    public readonly speakText: string | null = null,
    public readonly speakSpeed: number | null = null,
    public baseUrl: string = '',
    private readonly source: BaseSource | null = null,
    private readonly ruleData: RuleDataInterface | null = null,
    private readonly chapter: BookChapter | null = null,
    private readonly headerMapF: Record<string, string> | null = null
  ) {
    this.ruleUrl = '';
    this.url = '';
    this.body = null;
    this.type = null;
    this.headerMap = {};
    this.urlNoQuery = '';
    this.queryStr = null;
    this.fieldMap = {};
    this.charset = null;
    this.method = RequestMethod.GET;
    this.proxy = null;
    this.retry = 0;
    this.domain = source?.getKey() || '';
    this.serverID = null;

    const urlMatcher = AnalyzeUrl.paramPattern.exec(baseUrl);
    if (urlMatcher) {
      baseUrl = baseUrl.substring(0, urlMatcher.index);
    }
    if (headerMapF || source?.getHeaderMap(true)) {
      const headerMap = headerMapF || source?.getHeaderMap(true);
      if (headerMap) {
        Object.entries(headerMap).forEach(([key, value]) => {
          this.headerMap[key] = value;
          if (key === 'proxy') {
            this.proxy = value;
            delete this.headerMap.proxy;
          }
        });
      }
    }
    this.initUrl();
  }

  private initUrl(): void {
    this.ruleUrl = this.mUrl;
    this.analyzeJs();
    this.replaceKeyPageJs();
    this.analyzeUrl();
  }

  private analyzeJs(): void {
    let start = 0;
    const jsMatcher = /<js>([\s\S]*?)<\/js>|<js\/>/g;
    let result = this.ruleUrl;
    let match;
    while ((match = jsMatcher.exec(this.ruleUrl))) {
      if (match.index > start) {
        const substring = this.ruleUrl.substring(start, match.index).trim();
        if (substring) {
          result = substring.replace('@result', result);
        }
      }
      const jsStr = match[1] || '';
      result = this.evalJS(jsStr, result)?.toString() || '';
      start = jsMatcher.lastIndex;
    }
    if (this.ruleUrl.length > start) {
      const substring = this.ruleUrl.substring(start).trim();
      if (substring) {
        result = substring.replace('@result', result);
      }
    }
    this.ruleUrl = result;
  }

  private replaceKeyPageJs(): void {
    if (this.ruleUrl.includes('{{') && this.ruleUrl.includes('}}')) {
      const analyze = new RuleAnalyzer(this.ruleUrl);
      const url = analyze.innerRule('{{', '}}', (it) => {
        const jsEval = this.evalJS(it);
        if (typeof jsEval === 'string') {
          return jsEval;
        } else if (typeof jsEval === 'number' && Number.isInteger(jsEval)) {
          return jsEval.toFixed(0);
        } else {
          return jsEval.toString();
        }
      });
      if (url) {
        this.ruleUrl = url;
      }
    }
    if (this.page) {
      const matcher = AnalyzeUrl.pagePattern;
      let match;
      while ((match = matcher.exec(this.ruleUrl))) {
        const pages = match[1].split(',');
        if (this.page < pages.length) {
          this.ruleUrl = this.ruleUrl.replace(match[0], pages[this.page - 1].trim());
        } else {
          this.ruleUrl = this.ruleUrl.replace(match[0], pages[pages.length - 1].trim());
        }
      }
    }
  }

  private analyzeUrl(): void {
    const urlMatcher = AnalyzeUrl.paramPattern.exec(this.ruleUrl);
    const urlNoOption = urlMatcher ? this.ruleUrl.substring(0, urlMatcher.index) : this.ruleUrl;
    this.url = this.getAbsoluteURL(this.baseUrl, urlNoOption);
    const baseUrl = this.getBaseUrl(this.url);
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
    if (urlNoOption.length !== this.ruleUrl.length) {
      const optionStr = this.ruleUrl.substring(urlMatcher!.index);
      const option = JSON.parse(optionStr) as UrlOption;
      if (option) {
        if (option.method) {
          this.method = option.method.toUpperCase() as RequestMethod;
        }
        if (option.headers) {
          Object.entries(option.headers).forEach(([key, value]) => {
            this.headerMap[key] = value.toString();
          });
        }
        if (option.body) {
          this.body = typeof option.body === 'string' ? option.body : JSON.stringify(option.body);
        }
        this.type = option.type || null;
        this.charset = option.charset || null;
        this.retry = option.retry || 0;
        if (option.js) {
          const jsResult = this.evalJS(option.js, this.url);
          if (typeof jsResult === 'string') {
            this.url = jsResult;
          }
        }
        this.serverID = option.serverID || null;
      }
    }
    this.urlNoQuery = this.url;
    if (this.method === RequestMethod.GET) {
      const pos = this.url.indexOf('?');
      if (pos !== -1) {
        this.analyzeFields(this.url.substring(pos + 1));
        this.urlNoQuery = this.url.substring(0, pos);
      }
    } else if (this.method === RequestMethod.POST && this.body) {
      if (!this.body.isJson() && !this.body.isXml() && !this.headerMap['Content-Type']) {
        this.analyzeFields(this.body);
      }
    }
  }

  private analyzeFields(fieldsTxt: string): void {
    this.queryStr = fieldsTxt;
    const queryS = fieldsTxt.split('&').filter((query) => !!query);
    for (const query of queryS) {
      const queryPair = query.split('=', 2).map((item) => item.trim());
      const key = queryPair[0];
      const value = queryPair[1] || '';
      if (!this.charset) {
        if (NetworkUtils.hasUrlEncoded(value)) {
          this.fieldMap[key] = value;
        } else {
          this.fieldMap[key] = encodeURIComponent(value);
        }
      } else if (this.charset === 'escape') {
        this.fieldMap[key] = EncoderUtils.escape(value);
      } else {
        this.fieldMap[key] = encodeURIComponent(value);
      }
    }
  }

  private evalJS(jsStr: string | undefined, result: any = null): any {
    const sandbox: Record<string, any> = {
      java: this,
      baseUrl: this.baseUrl,
      page: this.page,
      key: this.key,
      speakText: this.speakText,
      speakSpeed: this.speakSpeed,
      book: this.ruleData as Book | null,
      source: this.source,
      result,
    };
    const context = vm.createContext(sandbox);
    const script = new vm.Script(jsStr || '');
    script.runInContext(context);
    return context.result;
  }

  public put(key: string, value: string): string {
    if (this.chapter) {
      this.chapter.putVariable(key, value);
    } else if (this.ruleData) {
      this.ruleData.putVariable(key, value);
    }
    return value;
  }

  public get(key: string): string {
    switch (key) {
      case 'bookName':
        return (this.ruleData as Book)?.name || '';
      case 'title':
        return this.chapter?.title || '';
      default:
        return this.chapter?.getVariable(key) || this.ruleData?.getVariable(key) || '';
    }
  }

  public async getStrResponseAwait(jsStr?: string, sourceRegex?: string): Promise<StrResponse> {
    if (this.type) {
      return {
        url: this.url,
        body: Buffer.from(await this.getByteArrayAwait()).toString('hex'),
      };
    }
    const strResponse = await this.getProxyClient(this.proxy).newCallStrResponse(this.retry, (request) => {
      Object.entries(this.headerMap).forEach(([key, value]) => {
        request.headers.append(key, value);
      });
      switch (this.method) {
        case RequestMethod.POST:
          request.method = 'POST';
          if (this.fieldMap || !this.body) {
            request.body = new URLSearchParams(this.fieldMap);
          } else if (request.headers.get('Content-Type')) {
            request.body = this.body;
          } else {
            request.body = JSON.stringify(this.body);
          }
          break;
        default:
          request.method = 'GET';
          request.url = new URL(this.urlNoQuery);
          Object.entries(this.fieldMap).forEach(([key, value]) => {
            request.url.searchParams.append(key, value);
          });
          break;
      }
    });
    return strResponse;
  }

  public async getStrResponse(jsStr?: string, sourceRegex?: string): Promise<StrResponse> {
    return this.getStrResponseAwait(jsStr, sourceRegex);
  }

  public async getResponseAwait(): Promise<Response> {
    return this.getProxyClient(this.proxy).newCallResponse(this.retry, (request) => {
      Object.entries(this.headerMap).forEach(([key, value]) => {
        request.headers.append(key, value);
      });
      switch (this.method) {
        case RequestMethod.POST:
          request.method = 'POST';
          if (this.fieldMap || !this.body) {
            request.body = new URLSearchParams(this.fieldMap);
          } else if (request.headers.get('Content-Type')) {
            request.body = this.body;
          } else {
            request.body = JSON.stringify(this.body);
          }
          break;
        default:
          request.method = 'GET';
          request.url = new URL(this.urlNoQuery);
          Object.entries(this.fieldMap).forEach(([key, value]) => {
            request.url.searchParams.append(key, value);
          });
          break;
      }
    });
  }

  public async getResponse(): Promise<Response> {
    return this.getResponseAwait();
  }

  private getByteArrayIfDataUri(): Buffer | null {
    const dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
    const match = dataUriRegex.exec(this.urlNoQuery);
    if (match) {
      const [, mimeType, isBase64, data] = match;
      if (isBase64) {
        return Buffer.from(data, 'base64');
      }
    }
    return null;
  }

  public async getByteArrayAwait(): Promise<Buffer> {
    const byteArray = this.getByteArrayIfDataUri();
    if (byteArray) {
      return byteArray;
    }
    const response = await this.getResponseAwait();
    return await response.buffer();
  }

  public async getByteArray(): Promise<Buffer> {
    return this.getByteArrayAwait();
  }

  public async getInputStreamAwait(): Promise<NodeJS.ReadableStream> {
    const byteArray = this.getByteArrayIfDataUri();
    if (byteArray) {
      return byteArray;
    }
    const response = await this.getResponseAwait();
    return response.body;
  }

  public async getInputStream(): Promise<NodeJS.ReadableStream> {
    return this.getInputStreamAwait();
  }

  public async upload(fileName: string, file: any, contentType: string): Promise<StrResponse> {
    const response = await this.getProxyClient(this.proxy).newCallStrResponse(this.retry, (request) => {
      request.method = 'POST';
      request.url = new URL(this.urlNoQuery);
      const bodyMap = JSON.parse(this.body || '{}');
      Object.entries(bodyMap).forEach(([key, value]) => {
        if (value === 'fileRequest') {
          bodyMap[key] = {
            fileName,
            file,
            contentType,
          };
        }
      });
      request.body = JSON.stringify(bodyMap);
    });
    return response;
  }

  public getGlideUrl(): string {
    return this.url;
  }

  public getUserAgent(): string {
    return this.headerMap['User-Agent'] || '';
  }

  public isPost(): boolean {
    return this.method === RequestMethod.POST;
  }

  public getSource(): BaseSource | null {
    return this.source;
  }

  private getAbsoluteURL(baseUrl: string, url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    if (url.startsWith('/')) {
      const pos = baseUrl.indexOf('/', 8);
      if (pos !== -1) {
        baseUrl = baseUrl.substring(0, pos);
      }
      return `${baseUrl}${url}`;
    }
    const pos = baseUrl.lastIndexOf('/');
    if (pos !== -1) {
      baseUrl = baseUrl.substring(0, pos + 1);
    }
    return `${baseUrl}${url}`;
  }

  private getBaseUrl(url: string): string | null {
    const match = /^(https?:\/\/[^/]+)/.exec(url);
    return match ? match[1] : null;
  }

  private getProxyClient(proxy: string | null): any {
    // Implement the logic to create and configure the proxy client here
  }
}

class NetworkUtils {
  // Define the NetworkUtils class here
}

class EncoderUtils {
  // Define the EncoderUtils class here
}

class GSON {
  // Define the GSON class here
}

class UrlOption {
  // Define the UrlOption class here
}

class ConcurrentRecord {
  // Define the ConcurrentRecord class here
}
