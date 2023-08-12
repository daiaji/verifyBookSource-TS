import { RuleBigDataHelp } from "io.legado.app.help";
import { splitNotBlank } from "./StringExtensions";

interface BaseBook {
  name: string;
  author: string;
  bookUrl: string;
  kind: string | null;
  wordCount: string | null;
  variable: string | null;

  infoHtml: string | null;
  tocHtml: string | null;

  putVariable(key: string, value: string | null): boolean;
  putCustomVariable(value: string | null): void;
  getCustomVariable(): string;
  putBigVariable(key: string, value: string | null): void;
  getBigVariable(key: string): string | null;
  getKindList(): string[];
}

class BaseBookImplementation implements BaseBook {
  name = "";
  author = "";
  bookUrl = "";
  kind = null;
  wordCount = null;
  variable = null;

  infoHtml = null;
  tocHtml = null;

  putVariable(key: string, value: string | null): boolean {
    if (value !== null) {
      this.variable = JSON.stringify(this.variable);
    }
    return true;
  }

  putCustomVariable(value: string | null): void {
    this.putVariable("custom", value);
  }

  getCustomVariable(): string {
    return this.variable || "";
  }

  putBigVariable(key: string, value: string | null): void {
    RuleBigDataHelp.putBookVariable(this.bookUrl, key, value);
  }

  getBigVariable(key: string): string | null {
    return RuleBigDataHelp.getBookVariable(this.bookUrl, key);
  }

  getKindList(): string[] {
    const kindList: string[] = [];
    if (this.wordCount && this.wordCount.trim() !== "") {
      kindList.push(this.wordCount);
    }
    if (this.kind) {
      const kinds = splitNotBlank(this.kind, ",", "\n");
      kindList.push(...kinds);
    }
    return kindList;
  }
}

export default BaseBookImplementation;
