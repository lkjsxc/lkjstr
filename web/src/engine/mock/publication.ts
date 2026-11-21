import type { Delivery, FromEngine } from '../protocol.ts';
import type { Core } from './engine.ts';

/** How the mock's write relays answer a publish: two at once, one slowly, one with a refusal. */
const RELAYS: readonly (readonly [
  url: string,
  ms: number,
  state: Delivery['state'],
  message?: string,
])[] = [
  ['wss://relay.example.jp', 180, 'ok'],
  ['wss://nos.example.net', 420, 'ok'],
  ['wss://slow.example.org', 2400, 'ok'],
  ['wss://down.example.net', 900, 'failed', 'connection refused'],
];

export function createDelivery({ post, later }: Core) {
  /** Plays a publish's per-relay answers (`late`: that much later each). As in the engine, the first acceptance ends
   * the action and the note's pending mark while the rest answer on; `quiet`: nobody answers, ending unconfirmed. */
  return (
    req: string,
    extra: { id?: string } = {},
    after?: () => void,
    late = 0,
    outcome: 'normal' | 'unanswered' | 'refused' = 'normal',
  ): void => {
    const quiet = outcome === 'unanswered';
    const refused = outcome === 'refused';
    const relays: Delivery[] = RELAYS.map(([url]) => ({ url, state: 'pending' }));
    let settled = false;
    const settle = (result: Partial<Extract<FromEngine, { t: 'result' }>> = {}): void => {
      settled = true;
      after?.();
      post({ t: 'result', req, ok: true, delivery: [...relays], ...extra, ...result });
    };
    post({ t: 'delivery', req, relays: [...relays] });
    RELAYS.forEach(([url, ms, state, message], i) =>
      later((quiet ? 1500 : ms) + late, () => {
        relays[i] = quiet
          ? { url, state: 'timeout' }
          : refused
            ? { url, state: 'failed', message: 'blocked: relay policy' }
            : { url, state, message };
        if (!settled && relays[i].state === 'ok') settle();
        post({ t: 'delivery', req, relays: [...relays] });
        if (!settled && relays.every((r) => r.state !== 'pending'))
          settle({ ok: false, error: quiet ? undefined : { code: 'rejected' } });
      }),
    );
  };
}
