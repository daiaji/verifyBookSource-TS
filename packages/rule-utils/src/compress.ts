import { fromByteArray, toByteArray } from 'base64-js';
import pako from 'pako';
import { Rule } from '../type'; // 从 type.d.ts 导入
import { TAG } from './config';

const { deflate, inflate } = pako;

/**
 * 规则解码
 * @param text 编码后的规则字符串
 * @returns 解码后的规则对象, 如果解码失败返回 null
 */
export function decodeRule(text: string): Rule | null {
  const lastIndex = text.lastIndexOf('@');
  if (lastIndex === -1) {
    return null; // 未找到分隔符
  }
  try {
    const gzipBytes = toByteArray(text.substring(lastIndex + 1));
    return JSON.parse(inflate(gzipBytes, { to: 'string' }));
  } catch (error) {
    // 捕获 JSON 解析错误
    // 可以选择记录日志
    return null;
  }
}

/**
 * 规则编码
 * @param text 规则对象或 JSON 字符串
 * @returns 编码后的规则字符串
 */
export function encodeRule(text: Rule | string): string {
  const rule: Rule = typeof text === 'string' ? JSON.parse(text) : text;
  const ruleText = JSON.stringify(rule); // 只转换一次
  const encodeRuleText = fromByteArray(deflate(ruleText));
  return `${TAG}${rule.author || ''}:${rule.name || ''}@${encodeRuleText}`;
}