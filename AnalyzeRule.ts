import _ from 'lodash';

import AnalyzeByJSonPath from './AnalyzeByJSonPath';
import AnalyzeByJSoup from './AnalyzeByJSoup';
import AnalyzeByRegex from './AnalyzeByRegex';
import AnalyzeByXPath from './AnalyzeByXPath';
import AnalyzeUrl from './AnalyzeUrl';
import NetworkUtils from './NetworkUtils';
import RuleDataInterface from './RuleDataInterface';
import { isJson } from './StringExtensions';

class AnalyzeRule {
  private source: BaseSource | undefined;
  private book: BaseBook | undefined;
  private chapter: BookChapter | null = null;
  private ruleData: RuleDataInterface | undefined;
  private nextChapterUrl: string | null = null;
  private content: any = null;
  private baseUrl: string | null = null;
  private redirectUrl: URL | null = null;
  private isJSON: boolean = false;
  private isRegex: boolean = false;
  private analyzeByXPath: AnalyzeByXPath | null = null;
  private analyzeByJSoup: AnalyzeByJSoup | null = null;
  private analyzeByJSonPath: AnalyzeByJSonPath | null = null;
  private objectChangedXP: boolean = false;
  private objectChangedJS: boolean = false;
  private objectChangedJP: boolean = false;
  private stringRuleCache: { [key: string]: SourceRule[] } = {};

  constructor(ruleData: RuleDataInterface | undefined = undefined, source: BaseSource | undefined = undefined) {
    this.ruleData = ruleData;
    this.source = source;
    this.book = ruleData as BaseBook | undefined;
  }

  public setContent(content: any, baseUrl: string | null = null): AnalyzeRule {
    if (content == null) {
      throw new Error('内容不可空（Content cannot be null）');
    }
    this.content = content;
    this.isJSON = isJson(JSON.stringify(content));
    this.setBaseUrl(baseUrl);
    this.objectChangedXP = true;
    this.objectChangedJS = true;
    this.objectChangedJP = true;
    return this;
  }

  public setBaseUrl(baseUrl: string | null): AnalyzeRule {
    if (baseUrl != null) {
      this.baseUrl = baseUrl;
    }
    return this;
  }

  public setRedirectUrl(url: string): URL | null {
    try {
      this.redirectUrl = new URL(url);
    } catch (e: Error | unknown) {
      if (e instanceof Error) {
        console.log(`URL(${url}) error\n${e.message}`);
      } else {
        console.log(`URL(${url}) error\n${e}`);
      }
    }
    return this.redirectUrl;
  }

  private getAnalyzeByXPath(o: any): AnalyzeByXPath {
    if (o !== this.content) {
      return new AnalyzeByXPath(o);
    } else {
      if (this.analyzeByXPath == null || this.objectChangedXP) {
        this.analyzeByXPath = new AnalyzeByXPath(this.content);
        this.objectChangedXP = false;
      }
      return this.analyzeByXPath;
    }
  }

  private getAnalyzeByJSoup(o: any): AnalyzeByJSoup {
    if (o !== this.content) {
      return new AnalyzeByJSoup(o);
    } else {
      if (this.analyzeByJSoup == null || this.objectChangedJS) {
        this.analyzeByJSoup = new AnalyzeByJSoup(this.content);
        this.objectChangedJS = false;
      }
      return this.analyzeByJSoup;
    }
  }

  private getAnalyzeByJSonPath(o: any): AnalyzeByJSonPath {
    if (o !== this.content) {
      return new AnalyzeByJSonPath(o);
    } else {
      if (this.analyzeByJSonPath == null || this.objectChangedJP) {
        this.analyzeByJSonPath = new AnalyzeByJSonPath(this.content);
        this.objectChangedJP = false;
      }
      return this.analyzeByJSonPath;
    }
  }

  public getStringList(rule: string | undefined, mContent?: any, isUrl?: boolean): string[] | null;
  public getStringList(ruleList: SourceRule[], mContent?: any, isUrl?: boolean): string[] | null;
  public getStringList(ruleOrRuleList: string | SourceRule[] | undefined, mContent: any = null, isUrl: boolean = false): string[] | null {
    if (ruleOrRuleList == null || ruleOrRuleList === '') {
      return null;
    }
    const ruleList = Array.isArray(ruleOrRuleList) ? ruleOrRuleList : this.splitSourceRuleCacheString(ruleOrRuleList);
    let result: any = null;
    const content = mContent ?? this.content;
    if (content != null && ruleList.length > 0) {
      result = content;
      if (result instanceof Object) {
        const sourceRule = ruleList[0];
        this.putRule(sourceRule.putMap);
        sourceRule.makeUpRule(result);
        result = sourceRule.getParamSize() > 1 ? sourceRule.rule : result[sourceRule.rule]?.toString();
        result = result ? this.replaceRegex(result, sourceRule) : null;
      } else {
        for (const sourceRule of ruleList) {
          this.putRule(sourceRule.putMap);
          sourceRule.makeUpRule(result);
          if (result != null) {
            if (sourceRule.rule !== '') {
              switch (sourceRule.mode) {
                case Mode.Js:
                  result = this.evalJS(sourceRule.rule, result);
                  break;
                case Mode.Json:
                  result = this.getAnalyzeByJSonPath(result).getStringList(sourceRule.rule);
                  break;
                case Mode.XPath:
                  result = this.getAnalyzeByXPath(result).getStringList(sourceRule.rule);
                  break;
                case Mode.Default:
                  result = this.getAnalyzeByJSoup(result).getStringList(sourceRule.rule);
                  break;
                default:
                  result = sourceRule.rule;
              }
            }
            if (sourceRule.replaceRegex !== '' && Array.isArray(result)) {
              const newList: string[] = [];
              for (const item of result) {
                newList.push(this.replaceRegex(item.toString(), sourceRule));
              }
              result = newList;
            } else if (sourceRule.replaceRegex !== '') {
              result = this.replaceRegex(result.toString(), sourceRule);
            }
          }
        }
      }
    }
    if (result == null) {
      return null;
    }
    if (typeof result === 'string') {
      result = result.split('\n');
    }
    if (isUrl) {
      const urlList: string[] = [];
      if (Array.isArray(result)) {
        for (const url of result) {
          const absoluteURL = NetworkUtils.getAbsoluteURL(this.redirectUrl, url.toString());
          if (absoluteURL !== '' && !urlList.includes(absoluteURL)) {
            urlList.push(absoluteURL);
          }
        }
      }
      return urlList;
    }
    return result as string[];
  }

  public getString(ruleStr: string | undefined, mContent?: any, isUrl?: boolean): string;
  public getString(ruleList: SourceRule[], mContent?: any, isUrl?: boolean, unescape?: boolean): string;
  public getString(ruleOrRuleList: string | SourceRule[] | undefined, mContent: any = null, isUrl: boolean = false, unescape: boolean = true): string {
    if (ruleOrRuleList == null || ruleOrRuleList === '') {
      return '';
    }
    const ruleList = Array.isArray(ruleOrRuleList) ? ruleOrRuleList : this.splitSourceRuleCacheString(ruleOrRuleList);
    let result: any = null;
    const content = mContent ?? this.content;
    if (content != null && ruleList.length > 0) {
      result = content;
      if (result instanceof Object) {
        const sourceRule = ruleList[0];
        this.putRule(sourceRule.putMap);
        sourceRule.makeUpRule(result);
        result = sourceRule.getParamSize() > 1 ? sourceRule.rule : result[sourceRule.rule]?.toString();
        result = result ? this.replaceRegex(result, sourceRule) : null;
      } else {
        for (const sourceRule of ruleList) {
          this.putRule(sourceRule.putMap);
          sourceRule.makeUpRule(result);
          if (result != null) {
            if (sourceRule.rule !== '' || sourceRule.replaceRegex === '') {
              switch (sourceRule.mode) {
                case Mode.Js:
                  result = this.evalJS(sourceRule.rule, result);
                  break;
                case Mode.Json:
                  result = this.getAnalyzeByJSonPath(result).getString(sourceRule.rule);
                  break;
                case Mode.XPath:
                  result = this.getAnalyzeByXPath(result).getString(sourceRule.rule);
                  break;
                case Mode.Default:
                  result = isUrl
                    ? this.getAnalyzeByJSoup(result).getString0(sourceRule.rule)
                    : this.getAnalyzeByJSoup(result).getString(sourceRule.rule);
                  break;
                default:
                  result = sourceRule.rule;
              }
            }
            if (result != null && sourceRule.replaceRegex !== '') {
              result = this.replaceRegex(result.toString(), sourceRule);
            }
          }
        }
      }
    }
    if (result == null) {
      result = '';
    }
    const str = unescape ? _.escape(result.toString()) : result.toString();
    if (isUrl) {
      return str === '' ? (this.baseUrl ?? '') : NetworkUtils.getAbsoluteURL(this.redirectUrl, str);
    }
    return str;
  }

  public getElement(ruleStr: string): any {
    if (ruleStr == null || ruleStr === '') {
      return null;
    }
    let result: any = null;
    const content = this.content;
    const ruleList = this.splitSourceRule(ruleStr, true);
    if (content != null && ruleList.length > 0) {
      result = content;
      for (const sourceRule of ruleList) {
        this.putRule(sourceRule.putMap);
        sourceRule.makeUpRule(result);
        if (result != null) {
          switch (sourceRule.mode) {
            case Mode.Regex:
              result = AnalyzeByRegex.getElement(result.toString(), sourceRule.rule.splitNotBlank('&&'));
              break;
            case Mode.Js:
              result = this.evalJS(sourceRule.rule, result);
              break;
            case Mode.Json:
              result = this.getAnalyzeByJSonPath(result).getObject(sourceRule.rule);
              break;
            case Mode.XPath:
              result = this.getAnalyzeByXPath(result).getElements(sourceRule.rule);
              break;
            default:
              result = this.getAnalyzeByJSoup(result).getElements(sourceRule.rule);
          }
          if (sourceRule.replaceRegex !== '') {
            result = this.replaceRegex(result.toString(), sourceRule);
          }
        }
      }
    }
    return result;
  }

  public getElements(ruleStr: string): any[] {
    const result: any[] = [];
    const content = this.content;
    const ruleList = this.splitSourceRule(ruleStr, true);
    if (content != null && ruleList.length > 0) {
      let tmpResult: any = content;
      for (const sourceRule of ruleList) {
        this.putRule(sourceRule.putMap);
        tmpResult = tmpResult ? tmpResult : [];
        switch (sourceRule.mode) {
          case Mode.Regex:
            tmpResult = AnalyzeByRegex.getElements(tmpResult.toString(), sourceRule.rule.splitNotBlank('&&'));
            break;
          case Mode.Js:
            tmpResult = this.evalJS(sourceRule.rule, tmpResult);
            break;
          case Mode.Json:
            tmpResult = this.getAnalyzeByJSonPath(tmpResult).getList(sourceRule.rule);
            break;
          case Mode.XPath:
            tmpResult = this.getAnalyzeByXPath(tmpResult).getElements(sourceRule.rule);
            break;
          default:
            tmpResult = this.getAnalyzeByJSoup(tmpResult).getElements(sourceRule.rule);
        }
        if (sourceRule.replaceRegex !== '') {
          tmpResult = this.replaceRegex(tmpResult.toString(), sourceRule);
        }
      }
      if (tmpResult != null) {
        result.push(...tmpResult);
      }
    }
    return result;
  }

  private putRule(map: { [key: string]: string }): void {
    for (const [key, value] of Object.entries(map)) {
      this.put(key, this.getString(value));
    }
  }

  private splitPutRule(ruleStr: string, putMap: { [key: string]: string }): string {
    let vRuleStr = ruleStr;
    const putMatcher = /@put:(\{[^}]+?\})/gi;
    let match;
    while ((match = putMatcher.exec(vRuleStr)) !== null) {
      vRuleStr = vRuleStr.replace(match[0], '');
      const putObj = JSON.parse(match[1]);
      Object.assign(putMap, putObj);
    }
    return vRuleStr;
  }

  private replaceRegex(result: string, rule: SourceRule): string {
    if (rule.replaceRegex === '') {
      return result;
    }
    let vResult = result;
    if (rule.replaceFirst) {
      try {
        const pattern = new RegExp(rule.replaceRegex);
        vResult = vResult.replace(pattern, rule.replacement);
      } catch {
        vResult = rule.replacement;
      }
    } else {
      try {
        vResult = vResult.replace(new RegExp(rule.replaceRegex, 'g'), rule.replacement);
      } catch {
        vResult = vResult.replace(rule.replaceRegex, rule.replacement);
      }
    }
    return vResult;
  }

  private splitSourceRuleCacheString(ruleStr: string | undefined): SourceRule[] {
    if (ruleStr == null || ruleStr === '') {
      return [];
    }
    const cacheRule = this.stringRuleCache[ruleStr];
    if (cacheRule != null) {
      return cacheRule;
    } else {
      const rules = this.splitSourceRule(ruleStr);
      this.stringRuleCache[ruleStr] = rules;
      return rules;
    }
  }

  private splitSourceRule(ruleStr: string | undefined, allInOne: boolean = false): SourceRule[] {
    if (ruleStr == null || ruleStr === '') {
      return [];
    }
    const ruleList: SourceRule[] = [];
    let mMode: Mode = Mode.Default;
    let start = 0;
    if (allInOne && ruleStr.startsWith(':')) {
      mMode = Mode.Regex;
      this.isRegex = true;
      start = 1;
    } else if (this.isRegex) {
      mMode = Mode.Regex;
    }
    let tmp;
    const jsMatcher = /(@@[^@]+?@@|@@[^@]+?@@)/gi;
    let match;
    while ((match = jsMatcher.exec(ruleStr)) !== null) {
      if (match.index > start) {
        tmp = ruleStr.substring(start, match.index).trim();
        if (tmp !== '') {
          ruleList.push(new SourceRule(tmp, mMode));
        }
      }
      ruleList.push(new SourceRule(match[0].slice(2, -2), Mode.Js));
      start = jsMatcher.lastIndex;
    }
    if (ruleStr.length > start) {
      tmp = ruleStr.substring(start).trim();
      if (tmp !== '') {
        ruleList.push(new SourceRule(tmp, mMode));
      }
    }
    return ruleList;
  }

  public put(key: string, value: string): string {
    if (this.chapter) {
      this.chapter.putVariable(key, value);
    } else if (this.book) {
      this.book.putVariable(key, value);
    } else if (this.ruleData) {
      this.ruleData.putVariable(key, value);
    } else if (this.source) {
      this.source.put(key, value);
    }
    return value;
  }

  public get(key: string): string {
    switch (key) {
      case 'bookName':
        return this.book?.name ?? '';
      case 'title':
        return this.chapter?.title ?? '';
      default:
        return this.chapter?.getVariable(key) ?? this.book?.getVariable(key) ?? this.ruleData?.getVariable(key) ?? this.source?.get(key) ?? '';
    }
  }

  private evalJS(jsStr: string, result: any = null): any {
    const sandbox = {};
    const script = new Function('java', 'source', 'book', 'result', 'baseUrl', 'chapter', 'title', 'src', 'nextChapterUrl', jsStr);
    script.call(sandbox, this, this.source, this.book, result, this.baseUrl, this.chapter, this.chapter?.title, this.content, this.nextChapterUrl);
    return sandbox;
  }

  public ajax(url: any): string | null {
    const urlStr = Array.isArray(url) ? url[0]?.toString() : url?.toString();
    try {
      const analyzeUrl = new AnalyzeUrl(urlStr, this.source, this.book);
      const response = analyzeUrl.getStrResponseAwait().body;
      return response;
    } catch (error) {
      console.log(`ajax(${urlStr}) error\n${error.stack}`);
      return null;
    }
  }
}

enum Mode {
  XPath,
  Json,
  Default,
  Js,
  Regex,
}

class SourceRule {
  rule: string;
  mode: Mode;
  replaceRegex: string;
  replacement: string;
  replaceFirst: boolean;
  putMap: { [key: string]: string };
  ruleParam: string[];
  ruleType: number[];

  constructor(ruleStr: string, mode: Mode = Mode.Default) {
    this.rule = ruleStr;
    this.mode = mode;
    this.replaceRegex = '';
    this.replacement = '';
    this.replaceFirst = false;
    this.putMap = {};
    this.ruleParam = [];
    this.ruleType = [];
    this.splitRule(ruleStr);
  }

  private splitRule(ruleStr: string): void {
    this.rule = ruleStr;
    if (this.mode === Mode.Js || this.mode === Mode.Regex) {
      return;
    }
    if (ruleStr.startsWith('@CSS:', true)) {
      this.mode = Mode.Default;
      return;
    }
    if (ruleStr.startsWith('@@')) {
      this.mode = Mode.Default;
      this.rule = ruleStr.substring(2);
      return;
    }
    if (ruleStr.startsWith('@XPath:', true)) {
      this.mode = Mode.XPath;
      this.rule = ruleStr.substring(7);
      return;
    }
    if (ruleStr.startsWith('@Json:', true)) {
      this.mode = Mode.Json;
      this.rule = ruleStr.substring(6);
      return;
    }
    if (this.isJSON || ruleStr.startsWith('$.')) {
      this.mode = Mode.Json;
      return;
    }
    if (ruleStr.startsWith('/')) {
      this.mode = Mode.XPath;
      return;
    }
  }

  public makeUpRule(result: Object | null): void {
    const infoVal: string[] = [];
    if (this.ruleParam.length > 0) {
      let index = this.ruleParam.length;
      while (index-- > 0) {
        const regType = this.ruleType[index];
        switch (regType) {
          case 0:
            infoVal.unshift(this.ruleParam[index]);
            break;
          case -1:
            if (this.isRule(this.ruleParam[index])) {
              const result = this.getString([new SourceRule(this.ruleParam[index])]);
              infoVal.unshift(result);
            } else {
              const jsEval = this.evalJS(this.ruleParam[index]);
              if (jsEval === null) {
                break;
              } else if (typeof jsEval === 'string') {
                infoVal.unshift(jsEval);
              } else if (typeof jsEval === 'number' && jsEval % 1 === 0) {
                infoVal.unshift(jsEval.toFixed(0));
              } else {
                infoVal.unshift(jsEval.toString());
              }
            }
            break;
          case -2:
            infoVal.unshift(this.get(this.ruleParam[index]));
            break;
          default:
            if (Array.isArray(result) && result.length > regType) {
              infoVal.unshift(result[regType] ?? '');
            } else {
              infoVal.unshift(this.ruleParam[index]);
            }
            break;
        }
      }
      this.rule = infoVal.join('');
    }
    const ruleStrS = this.rule.split('##');
    this.rule = ruleStrS[0].trim();
    if (ruleStrS.length > 1) {
      this.replaceRegex = ruleStrS[1];
    }
    if (ruleStrS.length > 2) {
      this.replacement = ruleStrS[2];
    }
    if (ruleStrS.length > 3) {
      this.replaceFirst = true;
    }
  }

  private isRule(ruleStr: string): boolean {
    return ruleStr.startsWith('@') || ruleStr.startsWith('$.') || ruleStr.startsWith('$[') || ruleStr.startsWith('//');
  }
}

export default AnalyzeRule;
