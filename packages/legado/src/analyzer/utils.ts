import { logger } from '@any-reader/utils'; // 导入 logger

export function isExplicitObject(value: any) {
  return typeof value === 'object' && value !== null && value.constructor === Object;
}

export function parseJson<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString);
  } catch (e: any) {
    logger.error('JSON 解析错误:', { jsonString, error: e, stack: e.stack }); // 中文 + 结构化
    return null;
  }
}