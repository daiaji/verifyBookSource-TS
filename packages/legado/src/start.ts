import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@any-reader/utils';
import { LegadoRule, LegadoRuleManager, BookInfo } from '@any-reader/legado'; // 导入 BookInfo
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

        const rule = rules[0];
        logger.debug('使用的规则', { rule });

        const analyzer = new LegadoRuleManager(rule);

        // 1. 搜索
        const searchTerm = '我的';
        const searchResults = await analyzer.search(searchTerm);

        if (searchResults.length === 0) {
            logger.warn('未找到搜索结果，跳过后续步骤。');
            return;
        }

        // 2. 获取第一本书的详情 (包括 tocUrl)
        const firstBookUrl = searchResults[0].url;
        let bookInfo: BookInfo;
        try {
            bookInfo = await analyzer.getBookInfo(firstBookUrl);
        } catch (bookInfoError: any) {
            logger.error(`获取书籍详情失败 (URL: ${firstBookUrl}):`, { error: bookInfoError.message, stack: bookInfoError.stack });
            return; // 获取详情失败，停止
        }

        // 3. 获取章节列表
        let chapters = [];
        try {
            chapters = await analyzer.getChapter(bookInfo.tocUrl); // 使用 bookInfo.tocUrl
        } catch (chapterError: any) {
            logger.error(`获取章节列表失败 (URL: ${bookInfo.tocUrl}):`, { error: chapterError.message, stack: chapterError.stack });
            return; // 获取章节列表失败，停止
        }

        logger.info(`章节数量: ${chapters.length}`);

        // 4. 获取第一章内容
        if (chapters.length > 0) {
            const firstChapterUrl = chapters[0].url;
            let content = [];
            try {
                content = await analyzer.getContent(firstChapterUrl);
                logger.info(`获取到章节内容, 长度: ${content.length > 0 ? content[0].length : 0}`);
            } catch (contentError: any) {
                logger.error(`获取章节内容失败 (URL: ${firstChapterUrl}):`, { error: contentError.message, stack: contentError.stack });
            }
        } else {
            logger.warn('未找到章节，跳过 getContent 测试。');
        }

    } catch (error: any) {
        logger.error('发生错误', { error: error.message, stack: error.stack });
    }
}

main();