// Select one existing mock answer for a named A1 scene; the product has no screenshot configuration.
import type { Page } from 'playwright-core';
import type { FromEngine, NotificationRow } from '../src/engine/protocol.ts';

export async function actNotificationScene(page: Page, scene: string): Promise<void> {
  const workers = page.workers();
  if (workers.length !== 1) throw new Error('expected one actual mock Worker');
  await workers[0]!.evaluate((scene) => {
    const scope = self as unknown as { postMessage(message: FromEngine): void };
    const original = scope.postMessage.bind(scope);
    const frozen = new Set<string>(); // bound: the few notification subscriptions of this fresh scene
    const choose = (row: NotificationRow): boolean => {
      if (scene === 'notif-act-reaction')
        return row.type === 'reaction' && row.target?.act?.type === 'reaction';
      if (scene === 'notif-act-repost')
        return row.type === 'reaction' && row.target?.act?.type === 'repost';
      if (scene === 'notif-act-missing') return row.pendingAct?.state === 'missing';
      return row.pendingAct?.state === 'loading';
    };
    scope.postMessage = (message) => {
      if (message.t === 'rows' && message.rows.some((row) => row.kind === 'notification')) {
        let selected = message.rows.find(
          (row): row is NotificationRow => row.kind === 'notification' && choose(row),
        );
        if (!selected) throw new Error('named act scene is absent from the mock answer');
        if (scene === 'notif-act-failed' && selected.pendingAct)
          selected = { ...selected, pendingAct: { ...selected.pendingAct, state: 'failed' } };
        if (frozen.size >= 8 && !frozen.has(message.sub))
          throw new Error('act screenshot subscription bound exceeded');
        frozen.add(message.sub);
        original({ ...message, rows: [selected] });
      } else if (!(message.t === 'patch' && frozen.has(message.sub))) {
        original(message);
      }
    };
  }, scene);
  // The desktop preset already mounted Notifications before this fixture was installed.
  // Close its actual tab so the ordinary launcher creates a fresh subscribed view.
  const tabs = page.locator('.tab[data-view^="notifications"]');
  for (const tab of await tabs.all()) await tab.click({ button: 'middle' });
}
