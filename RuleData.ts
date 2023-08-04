import { RuleDataInterface } from './RuleDataInterface';

export class RuleData implements RuleDataInterface {
  private variableMap: Map<string, string>;

  constructor() {
    this.variableMap = new Map<string, string>();
  }

  putVariable(key: string, value: string | null): boolean {
    if (value === null) {
      this.variableMap.delete(key);
      this.putBigVariable(key, null);
      return true;
    } else if (value.length < 10000) {
      this.variableMap.set(key, value);
      return true;
    } else {
      this.putBigVariable(key, value);
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

  getVariable(key: string): string {
    return this.variableMap.get(key) || this.getBigVariable(key) || '';
  }

  getBigVariable(key: string): string | null {
    return null;
  }

  getVariableMap(): string | null {
    if (this.variableMap.size === 0) {
      return null;
    }
    return JSON.stringify(Array.from(this.variableMap.entries()));
  }
}
