import cheerio from 'cheerio';
import xpath, { SelectedValue } from 'xpath';
import { DOMParser } from 'xmldom';
import RuleAnalyzer from './RuleAnalyzer';

class AnalyzeByXPath {
    private dom: any;

    constructor(doc: any) {
        if (typeof doc === 'string') {
            this.dom = this.strToDom(doc);
        } else {
            this.dom = doc;
        }
    }

    private strToDom(html: string): any {
        let html1 = html;
        if (html1.endsWith("</td>")) {
            html1 = "<tr>${html1}</tr>";
        }
        if (html1.endsWith("</tr>") || html1.endsWith("</tbody>")) {
            html1 = "<table>${html1}</table>";
        }
        if (html1.trim().startsWith("<?xml")) {
            const doc = new DOMParser().parseFromString(html1);
            return doc;
        }
        return cheerio.load(html1);
    }

    private getResult(xPath: string): any[] {
        const nodesXPath = xpath.select(xPath, this.dom) as SelectedValue;
        if (Array.isArray(nodesXPath)) {
            return nodesXPath;
        }
        return [];
    }

    getElements(xPath: string): any[] {
        if (!xPath) return [];

        const analyzedNodes: any[] = [];
        const ruleAnalyzes = new RuleAnalyzer(xPath);
        const rules = ruleAnalyzes.splitRule("&&", "||", "%%");

        if (rules.length === 1) {
            return this.getResult(rules[0]);
        } else {
            const results: any[][] = [];
            for (const rl of rules) {
                const temp = this.getElements(rl);
                if (temp && temp.length > 0) {
                    results.push(temp);
                    if (temp.length > 0 && ruleAnalyzes.elementsType === "||") {
                        break;
                    }
                }
            }
            if (results.length > 0) {
                if ("%%" === ruleAnalyzes.elementsType) {
                    for (let i = 0; i < results[0].length; i++) {
                        for (const temp of results) {
                            if (i < temp.length) {
                                analyzedNodes.push(temp[i]);
                            }
                        }
                    }
                } else {
                    for (const temp of results) {
                        analyzedNodes.push(...temp);
                    }
                }
            }
        }
        return analyzedNodes;
    }

    getStringList(xPath: string): string[] {
        const result: string[] = [];
        const ruleAnalyzes = new RuleAnalyzer(xPath);
        const rules = ruleAnalyzes.splitRule("&&", "||", "%%");

        if (rules.length === 1) {
            const res = this.getResult(xPath);
            for (const node of res) {
                result.push(node.toString());
            }
            return result;
        } else {
            const results: string[][] = [];
            for (const rl of rules) {
                const temp = this.getStringList(rl);
                if (temp.length > 0) {
                    results.push(temp);
                    if (temp.length > 0 && ruleAnalyzes.elementsType === "||") {
                        break;
                    }
                }
            }
            if (results.length > 0) {
                if ("%%" === ruleAnalyzes.elementsType) {
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

    getString(rule: string): string | null {
        const ruleAnalyzes = new RuleAnalyzer(rule);
        const rules = ruleAnalyzes.splitRule("&&", "||");
        if (rules.length === 1) {
            const res = this.getResult(rule);
            if (res && res.length > 0) {
                return res.map(node => node.toString()).join("\n");
            }
            return null;
        } else {
            const textList: string[] = [];
            for (const rl of rules) {
                const temp = this.getString(rl);
                if (temp) {
                    textList.push(temp);
                    if (ruleAnalyzes.elementsType === "||") {
                        break;
                    }
                }
            }
            return textList.join("\n");
        }
    }
}
export default AnalyzeByXPath;
