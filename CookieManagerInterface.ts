// CookieManagerInterface.ts
interface CookieManagerInterface {
  setCookie(url: string, cookie: string | null): Promise<void>;
  replaceCookie(url: string, cookie: string): Promise<void>;
  getCookie(url: string): Promise<string>;
  removeCookie(url: string): Promise<void>;
}

export default CookieManagerInterface;