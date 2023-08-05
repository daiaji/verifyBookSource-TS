export class AnalyzeByRegex {
  public static async getElement(
    res: string,
    regs: string[],
    index: number = 0
  ): Promise<string[] | null> {
    let vIndex = index;
    const resM = new RegExp(regs[vIndex]).exec(res);
    if (!resM) {
      return null;
    }

    if (vIndex + 1 === regs.length) {
      const info: string[] = [];
      for (const group of resM) {
        info.push(group);
      }
      return info;
    } else {
      let result = '';
      do {
        result += resM[0];
      } while ((resM as RegExpExecArray).index !== undefined && (resM as RegExpExecArray).index < res.length && (resM as RegExpExecArray).index !== null && (resM as RegExpExecArray).index !== -1 && resM[0] !== '');
      return AnalyzeByRegex.getElement(result, regs, ++vIndex);
    }
  }

  public static async getElements(
    res: string,
    regs: string[],
    index: number = 0
  ): Promise<string[][]> {
    let vIndex = index;
    const resM = new RegExp(regs[vIndex]).exec(res);
    if (!resM) {
      return [];
    }

    if (vIndex + 1 === regs.length) {
      const books: string[][] = [];
      do {
        const info: string[] = [];
        for (const group of resM) {
          info.push(group || '');
        }
        books.push(info);
      } while ((resM as RegExpExecArray).index !== undefined && (resM as RegExpExecArray).index < res.length && (resM as RegExpExecArray).index !== null && (resM as RegExpExecArray).index !== -1 && resM[0] !== '');
      return books;
    } else {
      let result = '';
      do {
        result += resM[0];
      } while ((resM as RegExpExecArray).index !== undefined && (resM as RegExpExecArray).index < res.length && (resM as RegExpExecArray).index !== null && (resM as RegExpExecArray).index !== -1 && resM[0] !== '');
      return AnalyzeByRegex.getElements(result, regs, ++vIndex);
    }
  }
}
export default AnalyzeByRegex;