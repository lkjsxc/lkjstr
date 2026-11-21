import { expect, it } from 'vitest';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import type { FromEngine, NoteRow } from '../src/engine/protocol.ts';

it('keeps reveals scoped and covered bodies out of full windows as well as patches', () => {
  const messages: FromEngine[] = [];
  const engine = createMockEngine((message) => messages.push(message));
  engine.handle({
    t: 'configure',
    config: { language: 'en', heuristics: true, prefetch: true, mock: { live: false } },
  });
  const lastRows = () => messages.findLast((message) => message.t === 'rows');
  const request = (sub: string) =>
    engine.handle({ t: 'window', sub, anchor: 'top', before: 0, after: 60 });
  for (const sub of ['a', 'b']) {
    engine.handle({ t: 'open', sub, query: { source: 'global' } });
    request(sub);
  }
  const covered = (lastRows()?.rows ?? []).find(
    (row): row is NoteRow => row.kind === 'note' && row.hidden?.reason === 'muted-person',
  );
  expect(covered).toMatchObject({ segments: [], media: [], quotes: [] });
  const key = covered?.key ?? '';
  engine.handle({
    t: 'act',
    req: 'show',
    action: { a: 'note.reveal', sub: 'a', key, reveal: true },
  });
  expect(messages.findLast((message) => message.t === 'result')?.ok).toBe(true);
  request('a');
  expect(lastRows()?.rows.find((row) => row.key === key)).toMatchObject({
    revealed: { reason: 'muted-person' },
  });
  request('b');
  expect(lastRows()?.rows.find((row) => row.key === key)).toMatchObject({
    hidden: { reason: 'muted-person' },
    segments: [],
  });
  engine.dispose();
});
