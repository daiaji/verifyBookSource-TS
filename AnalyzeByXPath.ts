import cheerio from 'cheerio';
import RuleAnalyzer from './RuleAnalyzer';

class AnalyzeByXPath {
  private jxNode: cheerio.Cheerio;

  constructor(doc: any) {
    this.jxNode = this.parse(doc);
  }

  private parse(doc: any): cheerio.Cheerio {
    if (doc instanceof cheerio.Cheerio) {
      return doc;
    } else if (doc instanceof cheerio.Element) {
      return cheerio([doc]);
    } else if (Array.isArray(doc)) {
      return cheerio(doc);
    } else if (typeof doc === 'string') {
      let html = doc;
      if (html.endsWith('</td>')) {
        html = `<tr>${html}</tr>`;
      }
      if (html.endsWith('</tr>') || html.endsWith('</tbody>')) {
        html = `<table>${html}</table>`;
      }
      if (html.trim().toLowerCase().startsWith('<?xml')) {
        return cheerio.load(html, { xmlMode: true });
      }
      return cheerio.load(html);
    } else {
      throw new Error('Invalid document type');
    }
  }

  private getResult(xPath: string): cheerio.Cheerio {
    const node = this.jxNode;
    if (node instanceof cheerio.Cheerio) {
      return node.find(xPath);
    } else {
      throw new Error('Invalid node type');
    }
  }

  public getElements(xPath: string): cheerio.Cheerio {
    if (xPath.length === 0) return cheerio();

    const jxNodes: cheerio.Cheerio[] = [];
    const ruleAnalyzes = new RuleAnalyzer(xPath);
    const rules = ruleAnalyzes.splitRule('&&', '||', '%%');

    if (rules.length === 1) {
      return this.getResult(rules[0]);
    } else {
      const results: cheerio.Cheerio[] = [];
      for (const rl of rules) {
        const temp = this.getElements(rl);
        if (temp.length > 0) {
          results.push(temp);
          if (temp.length > 0 && ruleAnalyzes.elementsType === '||') {
            break;
          }
        }
      }
      if (results.length > 0) {
        if (ruleAnalyzes.elementsType === '%%') {
          for (let i = 0; i < results[0].length; i++) {
            for (const temp of results) {
              if (i < temp.length) {
                jxNodes.push(temp.eq(i));
              }
            }
          }
        } else {
          for (const temp of results) {
            jxNodes.push(...temp.toArray());
          }
        }
      }
    }
    return cheerio(jxNodes);
  }

  public getStringList(xPath: string): string[] {
    const result: string[] = [];
    const ruleAnalyzes = new RuleAnalyzer(xPath);
    const rules = ruleAnalyzes.splitRule('&&', '||', '%%');

    if (rules.length === 1) {
      const elements = this.getResult(xPath);
      elements.each((_, element) => {
        result.push(cheerio(element).text());
      });
      return result;
    } else {
      const results: string[][] = [];
      for (const rl of rules) {
        const temp = this.getStringList(rl);
        if (temp.length > 0) {
          results.push(temp);
          if (temp.length > 0 && ruleAnalyzes.elementsType === '||') {
            break;
          }
        }
      }
      if (results.length > 0) {
        if (ruleAnalyzes.elementsType === '%%') {
          for (let i = 0; i < results[0].length; i++) {
            for (const temp of results) {
              if (i < temp.length) {
                result.push(temp[i]);
              }
            }
          }
        } else {
          for (const temp of results) {
            result.push(...temp);
          }
        }
      }
    }
    return result;
  }

  public getString(rule: string): string | null {
    const ruleAnalyzes = new RuleAnalyzer(rule);
    const rules = ruleAnalyzes.splitRule('&&', '||');
    if (rules.length === 1) {
      const elements = this.getResult(rule);
      if (elements.length > 0) {
        return elements.toArray().map((element) => cheerio(element).text()).join('\n');
      }
      return null;
    } else {
      const textList: string[] = [];
      for (const rl of rules) {
        const temp = this.getString(rl);
        if (temp) {
          textList.push(temp);
          if (ruleAnalyzes.elementsType === '||') {
            break;
          }
        }
      }
      return textList.join('\n');
    }
  }
}

export default AnalyzeByXPath;
