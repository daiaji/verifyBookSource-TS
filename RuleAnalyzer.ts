class RuleAnalyzer {
  private queue: string;
  private pos: number = 0;
  private start: number = 0;
  private startX: number = 0;
  private rule: Array<string> = [];
  private step: number = 0;
  public elementsType: string = "";

  constructor(data: string, private code: boolean = false) {
      this.queue = data;
  }

  trim() {
      if (this.queue[this.pos] == '@' || this.queue[this.pos] < '!') {
          this.pos++;
          while (this.queue[this.pos] == '@' || this.queue[this.pos] < '!') this.pos++;
          this.start = this.pos;
          this.startX = this.pos;
      }
  }

  reSetPos() {
      this.pos = 0;
      this.startX = 0;
  }

  private consumeTo(seq: string): boolean {
      this.start = this.pos;
      const offset = this.queue.indexOf(seq, this.pos);
      if (offset != -1) {
          this.pos = offset;
          return true;
      } else return false;
  }

  private consumeToAny(...seq: string[]): boolean {
      let pos = this.pos;
      while (pos != this.queue.length) {
          for (let s of seq) {
              if (this.queue.substring(pos, pos + s.length) === s) {
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
      while (pos != this.queue.length) {
          for (let s of seq) if (this.queue[pos] === s) return pos;
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
          if (pos == this.queue.length) break;
          let c = this.queue[pos++];
          if (c !== '\\') {
              if (c === '\'' && !inDoubleQuote) inSingleQuote = !inSingleQuote;
              else if (c === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;

              if (inSingleQuote || inDoubleQuote) continue;

              if (c === '[') depth++;
              else if (c === ']') depth--;
              else if (depth === 0) {
                  if (c === open) otherDepth++;
                  else if (c === close) otherDepth--;
              }
          } else pos++;
      } while (depth > 0 || otherDepth > 0);

      if (depth > 0 || otherDepth > 0) return false;
      else {
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
          if (pos == this.queue.length) break;
          let c = this.queue[pos++];
          if (c === '\'' && !inDoubleQuote) inSingleQuote = !inSingleQuote;
          else if (c === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;

          if (inSingleQuote || inDoubleQuote) continue;
          else if (c === '\\') {
              pos++;
              continue;
          }

          if (c === open) depth++;
          else if (c === close) depth--;
      } while (depth > 0);

      if (depth > 0) return false;
      else {
          this.pos = pos;
          return true;
      }
  }

  splitRule(...split: string[]): Array<string> {
      if (split.length === 1) {
          this.elementsType = split[0];
          if (!this.consumeTo(this.elementsType)) {
              this.rule.push(this.queue.substring(this.startX));
              return this.rule;
          } else {
              this.step = this.elementsType.length;
              return this.splitRuleNext();
          }
      } else if (!this.consumeToAny(...split)) {
          this.rule.push(this.queue.substring(this.startX));
          return this.rule;
      }

      let end = this.pos;
      this.pos = this.start;

      do {
          let st = this.findToAny('[', '(');
          if (st === -1) {
              this.rule = [this.queue.substring(this.startX, end)];
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
              this.rule = [this.queue.substring(this.startX, end)];
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
          let next = this.queue[this.pos] === '[' ? ']' : ')';

          if (!this.chompBalanced(this.queue[this.pos], next)) throw Error(
              this.queue.substring(0, this.start) + "后未平衡"
          );

      } while (end > this.pos);

      this.start = this.pos;
      return this.splitRule(...split);
  }

  private splitRuleNext(): Array<string> {
    let end = this.pos;
    this.pos = this.start;

    do {
        let st = this.findToAny('[', '(');
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
                return this.splitRuleNext();
            } else {
                this.rule.push(this.queue.substring(this.pos));
                return this.rule;
            }
        }

        this.pos = st;
        let next = this.queue[this.pos] === '[' ? ']' : ')';

        if (!this.chompBalanced(this.queue[this.pos], next)) throw Error(
            this.queue.substring(0, this.start) + "后未平衡"
        );

    } while (end > this.pos);

    this.start = this.pos;
    if (this.consumeTo(this.elementsType)) {
        return this.splitRuleNext();
    } else {
        this.rule.push(this.queue.substring(this.startX));
        return this.rule;
    }
}

  innerRule(
      inner: string,
      fr: (rule: string) => string | null,
      startStep: number = 1,
      endStep: number = 1,
  ): string {
      let st = "";

      while (this.consumeTo(inner)) {
          let posPre = this.pos;
          if (this.chompCodeBalanced('{', '}')) {
              let frv = fr(this.queue.substring(posPre + startStep, this.pos - endStep));
              if (frv !== null) {
                  st += this.queue.substring(this.startX, posPre) + frv;
                  this.startX = this.pos;
                  continue;
              }
          }
          this.pos += inner.length;
      }

      return this.startX === 0 ? this.queue : st + this.queue.substring(this.startX);
  }

  innerRuleFunc(
      startStr: string,
      endStr: string,
      fr: (rule: string) => string | null
  ): string {
      let st = "";
      while (this.consumeTo(startStr)) {
          this.pos += startStr.length;
          let posPre = this.pos;
          if (this.consumeTo(endStr)) {
              let frv = fr(this.queue.substring(posPre, this.pos));
              st += this.queue.substring(this.startX, posPre - startStr.length) + frv;
              this.pos += endStr.length;
              this.startX = this.pos;
          }
      }
      return this.startX === 0 ? this.queue : st + this.queue.substring(this.startX);
  }

  chompBalanced = this.code ? this.chompCodeBalanced : this.chompRuleBalanced;
}

export default RuleAnalyzer;