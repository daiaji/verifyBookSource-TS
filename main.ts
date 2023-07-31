// main.ts
import fs from 'fs/promises';
import { Book, fetchWithTimeout, BookResult, RedirectResult } from './book';

interface Config {
    path: string;
    error_output: boolean;
    workers: number;
    dedup: string;
    outpath: string;
}

const configFilePath = './config.json';

async function checkRedirect(book: BookResult, timeout = 5000): Promise<RedirectResult> {
    const url = book.book.bookSourceUrl;
    try {
        const response = await fetchWithTimeout(url, {
            timeout,
            redirect: 'manual',
            headers: Book.headers,
        });
        if (response.status === 302 || response.status === 301) {
            return { book: book.book, redirectUrl: response.headers.get('location') };
        } else {
            return { book: book.book, redirectUrl: null };
        }
    } catch (error) {
        console.error(`检查重定向时发生错误，URL: ${url}，错误信息: ${(error as any).message}`);
        return { book: book.book, redirectUrl: null };
    }
}

async function work(config: Config) {
    try {
        const book = new Book(config.path, config.error_output);
        const startTime = Date.now();
        const booksRes = await book.checkBooks(Number(config.workers));

        let good = booksRes.good;
        const error = booksRes.error;

        if (config.dedup === 'y') {
            good = book.dedup(good);
        }

        const redirectUrls: RedirectResult[] = [];
        const promises = good.map((book: BookResult) => checkRedirect(book));
        const results = await Promise.all(promises);
        results.forEach((result: RedirectResult) => {
            if (result.redirectUrl) {
                redirectUrls.push(result);
            }
        });

        const s = booksRes.good.length + booksRes.error.length;
        const g = good.length;
        const e = error.length;
        const r = redirectUrls.length;
        console.log(
            `\n${'-'.repeat(16)}\n` +
            "成果报表\n" +
            `书源总数：${s}\n` +
            `有效书源数：${g}\n` +
            `无效书源数：${e}\n` +
            `重定向书源数：${r}\n` +
            `重复书源数：${config.dedup === 'y' ? s - g - e : '未选择去重'}\n` +
            `耗时：${(Date.now() - startTime) / 1000}秒`
        );

        return { good, error, redirectUrls };
    } catch (e) {
        console.error("无效的文件或URL", e);
        return null;
    }
}

async function saveData(config: Config, good: BookResult[], error: BookResult[], redirectUrls: RedirectResult[]) {
    await Promise.all([
        fs.writeFile(config.outpath + 'good.json', JSON.stringify(good, null, 4), 'utf-8'),
        fs.writeFile(config.outpath + 'error.json', JSON.stringify(error, null, 4), 'utf-8'),
        fs.writeFile(config.outpath + 'redirect.json', JSON.stringify(redirectUrls, null, 4), 'utf-8')
    ]);
}

async function main() {
    console.log(
        "开始处理书源\n" +
        `${'-'.repeat(16)}`
    );

    try {
        const rawData = await fs.readFile(configFilePath, 'utf-8');
        const config: Config = JSON.parse(rawData);

        const workResult = await work(config);
        if (workResult) {
            const { good, error, redirectUrls } = workResult;
            if (good && error && redirectUrls) {
                await saveData(config, good, error, redirectUrls);
            }
        } else {
            console.error('没有可用的工作结果');
        }
    } catch (e) {
        console.error("config.json文件不存在，请检查一下。或者使用命令行输入配置。", e);
    }
}

main();
