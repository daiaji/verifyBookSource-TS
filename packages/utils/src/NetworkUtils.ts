import logger from './logger';

export class NetworkUtils {
    // 使用 Set 提高查找效率
    private static readonly NOT_NEED_ENCODING: Set<number> = new Set(
        [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-_.~$:()!*@&#,[]'].map(c => c.charCodeAt(0))
    );
    private static readonly DATA_URI_REGEX: RegExp = /^data:.*?;base64,(.*)$/;
    private static readonly ABS_URL_REGEX = /^(http|https):\/\/.+/;

    /**
     * 获取绝对地址 (合并 getAbsoluteURL 和 getAbsoluteURL2)
     * @param baseURL 基础 URL, 可以是字符串或 URL 对象
     * @param relativePath 相对路径
     * @returns 绝对 URL
     */
    static getAbsoluteURL(baseURL: string | URL | null | undefined, relativePath: string): string {
        const relativePathTrim = relativePath.trim();

        // 优先处理特殊情况
        if (!baseURL || baseURL === '') return relativePathTrim;
        if (NetworkUtils.isAbsUrl(relativePathTrim)) return relativePathTrim;
        if (NetworkUtils.isDataUrl(relativePathTrim)) return relativePathTrim;
        if (relativePathTrim.startsWith('javascript')) return '';

        try {
            // 统一使用 URL 对象处理
            const base = typeof baseURL === 'string' ? new URL(baseURL.split(',')[0].trim()) : baseURL;
            // 兼容传入 null 的情况
            return new URL(relativePathTrim, base || undefined).toString();
        } catch (e: any) {
            logger.error("[NetworkUtils2] 网址拼接出错:", { baseURL, relativePath, error: e, stack: e.stack }); //添加 [NetworkUtils2]
            return relativePathTrim; // 出错时返回原始的相对路径
        }
    }

    static getBaseUrl(url: string | null): string | null {
        if (!url) return null;

        const lowerCaseUrl = url.toLowerCase();
        if (lowerCaseUrl.startsWith('http://') || lowerCaseUrl.startsWith('https://')) {
            const index = url.indexOf('/', 9); // 从第9个字符开始找，兼容 "http://a/" 这种
            return index === -1 ? url : url.substring(0, index);
        }

        return null;
    }

    /**
     * 检查字符串是否需要 URL 编码。
     * @param str 要检查的字符串
     * @returns 如果字符串不需要 URL 编码，则返回 true；否则返回 false。
     */
    static isFullyUrlEncoded(str: string): boolean {
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);

            if (!NetworkUtils.NOT_NEED_ENCODING.has(charCode)) {
                // 检查是否为 URL 编码的格式
                if (str[i] === '%' && i + 2 < str.length &&
                    NetworkUtils.isDigit16Char(str[i + 1]) &&
                    NetworkUtils.isDigit16Char(str[i + 2])) {
                    i += 2; // 跳过已编码的部分
                } else {
                    return false; // 发现需要编码的字符
                }
            }
        }
        return true; // 所有字符都不需要编码
    }

    /**
     * 判断 c 是否是 16 进制的字符
     */
    private static isDigit16Char(c: string): boolean {
        return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
    }

    private static isAbsUrl(url: string): boolean {
        return NetworkUtils.ABS_URL_REGEX.test(url);
    }

    private static isDataUrl(str: string | null): boolean {
        return str !== null && NetworkUtils.DATA_URI_REGEX.test(str);
    }
}