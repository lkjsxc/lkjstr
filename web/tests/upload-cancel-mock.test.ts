import { afterEach, expect, it, vi } from 'vitest';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import type { FromEngine } from '../src/engine/protocol.ts';

afterEach(() => vi.useRealTimers());
it('the mock stops delayed progress and produces one explicit cancellation', async () => {
  vi.useFakeTimers();
  const messages: FromEngine[] = [];
  const engine = createMockEngine((m) => messages.push(m));
  try {
    engine.handle({
      t: 'configure',
      config: { language: 'en', heuristics: true, prefetch: true, mock: { live: false } },
    });
    const as = messages.find((m) => m.t === 'accounts')?.active ?? '';
    engine.handle({
      t: 'act',
      req: 'cancel-fixture',
      action: { a: 'upload', as, name: 'fail.png', mime: 'image/png', bytes: new ArrayBuffer(4) },
    });
    engine.handle({ t: 'upload.cancel', req: 'cancel-fixture' });
    engine.handle({ t: 'upload.cancel', req: 'cancel-fixture' });
    const progress = messages.filter((m) => m.t === 'progress').length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(messages.filter((m) => m.t === 'result' && m.req === 'cancel-fixture')).toEqual([
      { t: 'result', req: 'cancel-fixture', ok: false, cancelled: true },
    ]);
    expect(messages.filter((m) => m.t === 'progress')).toHaveLength(progress);
  } finally {
    engine.dispose();
  }
});
