import { describe, expect, it } from 'vitest';
import type { NoteRow } from '../src/engine/protocol.ts';
import { clientName, safeSite, stamp } from '../src/views/note-via.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const env = { engine: { info: { get: () => ({ version: 15 }) } } } as unknown as ViewEnv;
const row = (client?: string, clientAddress?: string) =>
  ({
    kind: 'note',
    id: 'n',
    key: 'n',
    at: 0,
    author: { pubkey: 'a'.repeat(64), name: 'Ann' },
    client,
    clientAddress,
  }) as unknown as NoteRow;
const via = (r: NoteRow) =>
  (stamp(r, env, '12:00') as HTMLElement[]).find((e) => e.classList?.contains('via'));

describe('via <client>', () => {
  it('draws relay text as plain, bounded text', () => {
    expect(clientName('Totally‮ Official\u0007   Client')).toBe('Totally Official Client');
    expect(clientName('x'.repeat(500))).toHaveLength(128);
    expect(clientName('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>'); // text, never markup
    const hostile = via(row('<b>bold</b>'));
    expect(hostile?.textContent).toBe('via <b>bold</b>');
    expect(hostile?.querySelector('b')).toBeNull();
    const long = via(row('L'.repeat(100)));
    expect(long?.textContent?.length).toBeLessThanOrEqual(4 + 48);
    expect(long?.getAttribute('aria-label')).toBe(`Written with ${'L'.repeat(100)}`);
  });
  it('is absent without a tag, plain text without a handler, a button with a well-formed one', () => {
    expect(via(row())).toBeUndefined();
    expect(via(row('   '))).toBeUndefined();
    expect(via(row('bot'))?.tagName).toBe('SPAN');
    expect(via(row('lkjstr', `31990:${'a'.repeat(64)}:lkjstr`))?.tagName).toBe('BUTTON');
  });
  it('never cuts a character in two', () => {
    const name = `${'a'.repeat(46)}👩‍💻 and more`;
    const shown = via(row(name))?.textContent ?? '';
    expect(shown).toBe(`via ${'a'.repeat(46)}👩‍💻…`);
    expect(clientName(`${'b'.repeat(127)}😀😀`)).toBe(`${'b'.repeat(127)}😀`);
  });
  it('offers only an http or https website', () => {
    expect(safeSite('https://lkjstr.lkjsxc.com')?.host).toBe('lkjstr.lkjsxc.com');
    expect(safeSite('javascript:alert(1)')).toBeUndefined();
    expect(safeSite('data:text/html,x')).toBeUndefined();
    expect(safeSite(undefined)).toBeUndefined();
  });
});
