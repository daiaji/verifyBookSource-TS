import * as jsonpath from 'jsonpath';
import RuleAnalyzer from './RuleAnalyzer';

class AnalyzeByJsonPath {
  private ctx: any;

  constructor(json: any) {
    this.ctx = this.parse(json);
  }

  private parse(json: any): any {
    if (typeof json === 'string') {
      // Assuming json is a stringified JSON object
      return JSON.parse(json);
    } else {
      return json;
    }
  }

  public getString(rule: string): string | null {
    if (rule.length === 0) {
      return null;
    }

    let result: string;
    const ruleAnalyzes = new RuleAnalyzer(rule, true);
    const rules = ruleAnalyzes.splitRule('&&', '||');

    if (rules.length === 1) {
      ruleAnalyzes.reSetPos();

      result = ruleAnalyzes.innerRule('{$.', (it) => this.getString(it));

      if (result.length === 0) {
        try {
          const ob = jsonpath.query(this.ctx, rule);
          result = (ob && Array.isArray(ob) && ob.length > 0) ? ob.join('\n') : '';
        } catch (e) {
          console.log(e);
        }
      }

      return result;
    } else {
      const textList: string[] = [];

      for (const rl of rules) {
        const temp = this.getString(rl);

        if (temp !== null && temp !== '') {
          textList.push(temp);

          if (ruleAnalyzes.elementsType === '||') {
            break;
          }
        }
      }

      return textList.join('\n');
    }
  }

  public getStringList(rule: string): string[] {
    const result: string[] = [];

    if (rule.length === 0) {
      return result;
    }

    const ruleAnalyzes = new RuleAnalyzer(rule, true);
    const rules = ruleAnalyzes.splitRule('&&', '||', '%%');

    if (rules.length === 1) {
      ruleAnalyzes.reSetPos();
      const st = ruleAnalyzes.innerRule('{$.', (it) => this.getString(it));

      if (st.length === 0) {
        try {
          const obj = this.ctx.read(rule);

          if (Array.isArray(obj)) {
            for (const o of obj) {
              result.push(o.toString());
            }
          } else {
            result.push(obj.toString());
          }
        } catch (e) {
          console.log(e);
        }
      } else {
        result.push(st);
      }

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

      return result;
    }
  }

  public getObject(rule: string): any {
    return this.ctx.read(rule);
  }

  public getList(rule: string): any[] {
    const result: any[] = [];

    if (rule.length === 0) {
      return result;
    }

    const ruleAnalyzes = new RuleAnalyzer(rule, true);
    const rules = ruleAnalyzes.splitRule('&&', '||', '%%');

    if (rules.length === 1) {
      try {
        return this.ctx.read(rules[0]);
      } catch (e) {
        console.log(e);
      }
    } else {
      const results: any[][] = [];

      for (const rl of rules) {
        const temp = this.getList(rl);

        if (temp !== null && temp.length > 0) {
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
}

export default AnalyzeByJsonPath;
