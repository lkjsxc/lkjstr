export type SettingValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json';

export type SettingRecord = {
  readonly key: string;
  readonly namespace: string;
  readonly label: string;
  readonly description: string;
  readonly valueType: SettingValueType;
  readonly defaultValue: unknown;
  readonly value: unknown;
  readonly searchableText: string;
  readonly requiresReload: boolean;
  readonly sensitive: boolean;
  readonly updatedAt: number;
  readonly options?: readonly string[];
};
