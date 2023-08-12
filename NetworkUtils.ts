import URLParse from 'url-parse';
import querystring from 'querystring';
import psl, { ParsedDomain } from 'psl';
import { Address4, Address6 } from 'ip-address';

class NetworkUtils {
  /**
   * 检查字符串是否已被URL编码
   * @param str 要检查的字符串
   * @returns 如果字符串已被URL编码，则返回true
   */
  public static hasUrlEncoded(str: string): boolean {
    return str === querystring.escape(str);
  }

  /**
   * 获取绝对URL
   * @param baseURL 基础URL
   * @param relativePath 相对路径
   * @returns 绝对URL
   * @throws 当URL拼接出错时抛出错误
   */
  public static getAbsoluteURL(baseURL: string | null, relativePath: string): string;
  public static getAbsoluteURL(baseURL: URL | null, relativePath: string): string;
  public static getAbsoluteURL(baseURL: string | URL | null, relativePath: string): string {
    let absoluteUrl: URL | null = null;
    if (typeof baseURL === 'string') {
      if (baseURL.trim() === '') {
        return relativePath.trim();
      }
      try {
        absoluteUrl = new URL(baseURL);
      } catch (e) {
        throw new Error(`URL解析出错\n${(e as Error).message}`);
      }
    } else if (baseURL instanceof URL) {
      absoluteUrl = baseURL;
    } else {
      return relativePath.trim();
    }

    const relativePathTrim = relativePath.trim();
    if (this.isAbsUrl(relativePathTrim) || this.isDataUrl(relativePathTrim)) {
      return relativePathTrim;
    }
    if (relativePathTrim.startsWith('javascript') || relativePathTrim.startsWith('mailto:') || relativePathTrim.startsWith('tel:')) {
      return '';
    }
    try {
      const parseUrl = new URL(relativePath, absoluteUrl.toString());
      return parseUrl.toString();
    } catch (e) {
      throw new Error(`网址拼接出错\n${(e as Error).message}`);
    }
  }

  /**
   * 获取基础URL
   * @param url URL
   * @returns 基础URL
   * @throws 当获取基础URL出错时抛出错误
   */
  public static getBaseUrl(url: string | null): string | null {
    if (!url || !url.trim()) {
      return null;
    }
    try {
      const parsedUrl = new URLParse(url);
      return parsedUrl.origin;
    } catch (e) {
      throw new Error(`获取基础URL出错\n${(e as Error).message}`);
    }
  }

  /**
   * 获取域名
   * @param url URL
   * @returns 域名
   * @throws 当获取域名出错时抛出错误
   */
  public static getDomain(url: string): string | null {
    const baseUrl = this.getBaseUrl(url);
    if (!baseUrl) {
      return url;
    }
    try {
      const mURL = new URLParse(baseUrl);
      const host = mURL.host;
      if (this.isIPAddress(host)) {
        return host;
      }
      const parsed = psl.parse(host);
      if ('domain' in parsed) {
        return (parsed as ParsedDomain).domain;
      } else {
        throw new Error(`解析域名出错：${parsed}`);
      }
    } catch (e) {
      throw new Error(`获取域名出错\n${(e as Error).message}`);
    }
  }

  /**
   * 检查输入是否为IP地址
   * @param input 输入
   * @returns 如果输入是IP地址，则返回true
   */
  public static isIPAddress(input: string | null): boolean {
    return input != null && (Address4.isValid(input) || Address6.isValid(input));
  }

  private static isAbsUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private static isDataUrl(url: string): boolean {
    return /^data:/i.test(url);
  }
}

export default NetworkUtils;
