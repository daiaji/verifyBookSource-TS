export interface RuleDataInterface {
  variableMap: Map<string, string>;

  putVariable(key: string, value: string | null): boolean;

  putBigVariable(key: string, value: string | null): void;

  getVariable(): string;

  getBigVariable(key: string): string | null;
}
export default RuleDataInterface;