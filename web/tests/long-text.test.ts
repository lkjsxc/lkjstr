// Text a row cuts keeps its whole self in a tooltip. That nothing reaches past its row is a layout fact, checked in
// the browser on the mock's stress world (scripts/smoke-stress.ts).
import { afterEach, expect, it } from 'vitest';
import type { Author } from '../src/engine/protocol.ts';
import { setLang, t } from '../src/shared/i18n.ts';
import { nameButton, nipMark } from '../src/views/parts.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => setLang('en'));
const long = `Sam_Rivera_builds_small_tools_${'x'.repeat(200)}`;
const author = {
  pubkey: 'a'.repeat(64),
  npub: `npub1${'q'.repeat(58)}`,
  name: `${long} :neko:`,
  nip05: `${'n'.repeat(80)}@example.com`,
  verified: true,
} as Author;

it('a name says itself whole, then who it is, and is isolated from the text around it', () => {
  const name = nameButton(author, {} as ViewEnv);
  expect(name.title).toBe(`${long}\n${author.nip05}`);
  expect(name.getAttribute('dir')).toBe('auto');
  expect(nameButton({ ...author, nip05: undefined }, {} as ViewEnv).title).toBe(
    `${long}\n${author.npub}`,
  );
});

it('an address says itself whole, then whether it was checked', () => {
  expect(nipMark(author)?.title).toBe(`${author.nip05}\n${t('nip05.ok')}`);
  expect(nipMark({ ...author, verified: false })?.title).toBe(
    `${author.nip05}\n${t('nip05.unchecked')}`,
  );
});
