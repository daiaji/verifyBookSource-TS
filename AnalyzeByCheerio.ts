import cheerio from 'cheerio';
import RuleAnalyzer from './RuleAnalyzer';

class AnalyzeByCheerio {
  private element: cheerio.Cheerio;

  constructor(doc: any) {
    this.element = this.parse(doc);
  }

  private parse(doc: any): cheerio.Cheerio {
    if (doc instanceof cheerio.Cheerio) {
      return doc;
    }
    if (doc.isElement) {
      return cheerio.load(doc.toString()).root();
    }
    if (doc.toString().startsWith('<?xml', true)) {
      return cheerio.load(doc.toString(), { xmlMode: true }).root();
    }
    return cheerio.load(doc.toString()).root();
  }

  private getElements(temp: cheerio.Cheerio | undefined, rule: string): cheerio.Cheerio {
    if (!temp || rule.length === 0) {
      return cheerio();
    }

    const sourceRule = new SourceRule(rule);
    const ruleAnalyzes = new RuleAnalyzer(sourceRule.elementsRule);
    const ruleStrS = ruleAnalyzes.splitRule('&&', '||', '%%');

    const elementsList: cheerio.Cheerio[] = [];
    if (sourceRule.isCss) {
      for (const ruleStr of ruleStrS) {
        const tempS = temp.find(ruleStr);
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
                let el = cheerio();
                el = el.add(temp);
                for (const rl of rs) {
                  let es = cheerio();
                  el.each((_, et) => {
                    es = es.add(this.getElements(cheerio(et), rl));
                  });
                  el = es;
                }
                return el;
              })()
            : this.getElementsSingle(temp, ruleStr);

        elementsList.push(el);
        if (el.length > 0 && ruleAnalyzes.elementsType === '||') {
          break;
        }
      }
    }

    const elements = cheerio();
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
          elements.push(es);
        }
      }
    }
    return elements;
  }

  private getElementsSingle(temp: cheerio.Cheerio, rule: string): cheerio.Cheerio {
    const indexDefault: number[] = [];
    const indexes: (number | [number?, number?, number?])[] = [];
    let split = '.';
    let beforeRule = '';

    const findIndexSet = (rule: string) => {
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
          if (rl === ' ') continue;

          if (rl >= '0' && rl <= '9') l = rl + l;
          else if (rl === '-') curMinus = true;
          else {
            curInt = l.length === 0 ? null : (curMinus ? -parseInt(l) : parseInt(l));

            switch (rl) {
              case ':':
                curList.push(curInt);
                break;
              default:
                if (curList.length === 0) {
                  if (curInt === null) break;
                  indexes.push(curInt);
                } else {
                  indexes.push([curInt, curList[curList.length - 1], curList.length === 2 ? curList[0] : 1]);
                  curList.length = 0;
                }

                if (rl === '!') {
                  split = '!';
                  do {
                    rl = rus[--len];
                  } while (len > 0 && rl === ' ');
                }

                if (rl === '[') {
                  beforeRule = rus.substring(0, len);
                  return;
                }

                if (rl !== ',') break;
            }

            l = '';
            curMinus = false;
          }
        }
      } else {
        while (len-- >= 0) {
          const rl = rus[len];
          if (rl === ' ') continue;

          if (rl >= '0' && rl <= '9') l = rl + l;
          else if (rl === '-') curMinus = true;
          else {
            if (rl === '!' || rl === '.' || rl === ':') {
              indexDefault.push(curMinus ? -parseInt(l) : parseInt(l));
              if (rl !== ':') {
                split = rl;
                beforeRule = rus.substring(0, len);
                return;
              }
            } else break;

            l = '';
            curMinus = false;
          }
        }
      }

      split = ' ';
      beforeRule = rus;
    };

    findIndexSet(rule);

    let elements: cheerio.Cheerio;
    if (beforeRule.length === 0) {
      elements = temp.children();
    } else {
      const rules = beforeRule.split('.');
      switch (rules[0]) {
        case 'children':
          elements = temp.children();
          break;
        case 'class':
          elements = temp.find(`.${rules[1]}`);
          break;
        case 'tag':
          elements = temp.find(rules[1]);
          break;
        case 'id':
          elements = temp.find(`#${rules[1]}`);
          break;
        case 'text':
          elements = temp.find(`:contains("${rules[1]}")`);
          break;
        default:
          elements = temp.find(beforeRule);
          break;
      }
    }

    const len = elements.length;
    const lastIndexes = indexDefault.length > 0 ? indexDefault.length - 1 : indexes.length - 1;
    const indexSet = new Set<number>();

    if (indexes.length === 0) {
      for (let ix = lastIndexes; ix >= 0; ix--) {
        const it = indexDefault[ix];
        if (it >= 0 && it < len) indexSet.add(it);
        else if (it < 0 && len >= -it) indexSet.add(it + len);
      }
    } else {
      for (let ix = lastIndexes; ix >= 0; ix--) {
        if (Array.isArray(indexes[ix])) {
          const [startX, endX, stepX] = indexes[ix] as [number?, number?, number];
          const start = startX === null ? 0 : (startX >= 0 ? (startX < len ? startX : len - 1) : (-startX <= len ? len + startX : 0));
          const end = endX === null ? len - 1 : (endX >= 0 ? (endX < len ? endX : len - 1) : (-endX <= len ? len + endX : 0));

          if (start === end || stepX >= len) {
            indexSet.add(start);
            continue;
          }

          const step = stepX > 0 ? stepX : (-stepX < len ? stepX + len : 1);
          indexSet.add(...(end > start ? Array.from({ length: Math.ceil((end - start + 1) / step) }, (_, i) => start + i * step) : Array.from({ length: Math.ceil((start - end + 1) / step) }, (_, i) => start - i * step))));
        } else {
          const it = indexes[ix] as number;
          if (it >= 0 && it < len) indexSet.add(it);
          else if (it < 0 && len >= -it) indexSet.add(it + len);
        }
      }
    }

    if (split === '!') {
      elements.each((_, el) => {
        if (indexSet.has(_)) {
          el = null;
        }
      });
      elements = elements.filter((_, el) => el !== null);
    } else if (split === '.') {
      elements = elements.filter((_, el) => indexSet.has(_));
    }

    return elements;
  }

  private getResultLast(elements: cheerio.Cheerio, lastRule: string): string[] {
    const textS: string[] = [];
    switch (lastRule) {
      case 'text':
        elements.each((_, element) => {
          const text = cheerio(element).text().trim();
          if (text.length > 0) {
            textS.push(text);
          }
        });
        break;
      case 'textNodes':
        elements.each((_, element) => {
          const tn: string[] = [];
          const contentEs = cheerio(element).contents().filter((_, el) => el.nodeType === 3);
          contentEs.each((_, item) => {
            const text = cheerio(item).text().trim();
            if (text.length > 0) {
              tn.push(text);
            }
          });
          if (tn.length > 0) {
            textS.push(tn.join('\n'));
          }
        });
        break;
      case 'ownText':
        elements.each((_, element) => {
          const text = cheerio(element).contents().filter((_, el) => el.nodeType === 3).text().trim();
          if (text.length > 0) {
            textS.push(text);
          }
        });
        break;
      case 'html':
        elements.find('script').remove();
        elements.find('style').remove();
        const html = elements.html();
        if (html) {
          textS.push(html);
        }
        break;
      case 'all':
        textS.push(elements.html() ?? '');
        break;
      default:
        elements.each((_, element) => {
          const url = cheerio(element).attr(lastRule);
          if (url && url.trim() !== '' && !textS.includes(url)) {
            textS.push(url);
          }
        });
        break;
    }
    return textS;
  }

  private getResultList(ruleStr: string): string[] | null {
    if (ruleStr.length === 0) {
      return null;
    }

    let elements = cheerio(this.element);

    const rule = new RuleAnalyzer(ruleStr);
    rule.trim();

    const rules = rule.splitRule('@');

    const last = rules.length - 1;
    for (let i = 0; i < last; i++) {
      let es = cheerio();
      elements.each((_, elt) => {
        es = es.add(this.getElements(cheerio(elt), rules[i]));
      });
      elements = es;
    }

    return elements.length === 0 ? null : this.getResultLast(elements, rules[last]);
  }

  private getStringList(ruleStr: string): string[] {
    const textS: string[] = [];

    if (ruleStr.length === 0) {
      return textS;
    }

    const sourceRule = new SourceRule(ruleStr);

    if (sourceRule.elementsRule.length === 0) {
      textS.push(this.element.text().trim());
    } else {
      const ruleAnalyzes = new RuleAnalyzer(sourceRule.elementsRule);
      const ruleStrS = ruleAnalyzes.splitRule('&&', '||', '%%');

      const results: string[][] = [];
      for (const ruleStrX of ruleStrS) {
        let temp: string[] | null;
        if (sourceRule.isCss) {
          const lastIndex = ruleStrX.lastIndexOf('@');
          temp = this.getResultLast(this.element.find(ruleStrX.substring(0, lastIndex)), ruleStrX.substring(lastIndex + 1));
        } else {
          temp = this.getResultList(ruleStrX);
        }

        if (temp && temp.length > 0) {
          results.push(temp);
          if (ruleAnalyzes.elementsType === '||') break;
        }
      }

      if (results.length > 0) {
        if ('%%' === ruleAnalyzes.elementsType) {
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

  public getElements(rule: string): cheerio.Cheerio {
    return this.getElements(this.element, rule);
  }

  public getString(ruleStr: string): string | null {
    if (ruleStr.length === 0) {
      return null;
    }

    const stringList = this.getStringList(ruleStr);
    return stringList.length > 0 ? stringList.join('\n') : null;
  }

  public getString0(ruleStr: string): string {
    const stringList = this.getStringList(ruleStr);
    return stringList.length > 0 ? stringList[0] : '';
  }
}

class SourceRule {
  public isCss: boolean;
  public elementsRule: string;

  constructor(ruleStr: string) {
    this.isCss = false;
    this.elementsRule = ruleStr.startsWith('@CSS:', true) ? ruleStr.substring(5).trim() : ruleStr;
  }
}

export default AnalyzeByCheerio;