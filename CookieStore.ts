import { CookieJar } from 'tough-cookie';
import { parse as parseUrl } from 'url';

class CookieStore {
  private cookieJar: CookieJar;
  private cache: Map<string, string>;

  constructor() {
    this.cookieJar = new CookieJar();
    this.cache = new Map<string, string>();
  }

  private getDomain(url: string) {
    const parsedUrl = parseUrl(url);
    return parsedUrl.hostname || '';
  }

  public saveResponse(url: string, setCookieHeader: string): void {
    const domain = this.getDomain(url);
    this.cache.set(`${domain}_cookie`, setCookieHeader);
    this.cookieJar.setCookie(setCookieHeader, url, (error, cookie) => {
      if (error) {
        console.error(error);
      }
    });
  }

  public loadRequest(url: string): string {
    const domain = this.getDomain(url);
    const cookies = this.cookieJar.getCookiesSync(url);
    const sessionCookie = this.getSessionCookie(domain);
    const mergedCookies = this.mergeCookies(cookies, sessionCookie);
    const cleanedCookies = this.cleanCookies(mergedCookies);
    const cookieString = this.cookiesToString(cleanedCookies);
    return cookieString || '';
  }

  public getSessionCookie(domain: string): string | undefined {
    const cookies = this.cookieJar.getCookiesSync(domain);
    const sessionCookies = cookies.filter((cookie) => !cookie.expires);
    return sessionCookies.length > 0 ? sessionCookies[0].toString() : undefined;
  }

  public setCookie(url: string, cookie: string): void {
    const domain = this.getDomain(url);
    this.cache.set(`${domain}_cookie`, cookie);
    this.cookieJar.setCookie(cookie, url, (error, cookie) => {
      if (error) {
        console.error(error);
      }
    });
  }

  public replaceCookie(url: string, cookie: string): void {
    const domain = this.getDomain(url);
    const oldCookie = this.getCookieNoSession(url);
    if (!oldCookie) {
      this.setCookie(url, cookie);
    } else {
      const cookieMap = this.cookieToMap(oldCookie);
      Object.assign(cookieMap, this.cookieToMap(cookie));
      const newCookie = this.mapToCookie(cookieMap);
      this.setCookie(url, newCookie);
    }
  }

  public getCookie(url: string): string {
    const domain = this.getDomain(url);
    const cookies = this.cookieJar.getCookiesSync(url);
    const sessionCookie = this.getSessionCookie(domain);
    const mergedCookies = this.mergeCookies(cookies, sessionCookie);
    const cleanedCookies = this.cleanCookies(mergedCookies);
    const cookieString = this.cookiesToString(cleanedCookies);
    return cookieString || '';
  }

  public removeCookie(url: string): void {
    const domain = this.getDomain(url);
    this.cache.delete(`${domain}_cookie`);
    this.cache.delete(`${domain}_session_cookie`);
    this.cookieJar.removeCookieSync(url, { path: '/' });
  }

  private mergeCookies(cookies: any[], sessionCookie: string | undefined): any[] {
    const mergedCookies = [...cookies];
    if (sessionCookie) {
      const sessionCookieObj = this.cookieJar.setCookieSync(sessionCookie, 'http://dummy');
      mergedCookies.push(sessionCookieObj);
    }
    return mergedCookies;
  }

  private cleanCookies(cookies: any[]): any[] {
    let cleanedCookies = [...cookies];
    let cookieString = this.cookiesToString(cleanedCookies);
    while (cookieString.length > 4096) {
      const randomIndex = Math.floor(Math.random() * cleanedCookies.length);
      cleanedCookies.splice(randomIndex, 1);
      cookieString = this.cookiesToString(cleanedCookies);
    }
    return cleanedCookies;
  }

  private cookiesToString(cookies: any[]): string {
    return cookies.map((cookie) => cookie.toString()).join('; ');
  }
}

export default CookieStore;
