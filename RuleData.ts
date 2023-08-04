import { RuleDataInterface } from './RuleDataInterface';

class RuleData implements RuleDataInterface {
  variableMap: Map<string, string>;

  constructor() {
    this.variableMap = new Map();
  }

  putVariable(key: string, value: string | null): boolean {
    if (value === null) {
      this.variableMap.delete(key);
      return true;
    } else {
      this.variableMap.set(key, value);
      return false;
    }
  }

  putBigVariable(key: string, value: string | null): void {
    if (value === null) {
      this.variableMap.delete(key);
    } else {
      this.variableMap.set(key, value);
    }
  }

  getVariable(): string {
    return JSON.stringify(Array.from(this.variableMap.entries()));
  }

  getBigVariable(key: string): string | null {
    return this.variableMap.get(key) || null;
  }
}
