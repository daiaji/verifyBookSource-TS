import { decodeRule } from './compress';
import { NetworkManager, logger } from '@any-reader/utils';
import { Rule } from './type';
import { text2rules } from './rule'; // 从 rule.ts 导入 text2rules

/**
 * @param {string} str
 * @returns {boolean}
 */
export function isEsoStr(str: string): boolean {
  return typeof str === 'string' && str.startsWith('eso://');
}

export function isEsoObj(rule: any): boolean {
  return (
    typeof rule === 'object' &&
    rule !== null && // 添加 null 检查
    rule.id &&
    rule.host &&
    typeof rule.contentType !== 'undefined'
  );
}

/**
 * @param rule
 * @returns {boolean}
 */
export function isRule(rule: any): boolean {
  return typeof rule === 'string' ? isEsoStr(rule) : isEsoObj(rule);
}

export async function fetchRulesFromUrl(
  url: string,
): Promise<Rule[]> {
  const networkManager = new NetworkManager();

  try {
    const response = await networkManager.get<any>(url, { timeout: 10000 }); // 添加超时
    const data = response.data;

    if (typeof data === 'string') {
      return await text2rules(data);
    }
    if (!Array.isArray(data)) {
      return [];
    }
    const result: Rule[] = [];
    for (const rule of data) {
      if (isEsoObj(rule)) {
        result.push(rule);
      } else if (isEsoStr(rule)) {
        const decoded = decodeRule(rule);
        if (decoded) {
          result.push(decoded);
        }
      }
    }
    return result;
  } catch (error: any) {
    logger.warn('网络请求或解析失败:', {
      url,
      error: error.message,
      stack: error.stack,
      fieldName: 'fetchRulesFromUrl' // 补充 fieldName
    });
    return []; // 发生错误时返回空数组, 或者根据需要返回 null
  }
}