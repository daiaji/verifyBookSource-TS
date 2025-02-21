import { v4 as uuidV4 } from 'uuid';
import { decodeRule } from './compress'; // 更正拼写
import { NetworkManager, logger } from '@any-reader/utils';
// import { isEsoStr, isEsoObj } from './utils'; // 移动到 utils.ts
import { DEFAULT_RULE } from './config'; // 导入配置
import { ContentType, Rule } from '../type'; // 从 type.d.ts 导入
import { fetchRulesFromUrl, isEsoObj, isEsoStr } from './utils';

export function createRule(rule: Partial<Rule>): Rule {
  const now = Date.now(); // 使用毫秒级时间戳
  return {
    ...DEFAULT_RULE,
    id: rule.id || uuidV4(), // 允许传入 id
    createTime: now,
    modifiedTime: now,
    ...rule,
  };
}

export async function text2rules(text: string): Promise<Rule[]> {
  const trimmedText = text.trim();

  if (isEsoStr(trimmedText)) {
    const decoded = decodeRule(trimmedText);
    return decoded ? [decoded] : []; // 解码失败返回空数组
  }

  // 从网络获取
  if (/^https?:\/\/.{3,}/.test(trimmedText)) {
    return fetchRulesFromUrl(trimmedText);
  }

  try {
    const json = JSON.parse(trimmedText);
    const jsons = [].concat(json); // 简化数组转换
    const result: Rule[] = [];
    for (const item of jsons) {
      if (isEsoObj(item)) {
        result.push(item);
      } else if (isEsoStr(item)) {
        const decoded = decodeRule(item);
        if (decoded) {
          result.push(decoded);
        }
      }
    }
    return result;
  } catch (error) {
    logger.warn('导入格式不支持');
    return [];
  }
}