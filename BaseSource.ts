import NodeCache from 'node-cache';
import crypto from 'crypto';
import vm from 'vm';
import CookieManager from './CookieManager'; // 假设CookieManager.ts与当前文件在同一个目录下

interface RowUi {
  // 定义RowUi的属性，根据实际情况填写
}

class BaseSource {
  private cache: NodeCache;
  private cookieManager: CookieManager;
  private secretKey: Buffer;

  constructor() {
    this.cache = new NodeCache();
    this.cookieManager = new CookieManager();
    this.secretKey = crypto.randomBytes(16); // 生成一个随机的密钥
  }

  getTag(): string {
    // 实现getTag方法
    return '';
  }

  getKey(): string {
    // 实现getKey方法
    return '';
  }

  getSource(): BaseSource | null {
    return this;
  }

  loginUi(): Array<RowUi> | null {
    const loginUi = this.loginUi;
    if (loginUi) {
      try {
        return JSON.parse(loginUi) as Array<RowUi>;
      } catch (error) {
        console.error('Error parsing login UI:', error);
        return null;
      }
    }
    return null;
  }

  getLoginJs(): string | null {
    const loginJs = this.loginUrl;
    if (loginJs) {
      if (loginJs.startsWith('@js:')) {
        return loginJs.substring(4);
      } else if (loginJs.startsWith('<js>')) {
        return loginJs.substring(4, loginJs.lastIndexOf('<'));
      } else {
        return loginJs;
      }
    }
    return null;
  }

  async login(): Promise<void> {
    const loginJs = this.getLoginJs();
    if (loginJs) {
      const js = `
        ${loginJs}
        if (typeof login === 'function') {
          login.apply(this);
        } else {
          throw new Error('Function login not implemented!!!');
        }
      `;
      await this.evalJS(js);
    }
  }

  getHeaderMap(hasLoginHeader: boolean): Map<string, string> {
    const headerMap = new Map<string, string>();

    if (this.header) {
      let parsedHeader = this.header;
      if (parsedHeader.startsWith('@js:')) {
        parsedHeader = this.evalJS(parsedHeader.substring(4)).toString();
      } else if (parsedHeader.startsWith('<js>')) {
        parsedHeader = this.evalJS(parsedHeader.substring(4, parsedHeader.lastIndexOf('<'))).toString();
      }
      try {
        const parsedMap = JSON.parse(parsedHeader) as Record<string, string>;
        Object.entries(parsedMap).forEach(([key, value]) => {
          headerMap.set(key, value);
        });
      } catch (error) {
        console.error('Error parsing header:', error);
      }
    }

    if (!headerMap.has('User-Agent')) {
      headerMap.set('User-Agent', 'Your User Agent');
    }

    if (hasLoginHeader) {
      const loginHeaderMap = this.getLoginHeaderMap();
      if (loginHeaderMap) {
        loginHeaderMap.forEach((value, key) => {
          headerMap.set(key, value);
        });
      }
    }

    return headerMap;
  }

  getLoginHeader(): string | null {
    return this.cache.get(`loginHeader_${this.getKey()}`) as string | null;
  }

  getLoginHeaderMap(): Map<string, string> | null {
    const cache = this.getLoginHeader();
    if (cache) {
      try {
        return new Map(JSON.parse(cache) as Record<string, string>);
      } catch (error) {
        console.error('Error parsing login header:', error);
      }
    }
    return null;
  }

  putLoginHeader(header: string): void {
    const headerMap = JSON.parse(header) as Record<string, string>;
    const cookie = headerMap['Cookie'] || headerMap['cookie'];
    if (cookie) {
      this.cookieManager.replaceCookie(this.getKey(), cookie);
    }
    this.cache.set(`loginHeader_${this.getKey()}`, header);
  }

  removeLoginHeader(): void {
    this.cache.del(`loginHeader_${this.getKey()}`);
    this.cookieManager.removeCookie(this.getKey());
  }

  getLoginInfo(): string | null {
    try {
      const key = Buffer.from('Your Secret Key').slice(0, 16);
      const cache = this.cache.get(`userInfo_${this.getKey()}`) as string | undefined;
      if (cache) {
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16));
        let decrypted = decipher.update(cache, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (error) {
      console.error('Error getting login info:', error);
    }
    return null;
  }

  getLoginInfoMap(): Map<string, string> | null {
    const loginInfo = this.getLoginInfo();
    if (loginInfo) {
      try {
        return new Map(JSON.parse(loginInfo) as Record<string, string>);
      } catch (error) {
        console.error('Error parsing login info:', error);
      }
    }
    return null;
  }

  putLoginInfo(info: string): boolean {
    try {
      const key = Buffer.from('Your Secret Key').slice(0, 16);
      const cipher = crypto.createCipheriv('aes-128-cbc', key, Buffer.alloc(16));
      let encrypted = cipher.update(info, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      this.cache.set(`userInfo_${this.getKey()}`, encrypted);
      return true;
    } catch (error) {
      console.error('Error putting login info:', error);
      return false;
    }
  }

  removeLoginInfo(): void {
    this.cache.del(`userInfo_${this.getKey()}`);
  }

  setVariable(variable: string | null): void {
    if (variable) {
      this.cache.set(`sourceVariable_${this.getKey()}`, variable);
    } else {
      this.cache.del(`sourceVariable_${this.getKey()}`);
    }
  }

  getVariable(): string {
    return this.cache.get(`sourceVariable_${this.getKey()}`) as string || '';
  }

  put(key: string, value: string): string {
    this.cache.set(`v_${this.getKey()}_${key}`, value);
    return value;
  }

  get(key: string): string {
    return this.cache.get(`v_${this.getKey()}_${key}`) as string || '';
  }

  async evalJS(jsStr: string, bindingsConfig: any = {}): Promise<any> {
    const sandbox: vm.Context = {
      ...bindingsConfig,
      java: this,
      source: this,
      baseUrl: this.getKey(),
      cookie: this.cookieManager,
      cache: this.cache,
    };
    const script = new vm.Script(jsStr);
    const context = vm.createContext(sandbox);
    return await script.runInContext(context);
  }

  getShareScope(): any {
    // 实现getShareScope方法
    return null;
  }
}

export default BaseSource;