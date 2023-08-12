// CookieStore.ts
import CookieManagerInterface from './CookieManagerInterface';
import { parse as parseUrl } from 'url';
import { CacheManager } from './CacheManager';
import CookieManager from './CookieManager';

class CookieStore implements CookieManagerInterface {
  /**
   * 保存cookie到数据库，会自动识别url的二级域名
   */
  public setCookie(url: string, cookie: string | null): void {
    const domain = parseUrl(url).hostname!;
    CacheManager.putMemory(`${domain}_cookie`, cookie || '');
    const cookieBean = { domain, cookie: cookie || '' };
    // Insert cookieBean into database
  }

  public replaceCookie(url: string, cookie: string): void {
    if (!url || !cookie) {
      return;
    }
    const oldCookie = this.getCookieNoSession(url);
    if (!oldCookie) {
      this.setCookie(url, cookie);
    } else {
      const cookieMap = this.cookieToMap(oldCookie);
      const newCookieMap = this.cookieToMap(cookie);
      Object.assign(cookieMap, newCookieMap);
      const newCookie = this.mapToCookie(cookieMap);
      this.setCookie(url, newCookie);
    }
  }

  /**
   * 获取url所属的二级域名的cookie
   */
  public getCookie(url: string): string {
    const domain = parseUrl(url).hostname!;

    const cookie = this.getCookieNoSession(url);
    const sessionCookie = this.getSessionCookie(domain);

    const cookieMap = this.mergeCookiesToMap(cookie, sessionCookie);

    let ck = this.mapToCookie(cookieMap) || '';
    while (ck.length > 4096) {
      const removeKey = Object.keys(cookieMap)[Math.floor(Math.random() * Object.keys(cookieMap).length)];
      this.removeCookie(url, removeKey);
      delete cookieMap[removeKey];
      ck = this.mapToCookie(cookieMap) || '';
    }
    return ck;
  }

  public getKey(url: string, key: string): string {
    const cookie = this.getCookie(url);
    const sessionCookie = this.getSessionCookie(url);
    const cookieMap = this.mergeCookiesToMap(cookie, sessionCookie);
    return cookieMap[key] || '';
  }

  public removeCookie(url: string, key?: string): void {
    const domain = parseUrl(url).hostname!;

    const sessionCookieMap = this.getSessionCookieMap(domain);
    if (sessionCookieMap && key) {
      delete sessionCookieMap[key];
      const cookie = this.mapToCookie(sessionCookieMap);
      if (cookie) {
        CacheManager.putMemory(`${domain}_session_cookie`, cookie);
      }
    }

    const cookie = this.getCookieNoSession(url);
    if (cookie) {
      const cookieMap = this.cookieToMap(cookie);
      if (key) {
        delete cookieMap[key];
      }
      const newCookie = this.mapToCookie(cookieMap);
      if (newCookie) {
        this.setCookie(url, newCookie);
      }
    }
  }

  private getSessionCookie(domain: string): string | undefined {
    const cookieManager = new CookieManager();
    return cookieManager.getSessionCookie(domain);
  }

  private getSessionCookieMap(domain: string): { [key: string]: string } | null {
    const cookieManager = new CookieManager();
    const sessionCookie = cookieManager.getSessionCookie(domain);
    if (sessionCookie) {
      return cookieManager.cookieToMap(sessionCookie);
    }
    return null;
  }

  private getCookieNoSession(url: string): string {
    const domain = parseUrl(url).hostname!;
    const cacheCookie = CacheManager.getFromMemory(`${domain}_cookie`);

    return cacheCookie || '';
  }

  public cookieToMap(cookie: string): { [key: string]: string } {
    return cookie
      .split(';')
      .map((pair) => pair.trim().split('='))
      .reduce((acc, [key, value]) => {
        if (value.trim() !== '' || value.trim() === 'null') {
          acc[key] = value.trim();
        }
        return acc;
      }, {} as { [key: string]: string });
  }

  private mergeCookiesToMap(...cookies: (string | undefined)[]): { [key: string]: string } {
    const cookieManager = new CookieManager();
    return cookieManager.mergeCookiesToMap(...cookies);
  }

  public mapToCookie(cookieMap: { [key: string]: string } | null): string | null {
    const cookieManager = new CookieManager();
    return cookieManager.mapToCookie(cookieMap);
  }
}

export default CookieStore;
