import { promisify } from 'util';
import { CookieJar, MemoryCookieStore, Cookie } from 'tough-cookie';
import CookieManagerInterface from './CookieManagerInterface';
import NetworkUtils from './NetworkUtils';

/**
 * CookieManager类实现了CookieManagerInterface接口，提供了对cookie的管理功能
 */
class CookieManager implements CookieManagerInterface {
  private cookieJar: CookieJar;
  private cookieStore: MemoryCookieStore;
  private setCookiePromise: (cookie: string, domain: string) => Promise<Cookie>;
  private removeCookiesPromise: (domain: string, path: string) => Promise<void>;
  private getCookieStringPromise: (domain: string) => Promise<string>;

  constructor() {
    this.cookieStore = new MemoryCookieStore();
    this.cookieJar = new CookieJar(this.cookieStore, { rejectPublicSuffixes: false });

    // 转换为 Promise 方法
    this.setCookiePromise = promisify(this.cookieJar.setCookie.bind(this.cookieJar));
    this.removeCookiesPromise = promisify(this.cookieStore.removeCookies.bind(this.cookieStore));
    this.getCookieStringPromise = promisify(this.cookieJar.getCookieString.bind(this.cookieJar));
  }

  /**
   * 设置cookie
   * @param url URL
   * @param cookie cookie字符串
   * @throws 当无法获取域名或cookie为空时抛出错误
   */
  async setCookie(url: string, cookie: string | null): Promise<void> {
    const domain = NetworkUtils.getDomain(url);
    if (domain && cookie) {
      await this.setCookiePromise(cookie, domain);
    } else {
      throw new Error(`设置cookie出错：无法获取域名或cookie为空`);
    }
  }

  /**
   * 替换cookie
   * @param url URL
   * @param cookie 新的cookie字符串
   * @throws 当无法获取域名时抛出错误
   */
  async replaceCookie(url: string, cookie: string): Promise<void> {
    const domain = NetworkUtils.getDomain(url);
    if (domain) {
      await this.removeCookiesPromise(domain, '');
      await this.setCookie(url, cookie);
    } else {
      throw new Error(`替换cookie出错：无法获取域名`);
    }
  }

  /**
   * 获取cookie
   * @param url URL
   * @returns cookie字符串
   * @throws 当无法获取域名时抛出错误
   */
  async getCookie(url: string): Promise<string> {
    const domain = NetworkUtils.getDomain(url);
    if (domain) {
      return await this.getCookieStringPromise(domain);
    } else {
      throw new Error(`获取cookie出错：无法获取域名`);
    }
  }

  /**
   * 移除cookie
   * @param url URL
   * @throws 当无法获取域名时抛出错误
   */
  async removeCookie(url: string): Promise<void> {
    const domain = NetworkUtils.getDomain(url);
    if (domain) {
      await this.removeCookiesPromise(domain, '');
    } else {
      throw new Error(`移除cookie出错：无法获取域名`);
    }
  }
}

export default CookieManager;