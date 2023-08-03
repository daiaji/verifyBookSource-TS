// book.ts
import tldjs from "tldjs";
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { existsSync } from "fs";
import fs from "fs/promises";

interface SearchRule {
  bookList: string;
}

interface BookSource {
  bookSourceUrl: string;
  searchUrl: string;
  header: string;
  ruleSearch: SearchRule;
}

export interface BookResult {
  book: BookSource;
  status: boolean;
}

export interface RedirectResult {
  book: BookSource;
  redirectUrl: string | null;
}

export class Book {
  static headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58",
  };
  file: string;
  errorOutput: boolean;
  type: string | null;

  constructor(file: string, errorOutput = true) {
    this.file = file;
    this.errorOutput = errorOutput;
    this.type = this.recognizeType(this.file);
    if (this.type === null) {
      throw new Error("无效的文件或URL");
    }
  }

  recognizeType(file: string): string | null {
    if (file.startsWith("http")) {
      return "url";
    } else if (existsSync(file)) {
      return file.split(".").pop() || null;
    } else {
      return null;
    }
  }

  async jsonToBooks(): Promise<BookSource[]> {
    try {
      if (this.type === "url") {
        const response = await fetchWithTimeout(this.file);
        return response.json();
      } else {
        const rawData = await fs.readFile(this.file, "utf-8");
        return JSON.parse(rawData);
      }
    } catch (error) {
      console.error(
        `解析文件时发生错误，文件: ${this.file}，错误信息: ${error}`
      );
      return [];
    }
  }

  async check(abook: BookSource, timeout = 5000): Promise<BookResult> {
    try {
      let url: string = '';
      let json: string | null = null;
      let searchUrl: any;

      const commaIndex = abook.searchUrl.indexOf(',');
      if (commaIndex !== -1) {
        url = abook.searchUrl.slice(0, commaIndex).replace("{{key}}", "我的").replace("{{page}}", "1");
        json = abook.searchUrl.slice(commaIndex + 1);
        searchUrl = JSON.parse(json.replace("{{key}}", "我的").replace("{{page}}", "1"));
      } else {
        url = abook.searchUrl.replace("{{key}}", "我的").replace("{{page}}", "1");
        searchUrl = { method: "GET", charset: "utf-8" };
        console.log(`这是GETURL：${url}`);
      }
      console.log(`这是URL：${url}`);
      console.log(`这是searchUrl：${JSON.stringify(searchUrl, null, 2)}`);

      const headers = abook.header ? JSON.parse(abook.header) : Book.headers;
      if (searchUrl.charset.toLowerCase() !== "utf-8") {
        headers["Accept-Charset"] = searchUrl.charset;
      }
      const response = await fetchWithTimeout(abook.bookSourceUrl + url, {
        method: searchUrl.method || "GET",
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: searchUrl.body
          ? iconv.encode(searchUrl.body, searchUrl.charset)
          : undefined
      });
      if (response.ok) {
        const html = await response.text();
        const $ = load(html);
        const bookList = $(abook.ruleSearch.bookList);
        if (bookList && bookList.length > 0) {
          return { book: abook, status: true };
        } else {
          return { book: abook, status: false };
        }
      } else {
        return { book: abook, status: false };
      }
    } catch (error) {
      if (this.errorOutput) {
        console.error(
          `检查书源时发生错误，错误信息: ${(error as any).message}，URL: ${abook.bookSourceUrl}`
        );
      }
      return { book: abook, status: false };
    }
  }

  async checkBooks(
    workers: number
  ): Promise<{ good: BookResult[]; error: BookResult[] }> {
    if (typeof workers !== "number" || workers <= 0) {
      throw new Error("无效的工作线程数，应为正整数。");
    }
    const books = await this.jsonToBooks();
    const results: PromiseFulfilledResult<BookResult>[] = [];
    for (let i = 0; i < books.length; i += workers) {
      const promises = books
        .slice(i, i + workers)
        .map((book: BookSource) => this.check(book));
      const res = await Promise.allSettled(promises);
      results.push(
        ...(res.filter(
          (result: PromiseSettledResult<BookResult>) =>
            result.status === "fulfilled"
        ) as PromiseFulfilledResult<BookResult>[])
      );
    }
    const good = results
      .filter(
        (result: PromiseFulfilledResult<BookResult>) => result.value.status
      )
      .map((result: PromiseFulfilledResult<BookResult>) => result.value);
    const error = results
      .filter(
        (result: PromiseFulfilledResult<BookResult>) => !result.value.status
      )
      .map((result: PromiseFulfilledResult<BookResult>) => result.value);
    return { good, error };
  }

  dedup(books: BookResult[]): BookResult[] {
    if (!Array.isArray(books)) {
      throw new Error("无效的参数，应为书源列表。");
    }
    const seen = new Set();
    const deduped = [];
    for (const book of books) {
      const domain = tldjs.getDomain(book.book.bookSourceUrl);
      if (!seen.has(domain)) {
        seen.add(domain);
        deduped.push(book);
      }
    }
    return deduped;
  }
}

export async function fetchWithTimeout(resource: string, options: any = {}) {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);

  if (!response.ok) {
    throw new Error(`请求失败，状态码：${response.status}`);
  }

  return response;
}