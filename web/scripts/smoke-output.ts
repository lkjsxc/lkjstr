import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultOutput = fileURLToPath(new URL('../../tmp/', import.meta.url));

export function smokePath(name: string): string {
  return resolve(process.env.LKJSTR_SMOKE_OUTPUT ?? defaultOutput, name);
}
