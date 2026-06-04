import { expect, test } from '@playwright/test';
import {
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';

test('scan optimizer debug exposes real storage and WASM bridge state', async ({
  page,
}) => {
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await page.waitForFunction(() =>
    Boolean(
      (
        window as Window & {
          __lkjstrDebug?: { readonly scanOptimizerSnapshot?: unknown };
        }
      ).__lkjstrDebug?.scanOptimizerSnapshot,
    ),
  );
  const snapshot = await page.evaluate(async () => {
    const debug = (
      window as Window & {
        __lkjstrDebug?: {
          readonly scanOptimizerSnapshot?: () => Promise<{
            readonly storageMode: string;
            readonly wasmBridge: { readonly state: string };
          }>;
        };
      }
    ).__lkjstrDebug;
    return debug?.scanOptimizerSnapshot?.();
  });
  expect(snapshot).toBeTruthy();
  expect(snapshot?.wasmBridge.state).toBe('available');
  expect(['persistent-opfs', 'temporary-memory', 'unavailable']).toContain(
    snapshot?.storageMode,
  );
});
