import { expect, it } from 'vitest';
import type { Counts, NoteRow } from '../src/engine/protocol.ts';
import {
  type DurableCounts,
  mergePublicCounts,
  rememberPublicCounts,
} from '../src/engine/public-snapshot-counts.ts';
import { note } from './public-snapshots-support.ts';

type Selection = NonNullable<NonNullable<Counts['context']>['selection']>;
const policy = (id = 'a'.repeat(64), createdAt = '10'): Selection => ({
  account: 'b'.repeat(64),
  id,
  createdAt,
  token: `policy-${id}`,
  committed: true,
});
function row(
  replies: number,
  selection?: Selection,
  context: Partial<NonNullable<Counts['context']>> = {},
): NoteRow {
  const value = note();
  return {
    ...value,
    counts: {
      ...value.counts,
      replies,
      context: { ...value.counts.context!, selection, ...context },
    },
  };
}
it('a committed newer mute or unmute policy can change the coherent reply model', () => {
  const old = row(7, policy());
  const next = row(0, policy('c'.repeat(64), '11'));
  expect(mergePublicCounts(old, next).counts.replies).toBe(0);
  const unmute = row(7, policy('d'.repeat(64), '12'));
  expect(mergePublicCounts(next, unmute).counts.replies).toBe(7);
});
it('a pending policy cannot lower held replies even at a newer contributor generation', () => {
  const old = row(7, policy());
  const pending = row(
    0,
    { ...policy('c'.repeat(64), '11'), committed: false },
    { generation: '2', token: 'next-contributors', current: false },
  );
  expect(mergePublicCounts(old, pending).counts).toEqual(old.counts);
  const committed = row(0, policy('c'.repeat(64), '11'), {
    generation: '2',
    token: 'next-contributors',
  });
  expect(mergePublicCounts(old, committed).counts.replies).toBe(0);
});
it('absent, older and cross-account policy evidence never erases a held selection', () => {
  const old = row(7, policy());
  for (const next of [
    row(0),
    row(0, { account: policy().account, token: 'unfiltered', committed: true }),
    row(0, policy('c'.repeat(64), '9')),
    row(0, { ...policy('c'.repeat(64), '11'), account: 'f'.repeat(64) }),
  ])
    expect(mergePublicCounts(old, next).counts).toEqual(old.counts);
  const unknown = row(7);
  expect(mergePublicCounts(unknown, row(0, policy())).counts.replies).toBe(7);
});
it('replaceable tie ordering and large decimal timestamps are exact', () => {
  const old = row(7, policy('b'.repeat(64), '9007199254740993'));
  expect(
    mergePublicCounts(old, row(0, policy('a'.repeat(64), '9007199254740993'))).counts.replies,
  ).toBe(0);
  expect(
    mergePublicCounts(old, row(0, policy('c'.repeat(64), '9007199254740993'))).counts.replies,
  ).toBe(7);
  expect(
    mergePublicCounts(old, row(0, policy('c'.repeat(64), '9007199254740994'))).counts.replies,
  ).toBe(0);
  for (const at of ['01', '-1', '1e3', '18446744073709551616'])
    expect(mergePublicCounts(old, row(0, policy('a'.repeat(64), at))).counts.replies).toBe(7);
});
it('an identical committed selection permits verified live contributor updates', () => {
  const old = row(7, policy());
  const live = row(6, policy(), { current: false });
  expect(mergePublicCounts(old, live).counts.replies).toBe(6);
  const conflict = row(0, { ...policy(), token: 'changed-without-a-basis-change' });
  expect(mergePublicCounts(old, conflict).counts.replies).toBe(7);
});
it('durable capture does not relabel held replies with an older policy', () => {
  const values: DurableCounts = new Map();
  const old = row(7, policy('b'.repeat(64), '12'));
  rememberPublicCounts([old], values);
  const stale = row(0, policy('a'.repeat(64), '11'), { generation: '2', token: 'new-base' });
  rememberPublicCounts([stale], values);
  expect(values.get(old.id)?.counts).toEqual(old.counts);
  const newPolicy = row(0, policy('a'.repeat(64), '13'), { generation: '2', token: 'new-base' });
  rememberPublicCounts([newPolicy], values);
  expect(values.get(old.id)?.counts).toEqual(newPolicy.counts);
});
