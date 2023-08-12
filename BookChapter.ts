import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import axios from 'axios';
import { URL } from 'url';
import { s2t, t2s } from 'chinese-s2t';

interface BookChapter {
    url: string,
    title: string,
    isVolume: boolean,
    baseUrl: string,
    bookUrl: string,
    index: number,
    isVip: boolean,
    isPay: boolean,
    resourceUrl: string | null,
    tag: string | null,
    start: number | null,
    end: number | null,
    startFragmentId: string | null,
    endFragmentId: string | null,
    variable: string | null
}

class BookChapterModel implements BookChapter {
    url: string = '';
    title: string = '';
    isVolume: boolean = false;
    baseUrl: string = '';
    bookUrl: string = '';
    index: number = 0;
    isVip: boolean = false;
    isPay: boolean = false;
    resourceUrl: string | null = null;
    tag: string | null = null;
    start: number | null = null;
    end: number | null = null;
    startFragmentId: string | null = null;
    endFragmentId: string | null = null;
    variable: string | null = null;

    private titleMD5: string;

    constructor(bookChapter: BookChapter) {
        Object.assign(this, bookChapter);
        this.titleMD5 = this.md5Encode16(this.title);
    }

    private md5Encode16(data: string): string {
        return crypto.createHash('md5').update(data).digest('hex').substr(8, 16);
    }

    public getDisplayTitle(chineseConvert: boolean = true): string {
        let displayTitle = this.title.replace(/\r\n/g, '');
        if (chineseConvert) {
            // TODO: Replace with your own logic to determine whether to convert to simplified or traditional Chinese.
            displayTitle = t2s(displayTitle); // Simplified Chinese
            displayTitle = s2t(displayTitle); // Traditional Chinese
        }
        return displayTitle;
    }

    public async getAbsoluteURL(): Promise<string> {
        if (this.url.startsWith(this.title) && this.isVolume) return this.baseUrl;
        const urlMatcher = this.url.match(/(.*?)(\?.*)?$/);
        const urlBefore = urlMatcher ? urlMatcher[1] : this.url;
        const urlAbsoluteBefore = await this.getAbsoluteURLFromBase(urlBefore);
        return urlMatcher && urlMatcher[2] ? `${urlAbsoluteBefore},${urlMatcher[2]}` : urlAbsoluteBefore;
    }

    private async getAbsoluteURLFromBase(relativeUrl: string): Promise<string> {
        const url = new URL(relativeUrl, this.baseUrl);
        const response = await axios.get(url.toString());
        return response.request.res.url;
    }

    public getFileName(suffix: string = 'nb'): string {
        return `${this.index.toString().padStart(5, '0')}-${this.titleMD5}.${suffix}`;
    }

    public getFontName(): string {
        return `${this.index.toString().padStart(5, '0')}-${this.titleMD5}.ttf`;
    }
}
