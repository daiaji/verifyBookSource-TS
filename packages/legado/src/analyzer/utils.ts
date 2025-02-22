import { logger } from '@any-reader/utils'; // 导入 logger

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
  try {
    return JSON.parse(jsonString) as T;
  } catch (e: any) {
    logger.error('JSON 解析错误:', { jsonString, error: e, stack: e.stack }); // 中文 + 结构化
    return null;
  }
}