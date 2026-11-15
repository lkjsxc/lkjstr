import { vi } from 'vitest';
import type { ActResult, Engine, SubHandlers } from '../src/engine/client.ts';
import type { Author, Query } from '../src/engine/protocol.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';

let serial = 0;
export const person: Author = {
  pubkey: 'a'.repeat(64),
  npub: 'npub1test',
  name: 'Alice',
  nip05: 'alice@example.test',
};
export function setup() {
  const requests: { query: Query; handlers: SubHandlers; closed: boolean }[] = [];
  const act = vi.fn(() => Promise.resolve({ t: 'result', req: 'r', ok: true } as ActResult));
  const engine = {
    accounts: createSignal({
      active: person.pubkey,
      accounts: [{ author: person, signer: 'local', unread: 0 }],
    }),
    info: createSignal({ engine: 'test', version: 5 }),
    me: () => person.pubkey,
    act,
    open(query: Query, handlers: SubHandlers) {
      const entry = { query, handlers, closed: false };
      requests.push(entry);
      return {
        window() {
          if (query.source === 'people')
            queueMicrotask(() => {
              if (!entry.closed)
                handlers.rows(
                  [
                    {
                      kind: 'person',
                      key: person.pubkey,
                      author: person,
                      about: '',
                      followed: true,
                      followsYou: false,
                      self: false,
                    },
                  ],
                  true,
                  true,
                );
            });
        },
        visible() {},
        close() {
          entry.closed = true;
        },
      };
    },
  } as unknown as Engine;
  const visible = createSignal(true);
  const env = {
    engine,
    instance: `wish-test-${++serial}`,
    visible,
    settings: createSettings(),
    layer: document.createElement('div'),
  } as unknown as ViewEnv;
  const el = document.createElement('div');
  document.body.append(el, env.layer);
  return { env, el, engine, requests, act, visible };
}
