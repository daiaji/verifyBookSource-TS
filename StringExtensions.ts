/**
 * 安全地去除字符串两端的空白字符
 * @param str 要处理的字符串
 * @returns 处理后的字符串，如果原字符串为null或空白字符，则返回null
 */
export function safeTrim(str: string | null | undefined): string | null {
  if (str == null || str.trim() === '') {
    return null;
  }
  return str.trim();
}

/**
 * 判断字符串是否为绝对URL
 * @param str 要判断的字符串
 * @returns 如果字符串为绝对URL，则返回true，否则返回false
 */
export function isAbsUrl(str: string | null | undefined): boolean {
  if (str == null) {
    return false;
  }
  return str.startsWith('http://', 0) || str.startsWith('https://', 0);
}

/**
 * 判断字符串是否为JSON格式
 * @param str 要判断的字符串
 * @returns 如果字符串为JSON格式，则返回true，否则返回false
 */
export function isJson(str: string | null | undefined): boolean {
  if (str == null) {
    return false;
  }
  try {
    JSON.parse(str.trim());
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 判断字符串是否为JSON对象
 * @param str 要判断的字符串
 * @returns 如果字符串为JSON对象，则返回true，否则返回false
 */
export function isJsonObject(str: string | null | undefined): boolean {
  if (str == null) {
    return false;
  }
  try {
    const json = JSON.parse(str.trim());
    return typeof json === 'object' && !Array.isArray(json);
  } catch (e) {
    return false;
  }
}

/**
 * 判断字符串是否为JSON数组
 * @param str 要判断的字符串
 * @returns 如果字符串为JSON数组，则返回true，否则返回false
 */
export function isJsonArray(str: string | null | undefined): boolean {
  if (str == null) {
    return false;
  }
  try {
    const json = JSON.parse(str.trim());
    return Array.isArray(json);
  } catch (e) {
    return false;
  }
}

/**
 * 判断字符串是否为XML格式
 * @param str 要判断的字符串
 * @returns 如果字符串为XML格式，则返回true，否则返回false
 */
export function isXml(str: string | null | undefined): boolean {
  if (str == null) {
    return false;
  }
  const xmlRegex = /^<[\s\S]+>$/;
  return xmlRegex.test(str.trim());
}

/**
 * 判断字符串是否为真值
 * @param str 要判断的字符串
 * @param nullIsTrue 当字符串为null或空白字符时，是否视为真值，默认为false
 * @returns 如果字符串为真值，则返回true，否则返回false
 */
export function isTrue(str: string | null | undefined, nullIsTrue: boolean = false): boolean {
  if (str == null || str.trim() === 'null') {
    return nullIsTrue;
  }
  const falseValues = ['false', 'no', 'not', '0'];
  return !falseValues.includes(str.trim().toLowerCase());
}

/**
 * 将字符串按指定的分隔符拆分为非空字符串数组
 * @param str 要拆分的字符串
 * @param delimiter 分隔符，可以是字符串或正则表达式
 * @param limit 限制拆分的次数，默认为0，表示不限制
 * @returns 非空字符串数组
 */
export function splitNotBlank(str: string, delimiter: string | RegExp, limit: number = 0): string[] {
  return str.split(delimiter, limit)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * 比较两个字符串的中文排序顺序
 * @param str1 第一个字符串
 * @param str2 第二个字符串
 * @returns 如果str1小于str2，返回负数；如果str1等于str2，返回0；如果str1大于str2，返回正数
 */
export function cnCompare(str1: string, str2: string): number {
  return str1.localeCompare(str2, 'zh-CN');
}

/**
 * 计算字符串占用的内存大小
 * @param str 要计算的字符串
 * @returns 字符串占用的内存大小
 */
export function memorySize(str: string | null | undefined): number {
  if (str == null) {
    return 0;
  }
  return 40 + 2 * str.length;
}

/**
 * 判断字符串是否包含中文字符
 * @param str 要判断的字符串
 * @returns 如果字符串包含中文字符，则返回true，否则返回false
 */
export function isChinese(str: string): boolean {
  const chineseRegex = /[\u4e00-\u9fa5]/;
  return chineseRegex.test(str);
}

/**
 * 将字符串拆分为单个字符数组，包括表情符号
 * @param str 要拆分的字符串
 * @returns 单个字符数组
 */
export function toStringArray(str: string): string[] {
  const codePoints: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i);
    if (codePoint !== undefined) {
      codePoints.push(String.fromCodePoint(codePoint));
      if (codePoint > 0xffff) {
        i++;
      }
    }
  }
  return codePoints;
}

/**
 * 转义字符串中的正则表达式特殊字符
 * @param str 要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeRegex(str: string): string {
  const regexCharRegex = /[-/\\^$*+?.()|[\]{}]/g;
  return str.replace(regexCharRegex, '\\$&');
}
