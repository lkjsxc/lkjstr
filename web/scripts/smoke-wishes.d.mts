import type { Browser } from 'playwright-core';
export function wishes(options: {
  browser: Browser;
  base: string;
  check(name: string, ok: boolean): void;
}): Promise<void>;
