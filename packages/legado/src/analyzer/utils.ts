import { logger } from '@any-reader/utils'; // 导入 logger
import { Elements } from '../javascript/jsoup/Elements';
import { Element } from '../javascript/jsoup/Element';
import { Jsoup } from '../javascript/jsoup/Jsoup';

/**
 * 安全地将任意值转换为字符串，处理 null 和 undefined。
 * @param value 要转换的值
 * @returns 字符串表示形式，如果值为 null 或 undefined，则返回空字符串
 */
export function safeString(value: any): string {
  return value == null ? '' : (typeof value === 'string' ? value : String(value));
}

/**
 * 检查字符串是否为 JSON 格式。
 * @param {string | null} text 要检查的字符串
 * @returns {boolean} 如果是 JSON 格式，则返回 true；否则返回 false
 */
export function isJson(text: string | null): boolean {
  if (!text) {
    return false;
  }
  const str = safeString(text).trim();  // 使用 safeString
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 检查字符串是否为 XML 格式。
 * @param {string | null} text 要检查的字符串
 * @returns {boolean} 如果是 XML 格式，则返回 true；否则返回 false
 */
export function isXml(text: string | null): boolean {
  if (!text) {
    return false;
  }
  const str = safeString(text).trim();
  return str.startsWith('<') && str.endsWith('>');
}

/**
 * 检查值是否为显式对象 (即由 Object 构造函数创建的对象)。
 * @param value 要检查的值
 * @returns 如果值是显式对象，则返回 true；否则返回 false。
 */
export function isExplicitObject(value: any): value is object {
  return typeof value === 'object' && value !== null && value.constructor === Object;
}

/**
 * 解析 JSON 字符串，并捕获可能的异常。
 * @param jsonString 要解析的 JSON 字符串
 * @returns 解析后的对象，如果解析失败则返回 null
 */
export function parseJson<T>(jsonString: string): T | null {
  return parseSafely<T>(
    () => JSON.parse(jsonString) as T,
    'JSON 解析错误:',
    { jsonString }
  );
}

/**
 * 使用指定的分隔符连接字符串数组，忽略空字符串、null 和 undefined。
 * @param separator 分隔符
 * @param strings 字符串数组
 * @returns 连接后的字符串
 */
export function joinNonEmpty(separator: string, strings: (string | null | undefined)[]): string {
  return strings.filter(str => str != null && str !== '').join(separator);
}

/**
 * 将字符串按行分割，处理不同平台的换行符 (\n, \r\n, \r)。
 * @param text 要分割的字符串
 * @returns 分割后的字符串数组
 */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/**
 * 安全地执行解析操作，捕获异常并记录日志。
 * @param parser 一个无参数的函数，执行实际的解析操作
 * @param errorMessage 错误消息的前缀
 * @param context 可选的上下文对象，用于记录更详细的日志
 * @returns 解析成功则返回解析结果，失败则返回 null
 */
export function parseSafely<T>(parser: () => T, errorMessage: string, context?: any): T | null {
  try {
    return parser();
  } catch (e: any) {
    logger.error(errorMessage, { ...context, error: e.message, stack: e.stack });
    return null;
  }
}

/**
 * 统一的错误处理函数
 * @param errorMessage 错误信息
 * @param context 错误发生的上下文
 * @param returnValue 出现错误后的返回值
 */
export function handleError<T>(errorMessage: string, context?: any, returnValue?: T): T {
  logger.error(errorMessage, { ...context, stack: context?.error?.stack });
  return returnValue as T;
}

/**
 * 确保输入为 Elements 对象，如果不是则尝试解析。
 * @param doc 输入值
 * @returns Elements 对象，如果输入无效则返回 null
 */
export function ensureElements(doc: any): Elements | null {
  if (doc instanceof Elements) {
    return doc;
  }
  if (doc instanceof Element) {
    return new Elements(doc);
  }
  if (typeof doc === 'string') {
    const parsed = parseSafely(
      () => Jsoup.parse(doc),
      'HTML 解析失败 (ensureElements):',
      { doc }
    );
    return parsed instanceof Elements ? parsed : (parsed ? new Elements(parsed) : null);
  }

  logger.warn('ensureElements: Input is null, undefined, or cannot be converted to a string or Elements.');
  return null;
}

/**
* 检查输入是否为 Element 对象。
* @param value 要检查的值
* @returns 如果值是 Element 对象，则返回 true；否则返回 false。
*/
export function isElement(value: any): value is Element {
  return value instanceof Element;
}

/**
 * 从 Elements 中获取指定属性的值列表。
 * @param elements Elements 对象
 * @param attrName 属性名称
 * @returns 属性值列表
 */
export function getAttributes(elements: Elements | null, attrName: string): string[] {
  if (!elements) return [];
  const result: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const attrValue = elements[i].attr(attrName);
    if (attrValue) {
      result.push(attrValue);
    }
  }
  return result;
}

/**
 * 从 Elements 中获取文本内容列表。
 * @param elements Elements 对象
 * @returns 文本内容列表
 */
export function getTextContents(elements: Elements | null): string[] {
  if (!elements) return [];
  const result: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const textContent = elements[i].text();
    if (textContent) {
      result.push(textContent);
    }
  }
  return result;
}