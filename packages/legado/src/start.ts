import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@any-reader/utils';
import { LegadoRule, LegadoRuleManager, BookInfo } from '@any-reader/legado';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pLimit from 'p-limit';

async function processRule(rule: LegadoRule, searchTerm: string, limit: pLimit.Limit, counter: Counter) {
    return limit(async () => {
        const analyzer = new LegadoRuleManager(rule);
        let success = false; // 标记此规则是否成功

        try {
            // 1. 搜索
            let searchResults = [];
            try {
                searchResults = await analyzer.search(searchTerm);
            } catch (searchError: any) {
                logger.warn(`[${rule.bookSourceName}] 搜索失败: ${searchError.message}`);
                return; // 搜索失败，跳过此规则
            }

            if (searchResults.length === 0) {
                logger.warn(`[${rule.bookSourceName}] 未找到搜索结果`);
                return; // 没有搜索结果，跳过此规则
            }

            // 2. 获取第一本书的详情 (包括 tocUrl)
            const firstBookUrl = searchResults[0].url;
            let bookInfo: BookInfo;
            try {
                bookInfo = await analyzer.getBookInfo(firstBookUrl);
            } catch (bookInfoError: any) {
                logger.error(`[${rule.bookSourceName}] 获取书籍详情失败 (URL: ${firstBookUrl}): ${bookInfoError.message}`);
                return; // 获取详情失败，跳过此规则
            }

            // 3. 获取章节列表
            let chapters = [];
            try {
                chapters = await analyzer.getChapter(bookInfo.tocUrl);
            } catch (chapterError: any) {
                logger.error(`[${rule.bookSourceName}] 获取章节列表失败 (URL: ${bookInfo.tocUrl}): ${chapterError.message}`);
                return; // 获取章节列表失败，跳过此规则
            }

            logger.info(`[${rule.bookSourceName}] 章节数量: ${chapters.length}`);

            // 4. 获取第一章内容
            if (chapters.length > 0) {
                const firstChapterUrl = chapters[0].url;
                try {
                    const content = await analyzer.getContent(firstChapterUrl);
                    logger.info(`[${rule.bookSourceName}] 获取到章节内容, 长度: ${content.length > 0 ? content[0].length : 0}`);
                    success = true; // 如果能获取到内容，则认为成功
                } catch (contentError: any) {
                    logger.error(`[${rule.bookSourceName}] 获取章节内容失败 (URL: ${firstChapterUrl}): ${contentError.message}`);
                }
            } else {
                logger.warn(`[${rule.bookSourceName}] 未找到章节`);
            }

        } catch (error: any) {
            logger.error(`[${rule.bookSourceName}] 处理规则时发生未知错误: ${error.message}`, { stack: error.stack });
        } finally {
            counter.increment(success); // 无论成功还是失败,finally 块都会执行
        }
    });
}

// 定义计数器接口和类
interface Counter {
    total: number;
    completed: number;
    successful: number;
    failed: number;
    increment(success: boolean): void;
}

class RuleCounter implements Counter {
    total: number;
    completed: number = 0;
    successful: number = 0;
    failed: number = 0;

    constructor(total: number) {
        this.total = total;
    }

    increment(success: boolean): void {
        this.completed++;
        if (success) {
            this.successful++;
        } else {
            this.failed++;
        }
        this.logProgress();
    }
    // 也可以用百分比
    logProgress(): void {
        // logger.info(`进度: ${this.completed}/${this.total} (成功: ${this.successful}, 失败: ${this.failed})`);
        const percentage = ((this.completed / this.total) * 100).toFixed(2); // 保留两位小数
        logger.info(`进度: ${this.completed}/${this.total} (${percentage}%) (成功: ${this.successful}, 失败: ${this.failed})`);
    }
}

async function main() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const ruleFilePath = path.resolve(__dirname, 'rule.json');
        const ruleContent = fs.readFileSync(ruleFilePath, 'utf-8');
        const rules: LegadoRule[] = JSON.parse(ruleContent);

        if (!rules || rules.length === 0) {
            logger.error('未找到规则 (rule.json)。');
            return;
        }

        const searchTerm = '我的';
        const limit = pLimit(48);
        const counter = new RuleCounter(rules.length); // 创建计数器

        const tasks = rules.map(rule => processRule(rule, searchTerm, limit, counter));
        await Promise.all(tasks);

    } catch (error: any) {
        logger.error('发生错误', { error: error.message, stack: error.stack });
    }
}

main();