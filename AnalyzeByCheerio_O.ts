import { JSDOM } from 'jsdom';
import RuleAnalyzer from './RuleAnalyzer';

class AnalyzeByJSoup {
  private element: Element;

  constructor(doc: any) {
    this.element = this.parse(doc);
  }

  private parse(doc: any): Element {
    if (doc instanceof Element) {
      return doc;
    }
    if (doc.isElement) {
      return doc.asElement();
    }
    if (doc.toString().startsWith('<?xml', 0)) {
      const dom = new JSDOM(doc.toString(), { contentType: 'text/xml' });
      return dom.window.document.documentElement;
    }
    const dom = new JSDOM(doc.toString());
    return dom.window.document.documentElement;
  }

  public getElements(rule: string): Element[] {
    return this.getElementsInternal(this.element, rule);
  }

  public getString(ruleStr: string): string | null {
    if (ruleStr === '') {
      return null;
    }
    const stringList = this.getStringList(ruleStr);
    return stringList.length > 0 ? stringList.join('\n') : null;
  }

  public getString0(ruleStr: string): string {
    const stringList = this.getStringList(ruleStr);
    return stringList.length > 0 ? stringList[0] : '';
  }

  public getStringList(ruleStr: string): string[] {
    const textS: string[] = [];
    if (ruleStr === '') {
      return textS;
    }
    const sourceRule = this.getSourceRule(ruleStr);
    if (sourceRule.elementsRule === '') {
      textS.push(this.element.textContent || '');
    } else {
      const ruleAnalyzes = new RuleAnalyzer(sourceRule.elementsRule);
      const ruleStrS = ruleAnalyzes.splitRule('&&', '||', '%%');
      const results: string[][] = [];
      for (const ruleStrX of ruleStrS) {
        let temp: string[] | null = null;
        if (sourceRule.isCss) {
          const lastIndex = ruleStrX.lastIndexOf('@');
          temp = this.getResultLast(
            Array.from(this.element.querySelectorAll(ruleStrX.substring(0, lastIndex))),
            ruleStrX.substring(lastIndex + 1)
          );
        } else {
          temp = this.getResultList(ruleStrX);
        }
        if (temp && temp.length > 0) {
          results.push(temp);
          if (ruleAnalyzes.elementsType === '||') {
            break;
          }
        }
      }
      if (results.length > 0) {
        if (ruleAnalyzes.elementsType === '%%') {
          for (let i = 0; i < results[0].length; i++) {
            for (const temp of results) {
              if (i < temp.length) {
                textS.push(temp[i]);
              }
            }
          }
        } else {
          for (const temp of results) {
            textS.push(...temp);
          }
        }
      }
    }
    return textS;
  }

  private getElementsInternal(temp: Element | null, rule: string): Element[] {
    if (!temp || rule === '') {
      return [];
    }
    const elements: Element[] = [];
    const sourceRule = this.getSourceRule(rule);
    const ruleAnalyzes = new RuleAnalyzer(sourceRule.elementsRule);
    const ruleStrS = ruleAnalyzes.splitRule('&&', '||', '%%');
    const elementsList: Element[][] = [];
    if (sourceRule.isCss) {
      for (const ruleStr of ruleStrS) {
        const tempS = Array.from(temp.querySelectorAll(ruleStr));
        elementsList.push(tempS);
        if (tempS.length > 0 && ruleAnalyzes.elementsType === '||') {
          break;
        }
      }
    } else {
      for (const ruleStr of ruleStrS) {
        const rsRule = new RuleAnalyzer(ruleStr);
        rsRule.trim();
        const rs = rsRule.splitRule('@');
        const el =
          rs.length > 1
            ? (() => {
                const elList: Element[] = [];
                let el = [temp];
                for (const rl of rs) {
                  const es: Element[] = [];
                  for (const et of el) {
                    es.push(...this.getElementsInternal(et, rl));
                  }
                  el = es;
                  elList.push(...el);
                }
                return el;
              })()
            : new ElementsSingle().getElementsSingle(temp, ruleStr);
        elementsList.push(el);
        if (el.length > 0 && ruleAnalyzes.elementsType === '||') {
          break;
        }
      }
    }
    if (elementsList.length > 0) {
      if (ruleAnalyzes.elementsType === '%%') {
        for (let i = 0; i < elementsList[0].length; i++) {
          for (const es of elementsList) {
            if (i < es.length) {
              elements.push(es[i]);
            }
          }
        }
      } else {
        for (const es of elementsList) {
          elements.push(...es);
        }
      }
    }
    return elements;
  }

  private getResultList(ruleStr: string): string[] | null {
    if (ruleStr === '') {
      return null;
    }
    let elements = [this.element];
    const rule = new RuleAnalyzer(ruleStr);
    rule.trim();
    const rules = rule.splitRule('@');
    const last = rules.length - 1;
    for (let i = 0; i < last; i++) {
      const es: Element[] = [];
      for (const elt of elements) {
        es.push(...new ElementsSingle().getElementsSingle(elt, rules[i]));
      }
      elements = es;
    }
    return elements.length === 0 ? null : this.getResultLast(elements, rules[last]);
  }

  private getResultLast(elements: Element[], lastRule: string): string[] {
    const textS: string[] = [];
    switch (lastRule) {
      case 'text':
        for (const element of elements) {
          const text = element.textContent || '';
          if (text !== '') {
            textS.push(text);
          }
        }
        break;
      case 'textNodes':
        for (const element of elements) {
          const tn: string[] = [];
          const contentEs = element.childNodes;
          for (const item of contentEs) {
            const text = (item as Text).textContent?.trim() || '';
            if (text !== '') {
              tn.push(text);
            }
          }
          if (tn.length > 0) {
            textS.push(tn.join('\n'));
          }
        }
        break;
      case 'ownText':
        for (const element of elements) {
          const text = element.textContent || '';
          if (text !== '') {
            textS.push(text);
          }
        }
        break;
      case 'html':
        const clone = this.cloneElements(elements);
        clone.forEach((el) => el.querySelectorAll('script').forEach((el) => el.remove()));
        clone.forEach((el) => el.querySelectorAll('style').forEach((el) => el.remove()));
        const html = clone.map((el) => el.outerHTML).join('');
        if (html !== '') {
          textS.push(html);
        }
        break;
      case 'all':
        textS.push(elements.map((el) => el.outerHTML).join(''));
        break;
      default:
        for (const element of elements) {
          const url = element.getAttribute(lastRule) || '';
          if (url.trim() !== '' && !textS.includes(url)) {
            textS.push(url);
          }
        }
        break;
    }
    return textS;
  }

  private getSourceRule(ruleStr: string): SourceRule {
    const sourceRule = new SourceRule(ruleStr);
    if (ruleStr.startsWith('@CSS:', 0)) {
      sourceRule.isCss = true;
      sourceRule.elementsRule = ruleStr.substring(5).trim();
    } else {
      sourceRule.elementsRule = ruleStr;
    }
    return sourceRule;
  }

  private cloneElements(elements: Element[]): Element[] {
    return elements.map((el) => el.cloneNode(true) as Element);
  }
}

class SourceRule {
  isCss = false;
  elementsRule = '';

  constructor(ruleStr: string) {
    if (ruleStr.startsWith('@CSS:', 0)) {
      this.isCss = true;
      this.elementsRule = ruleStr.substring(5).trim();
    } else {
      this.elementsRule = ruleStr;
    }
  }
}

class ElementsSingle {
  split = '.';
  beforeRule = '';
  indexDefault: (number | null)[] = [];
  indexes: (number | [number | null, number | null, number] | null)[] = [];

  getElementsSingle(temp: Element, rule: string): Element[] {
    this.findIndexSet(rule);
    let elements: Element[] = [];
    if (this.beforeRule === '') {
      elements = Array.from(temp.children);
    } else {
      const rules = this.beforeRule.split('.');
      switch (rules[0]) {
        case 'children':
          elements = Array.from(temp.children);
          break;
        case 'class':
          elements = Array.from(temp.getElementsByClassName(rules[1]));
          break;
        case 'tag':
          elements = Array.from(temp.getElementsByTagName(rules[1]));
          break;
        case 'id':
          elements = Array.from(temp.querySelectorAll(`[id="${rules[1]}"]`));
          break;
        case 'text':
          elements = Array.from(temp.querySelectorAll(`:contains("${rules[1]}")`));
          break;
        default:
          elements = Array.from(temp.querySelectorAll(this.beforeRule));
          break;
      }
    }
    const len = elements.length;
    const lastIndexes = this.indexDefault.length > 0 ? this.indexDefault.length - 1 : this.indexes.length - 1;
    const indexSet = new Set<number>();
    for (let ix = lastIndexes; ix >= 0; ix--) {
      const index = this.indexes.length === 0 ? this.indexDefault[ix] : this.indexes[ix];
      if (index !== null) {
        this.handleIndex(index, indexSet, len);
      }
    }
    if (this.split === '!') {
      elements = elements.filter((_, pcInt) => !indexSet.has(pcInt));
    } else if (this.split === '.') {
      elements = Array.from(indexSet).map((pcInt) => elements[pcInt]);
    }
    return elements;
  }

  private handleIndex(index: number | (number | null)[], indexSet: Set<number>, len: number) {
    if (Array.isArray(index)) {
      const [startX, endX, stepX] = index;
      const start = startX === null ? 0 : startX >= 0 ? Math.min(startX, len - 1) : Math.max(len + startX, 0);
      const end = endX === null ? len - 1 : endX >= 0 ? Math.min(endX, len - 1) : Math.max(len + endX, 0);
      const step = stepX === null ? 1 : stepX > 0 ? stepX : Math.max(stepX + len, 1);
      for (let i = start; i <= end; i += step) {
        indexSet.add(i);
      }
    } else {
      const it = index;
      if (it !== null && it >= 0 && it < len) {
        indexSet.add(it);
      } else if (it !== null && it < 0 && len >= -it) {
        indexSet.add(it + len);
      }
    }
  }

  private findIndexSet(rule: string): void {
    const rus = rule.trim();
    let len = rus.length;
    let curInt: number | null;
    let curMinus = false;
    const curList: (number | null)[] = [];
    let l = '';
    const head = rus[rus.length - 1] === ']';
    if (head) {
      len--;
      while (len-- >= 0) {
        let rl = rus[len];
        if (rl === ' ') {
          continue;
        }
        if (rl >= '0' && rl <= '9') {
          l = rl + l;
        } else if (rl === '-') {
          curMinus = true;
        } else {
          curInt = l === '' ? null : curMinus ? -parseInt(l) : parseInt(l);
          switch (rl) {
            case ':':
              curList.push(curInt);
              break;
            default:
              if (curList.length === 0) {
                if (curInt === null) {
                  break;
                }
                this.indexes.push(curInt);
              } else {
                this.indexes.push([curInt ?? 0, curList[curList.length - 1] ?? 0, curList.length === 2 ? curList[0] ?? 1 : 1]);
                curList.length = 0;
              }
              if (rl === '!') {
                this.split = '!';
                do {
                  rl = rus[--len];
                } while (len > 0 && rl === ' ');
              }
              if (rl === '[') {
                this.beforeRule = rus.substring(0, len);
                return;
              }
              if (rl !== ',') {
                break;
              }
          }
          l = '';
          curMinus = false;
        }
      }
    } else {
      while (len-- >= 0) {
        const rl = rus[len];
        if (rl === ' ') {
          continue;
        }
        if (rl >= '0' && rl <= '9') {
          l = rl + l;
        } else if (rl === '-') {
          curMinus = true;
        } else {
          if (rl === '!' || rl === '.' || rl === ':') {
            this.indexDefault.push(curMinus ? -parseInt(l) : parseInt(l));
            if (rl !== ':') {
              this.split = rl;
              this.beforeRule = rus.substring(0, len);
              return;
            }
          } else {
            break;
          }
          l = '';
          curMinus = false;
        }
      }
    }
    this.split = ' ';
    this.beforeRule = rus;
  }
}

export default AnalyzeByJSoup;
