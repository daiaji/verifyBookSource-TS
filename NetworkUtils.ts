class NetworkUtils {
    private static readonly notNeedEncoding: Set<number> = new Set([
      ...Array.from({ length: 10 }, (_, i) => i + '0'.charCodeAt(0)), // 0-9
      ...Array.from({ length: 26 }, (_, i) => i + 'a'.charCodeAt(0)), // a-z
      ...Array.from({ length: 26 }, (_, i) => i + 'A'.charCodeAt(0)), // A-Z
      '+'.charCodeAt(0),
      '-'.charCodeAt(0),
      '_'.charCodeAt(0),
      '.'.charCodeAt(0),
      '$'.charCodeAt(0),
      ':'.charCodeAt(0),
      '('.charCodeAt(0),
      ')'.charCodeAt(0),
      '*'.charCodeAt(0),
      '@'.charCodeAt(0),
      '&'.charCodeAt(0),
      '#'.charCodeAt(0),
      ','.charCodeAt(0),
      '['.charCodeAt(0),
      ']'.charCodeAt(0),
    ]);

    public static hasUrlEncoded(str: string): boolean {
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (this.notNeedEncoding.has(c.charCodeAt(0))) {
          continue;
        }
        if (c === '%' && i + 2 < str.length) {
          const c1 = str[++i];
          const c2 = str[++i];
          if (/^[0-9A-Fa-f]+$/.test(c1 + c2)) {
            continue;
          }
        }
        return false;
      }
      return true;
    }

    public static getAbsoluteURL(baseURL: URL | null, relativePath: string): string {
      const relativePathTrim = relativePath.trim();
      if (!baseURL) {
        return relativePathTrim;
      }
      if (this.isAbsUrl(relativePathTrim)) {
        return relativePathTrim;
      }
      if (this.isDataUrl(relativePathTrim)) {
        return relativePathTrim;
      }
      if (relativePathTrim.startsWith('javascript')) {
        return '';
      }
      let relativeUrl = relativePathTrim;
      try {
        const parseUrl = new URL(relativePath, baseURL);
        relativeUrl = parseUrl.toString();
        return relativeUrl;
      } catch (e) {
        console.error(`网址拼接出错\n${(e as Error).message}`);
      }
      return relativeUrl;
    }

    public static getBaseUrl(url: string | null): string | null {
      if (!url) {
        return null;
      }
      if (url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://')) {
        const index = url.indexOf('/', 9);
        if (index === -1) {
          return url;
        } else {
          return url.substring(0, index);
        }
      }
      return null;
    }

    public static getSubDomain(url: string): string {
      const baseUrl = this.getBaseUrl(url);
      if (!baseUrl) {
        return url;
      }
      try {
        const mURL = new URL(baseUrl);
        const host = mURL.host;
        if (this.isIPAddress(host)) {
          return host;
        }
        return host.split('.').slice(-2).join('.');
      } catch (e) {
        console.error(`获取域名出错\n${(e as Error).message}`);
      }
      return baseUrl;
    }

    private static isIPv4Address(input: string | null): boolean {
      if (!input) {
        return false;
      }
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      return ipv4Regex.test(input);
    }

    private static isIPv6Address(input: string | null): boolean {
      if (!input) {
        return false;
      }
      const ipv6Regex = /^([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}$/;
      return ipv6Regex.test(input);
    }

    public static isIPAddress(input: string | null): boolean {
      return this.isIPv4Address(input) || this.isIPv6Address(input);
    }

    private static isAbsUrl(url: string): boolean {
      return /^https?:\/\//i.test(url);
    }

    private static isDataUrl(url: string): boolean {
      return /^data:/i.test(url);
    }
  }

export default NetworkUtils;