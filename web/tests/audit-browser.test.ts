import { expect, it } from 'vitest';
import { rebaseStorageState } from '../scripts/audit-browser.ts';

it('rebases the stored origin while retaining settings, layout and IndexedDB state', () => {
  const snapshot = {
    cookies: [],
    origins: [
      {
        origin: 'http://127.0.0.1:12345',
        localStorage: [
          { name: 'lkjstr:settings', value: '{"textSize":18}' },
          { name: 'lkjstr:layout:main', value: '{"id":"custom-pane"}' },
        ],
        indexedDB: [],
      },
    ],
  };
  const rebased = rebaseStorageState(snapshot, 'http://127.0.0.1:54321');
  expect(rebased.origins[0]?.origin).toBe('http://127.0.0.1:54321');
  expect(rebased.origins[0]?.localStorage).toEqual(snapshot.origins[0]?.localStorage);
  expect(rebased.origins[0]).toMatchObject({ indexedDB: [] });
  expect(snapshot.origins[0]?.origin).toBe('http://127.0.0.1:12345');
});

it('rejects a missing saved origin rather than silently starting clean', () => {
  expect(() =>
    rebaseStorageState({ cookies: [], origins: [] }, 'http://127.0.0.1:54321'),
  ).toThrow();
});
