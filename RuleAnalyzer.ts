class RuleAnalyzer {
  private queue: string;
  private pos: number;
  private start: number;
  private startX: number;
  private rule: string[];
  private step: number;
  private elementsType: string;
  private code: boolean;

  constructor(data: string, code: boolean = false) {
    this.queue = data;
    this.pos = 0;
    this.start = 0;
    this.startX = 0;
    this.rule = [];
    this.step = 0;
    this.elementsType = "";
    this.code = code;
  }

  private trim(): void {
    while (
      (this.queue[this.pos] === "@" || this.queue[this.pos] < "!") &&
      this.pos < this.queue.length
    ) {
      this.pos++;
    }
    this.start = this.pos;
    this.startX = this.pos;
  }

  private reSetPos(): void {
    this.pos = 0;
    this.startX = 0;
  }

  private consumeTo(seq: string): boolean {
    this.start = this.pos;
    const offset = this.queue.indexOf(seq, this.pos);
    if (offset !== -1) {
      this.pos = offset;
      return true;
    }
    return false;
  }

  private consumeToAny(...seq: string[]): boolean {
    let pos = this.pos;
    while (pos < this.queue.length) {
      for (const s of seq) {
        if (this.queue.startsWith(s, pos)) {
          this.step = s.length;
          this.pos = pos;
          return true;
        }
      }
      pos++;
    }
    return false;
  }

  private findToAny(...seq: string[]): number {
    let pos = this.pos;
    while (pos < this.queue.length) {
      for (const s of seq) {
        if (this.queue[pos] === s) {
          return pos;
        }
      }
      pos++;
    }
    return -1;
  }

  private chompCodeBalanced(open: string, close: string): boolean {
    let pos = this.pos;
    let depth = 0;
    let otherDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    do {
      if (pos >= this.queue.length) break;
      const c = this.queue[pos++];
      if (c !== "\\") {
        if (c === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        } else if (c === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        }

        if (inSingleQuote || inDoubleQuote) continue;

        if (c === "[") {
          depth++;
        } else if (c === "]") {
          depth--;
        } else if (depth === 0) {
          if (c === open) {
            otherDepth++;
          } else if (c === close) {
            otherDepth--;
          }
        }
      }
    } while (depth > 0 || otherDepth > 0);

    if (depth > 0 || otherDepth > 0) {
      return false;
    } else {
      this.pos = pos;
      return true;
    }
  }

  private chompRuleBalanced(open: string, close: string): boolean {
    let pos = this.pos;
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    do {
      if (pos >= this.queue.length) break;
      const c = this.queue[pos++];
      if (c === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (c === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }

      if (inSingleQuote || inDoubleQuote) continue;
      else if (c === "\\") {
        pos++;
        continue;
      }

      if (c === open) {
        depth++;
      } else if (c === close) {
        depth--;
      }
    } while (depth > 0);

    if (depth > 0) {
      return false;
    } else {
      this.pos = pos;
      return true;
    }
  }

  private splitRule(...split: string[]): string[] {
    if (split.length === 1) {
      this.elementsType = split[0];
      if (!this.consumeTo(this.elementsType)) {
        this.rule.push(this.queue.substring(this.startX));
        return this.rule;
      } else {
        this.step = this.elementsType.length;
        return this.splitRule();
      }
    } else if (!this.consumeToAny(...split)) {
      this.rule.push(this.queue.substring(this.startX));
      return this.rule;
    }

    const end = this.pos;
    this.pos = this.start;

    do {
      const st = this.findToAny("[", "(");

      if (st === -1) {
        this.rule.push(this.queue.substring(this.startX, end));
        this.elementsType = this.queue.substring(end, end + this.step);
        this.pos = end + this.step;

        while (this.consumeTo(this.elementsType)) {
          this.rule.push(this.queue.substring(this.start, this.pos));
          this.pos += this.step;
        }

        this.rule.push(this.queue.substring(this.pos));
        return this.rule;
      }

      if (st > end) {
        this.rule.push(this.queue.substring(this.startX, end));
        this.elementsType = this.queue.substring(end, end + this.step);
        this.pos = end + this.step;

        while (this.consumeTo(this.elementsType) && this.pos < st) {
          this.rule.push(this.queue.substring(this.start, this.pos));
          this.pos += this.step;
        }

        if (this.pos > st) {
          this.startX = this.start;
          return this.splitRule();
        } else {
          this.rule.push(this.queue.substring(this.pos));
          return this.rule;
        }
      }

      this.pos = st;
      const next = this.queue[this.pos] === "[" ? "]" : ")";

      if (!this.chompCodeBalanced(this.queue[this.pos], next)) {
        throw new Error(`${this.queue.substring(0, this.start)}后未平衡`);
      }
    } while (end > this.pos);

    this.start = this.pos;
    return this.splitRule(...split);
  }

  public innerRule(
    startStr: string,
    endStr: string,
    fr: (str: string) => string | null
  ): string {
    const st: string[] = [];
    while (this.consumeTo(startStr)) {
      this.pos += startStr.length;
      const posPre = this.pos;
      if (this.consumeTo(endStr)) {
        const frv = fr(this.queue.substring(posPre, this.pos));
        if (frv !== null && frv !== undefined) {
          st.push(
            this.queue.substring(this.startX, posPre - startStr.length) + frv
          );
          this.pos += endStr.length;
          this.startX = this.pos;
        }
      }
    }

    return this.startX === 0
      ? this.queue
      : st.join("") + this.queue.substring(this.startX);
  }

  public splitRuleNext(): string[] {
    const end = this.pos;
    this.pos = this.start;

    do {
      const st = this.findToAny("[", "(");

      if (st === -1) {
        this.rule.push(this.queue.substring(this.startX, end));
        this.pos = end + this.step;

        while (this.consumeTo(this.elementsType)) {
          this.rule.push(this.queue.substring(this.start, this.pos));
          this.pos += this.step;
        }

        this.rule.push(this.queue.substring(this.pos));
        return this.rule;
      }

      if (st > end) {
        this.rule.push(this.queue.substring(this.startX, end));
        this.pos = end + this.step;

        while (this.consumeTo(this.elementsType) && this.pos < st) {
          this.rule.push(this.queue.substring(this.start, this.pos));
          this.pos += this.step;
        }

        if (this.pos > st) {
          this.startX = this.start;
          return this.splitRule();
        } else {
          this.rule.push(this.queue.substring(this.pos));
          return this.rule;
        }
      }

      this.pos = st;
      const next = this.queue[this.pos] === "[" ? "]" : ")";

      if (!this.chompCodeBalanced(this.queue[this.pos], next)) {
        throw new Error(`${this.queue.substring(0, this.start)}后未平衡`);
      }
    } while (end > this.pos);

    this.start = this.pos;
    if (!this.consumeTo(this.elementsType)) {
      this.rule.push(this.queue.substring(this.startX));
      return this.rule;
    } else {
      return this.splitRule();
    }
  }
}
