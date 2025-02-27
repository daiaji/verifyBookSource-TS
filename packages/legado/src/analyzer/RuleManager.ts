import type { LegadoRule } from '../types';
import { AnalyzerManager } from './AnalyzerManager';
import { AnalyzeUrl } from './AnalyzeUrl';
import { RuleEvaluator } from './common';
import { Fmt } from '@any-reader/utils';
import { NetworkUtils } from '@any-reader/utils';
import { logger } from '@any-reader/utils';

abstract class RuleManager {
    rule: LegadoRule;
    constructor(rule: LegadoRule) {
        this.rule = rule;
    }
    abstract search(keyword: string): Promise<SearchItem[]>;
    abstract getChapter(tocUrl: string): Promise<ChapterItem[]>;
    abstract getContent(chapterUrl: string): Promise<string[]>;
    abstract getBookInfo(bookUrl: string): Promise<BookInfo>; // 修改返回值类型
}

export interface BookInfo {
    name: string;
    author: string;
    cover: string;
    description: string;
    tocUrl: string; // 目录页 URL
    intro: string; //简介
}

export interface SearchItem {
    cover: string;
    name: string;
    author: string;
    chapter: string;
    description: string;
    url: string;
    tocUrl?: string;
}

export interface ChapterItem {
    url: string;
    name: string;
    contentUrl?: string;
    cover?: string;
    time?: string;
}

export class LegadoRuleManager implements RuleManager {
    rule: LegadoRule;

    constructor(rule: LegadoRule) {
        this.rule = rule;
    }

    async search(keyword: string): Promise<SearchItem[]> {
        logger.debug(`调用, 关键词: ${keyword}`);
        const analyzeUrl = new AnalyzeUrl(this.rule.searchUrl, keyword, null, this.rule.bookSourceUrl);
        await analyzeUrl.init();

        const resp = await analyzeUrl.getStrResponseAwait();
        if (!resp.body) {
            logger.warn('搜索响应为空.', { fieldName: 'searchUrl' });
            return [];
        }
        logger.silly(`搜索页响应体: ${resp.body}`);

        const body = resp.body;
        const baseUrl = resp.raw.request.url;
        const analyzeRule = new AnalyzerManager(body);
        analyzeRule.setBaseUrl(baseUrl);

        const list = analyzeRule.getElements(this.rule.ruleSearch.bookList);
        logger.silly(`列表元素数量: ${list.length}`);

        const bookListRule = this.rule.ruleSearch;
        const ruleName = analyzeRule.parseStrings(bookListRule.name, 'name');
        const ruleBookUrl = analyzeRule.parseStrings(bookListRule.bookUrl, 'bookUrl');
        const ruleAuthor = analyzeRule.parseStrings(bookListRule.author, 'author');
        const ruleCoverUrl = analyzeRule.parseStrings(bookListRule.coverUrl, 'coverUrl');
        const ruleIntro = analyzeRule.parseStrings(bookListRule.intro, 'intro');
        const ruleLastChapter = analyzeRule.parseStrings(bookListRule.lastChapter, 'lastChapter');

        const bookList: SearchItem[] = [];

        for (const [index, item] of list.entries()) {
            logger.silly(`正在处理搜索结果项: ${index + 1}/${list.length}, item: ${item}`);
            analyzeRule.setContent(item);
            const name = Fmt.bookName(analyzeRule.getString(ruleName, 'name'));
            const author = Fmt.author(analyzeRule.getString(ruleAuthor, 'author'));
            const chapter = analyzeRule.getString(ruleLastChapter, 'lastChapter');
            const description = Fmt.html(analyzeRule.getString(ruleIntro, 'intro'));
            const cover = NetworkUtils.getAbsoluteURL(baseUrl, analyzeRule.getString(ruleCoverUrl, 'coverUrl'));
            const url = analyzeRule.getString(ruleBookUrl, 'bookUrl', null, true);

            // 注意: 这里不需要调用 getBookInfo, 因为 search 方法只返回搜索列表
            bookList.push({ name, author, chapter, description, cover, url });
        }

        logger.debug(`返回搜索结果, 数量: ${bookList.length}`);
        return bookList;
    }

    async getBookInfo(bookUrl: string): Promise<BookInfo> {
        logger.debug(`调用, bookUrl: ${bookUrl}`);

        if (!this.rule.ruleBookInfo) {
            logger.warn('规则检查: ruleBookInfo 为空，返回空对象。', { fieldName: 'ruleBookInfo' });
            return { name: '', author: '', cover: '', description: '', tocUrl: '', intro: '' };
        }

        const analyzeUrl = new AnalyzeUrl(bookUrl, null, null, this.rule.bookSourceUrl);
        await analyzeUrl.init();

        const resp = await analyzeUrl.getStrResponseAwait();
        if (!resp.body) {
            logger.warn('详情页响应为空.', { fieldName: 'bookUrl' });
            return { name: '', author: '', cover: '', description: '', tocUrl: '', intro: '' };
        }
        logger.silly(`详情页响应体: ${resp.body}`);

        const body = resp.body;
        const baseUrl = resp.raw.request.url;

        const analyzeRule = new AnalyzerManager(body);
        analyzeRule.setBaseUrl(baseUrl);

        const bookInfoRule = this.rule.ruleBookInfo;
        const ruleName = analyzeRule.parseStrings(bookInfoRule.name, 'name');
        const ruleAuthor = analyzeRule.parseStrings(bookInfoRule.author, 'author');
        const ruleCoverUrl = analyzeRule.parseStrings(bookInfoRule.coverUrl, 'coverUrl');
        const ruleIntro = analyzeRule.parseStrings(bookInfoRule.intro, 'intro');
        const ruleTocUrl = analyzeRule.parseStrings(bookInfoRule.tocUrl, 'tocUrl');

        const name = Fmt.bookName(analyzeRule.getString(ruleName, 'name'));
        const author = Fmt.author(analyzeRule.getString(ruleAuthor, 'author'));
        const cover = NetworkUtils.getAbsoluteURL(baseUrl, analyzeRule.getString(ruleCoverUrl, 'coverUrl'));
        const description = Fmt.html(analyzeRule.getString(ruleIntro, 'intro'));
        const tocUrl = analyzeRule.getString(ruleTocUrl, 'tocUrl', null, true);
        const intro = analyzeRule.getString(ruleIntro, 'intro'); // 新增简介

        return { name, author, cover, description, tocUrl, intro }; // 返回 BookInfo
    }


    async getChapter(tocUrl: string): Promise<ChapterItem[]> {
        logger.debug(`调用, tocUrl: ${tocUrl}`);

        if (!this.rule.ruleToc || !this.rule.ruleToc.chapterList) {
            logger.warn('规则检查: ruleToc 或 chapterList 为空，返回空数组。', { fieldName: 'ruleToc.chapterList' });
            return [];
        }

        const analyzeUrl = new AnalyzeUrl(tocUrl, null, null, this.rule.bookSourceUrl); // 使用 tocUrl
        await analyzeUrl.init();

        const resp = await analyzeUrl.getStrResponseAwait();
        if (!resp.body) {
            logger.warn('章节响应为空.', { fieldName: 'tocUrl' });
            return [];
        }
        logger.silly(`目录页响应体: ${resp.body}`);

        const body = resp.body;
        const baseUrl = resp.raw.request.url;

        const analyzeRule = new AnalyzerManager(body);
        analyzeRule.setBaseUrl(baseUrl);
        const chapterList = analyzeRule.getElements(this.rule.ruleToc.chapterList);

        logger.silly(`获取章节列表元素，数量: ${chapterList.length}`);
        const ruleName = analyzeRule.parseStrings(this.rule.ruleToc.chapterName);
        const ruleChapterUrl = analyzeRule.parseStrings(this.rule.ruleToc.chapterUrl);

        const chapters: ChapterItem[] = [];
        for (const [index, item] of chapterList.entries()) {
            logger.silly(`正在处理章节: ${index + 1}/${chapterList.length}, item: ${item}`);
            analyzeRule.setContent(item);
            const name = analyzeRule.getString(ruleName, 'chapterName');
            const url = analyzeRule.getString(ruleChapterUrl, 'chapterUrl', null, true);
            chapters.push({ name, url });
        }

        logger.debug(`返回章节列表, 数量: ${chapters.length}`);
        return chapters;
    }


    async getContent(chapterUrl: string): Promise<string[]> {
        logger.debug(`调用, chapterUrl: ${chapterUrl}`);
        if (!this.rule.ruleContent || !this.rule.ruleContent.content) {
            logger.warn('规则检查: ruleContent 或 content 为空，返回空数组。', { fieldName: 'ruleContent.content' });
            return [];
        }

        const analyzeUrl = new AnalyzeUrl(chapterUrl, null, null, this.rule.bookSourceUrl);
        await analyzeUrl.init();
        const resp = await analyzeUrl.getStrResponseAwait();

        if (!resp.body) {
            logger.warn('内容响应为空.', { fieldName: 'chapterUrl' });
            return [];
        }
        logger.silly(`正文页响应体: ${resp.body}`);

        const body = resp.body;
        const baseUrl = resp.raw.request.url;

        const analyzeRule = new AnalyzerManager(body);
        analyzeRule.setBaseUrl(baseUrl);

        const content = analyzeRule.getString(this.rule.ruleContent.content, 'content');
        logger.debug(`返回内容, 是否为空: ${!content}`);
        return [content];
    }
}