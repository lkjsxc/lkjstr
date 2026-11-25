import { afterEach, expect, it, vi } from 'vitest';
import type { Quote } from '../src/engine/protocol.ts';
import { t } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { disposeLinkCards } from '../src/views/link-cards.ts';
import { quoteCard } from '../src/views/note-quote.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { note } from './public-snapshots-support.ts';

const url = 'https://news.example/story';
const image = 'https://images.example/photo.png';
const quote: Quote = {
  state: 'ok',
  id: 'quoted',
  author: note().author,
  at: 1000,
  media: [{ type: 'image', url: image, w: 640, h: 360 }],
  segments: [
    { k: 'text', text: 'Photo and story' },
    { k: 'mention', pubkey: note().author.pubkey, name: 'Known person' },
    { k: 'link', url, text: 'Story' },
    { k: 'emoji', code: 'wave', url: image },
  ],
  previews: [{ source: url, url, kind: 'page', title: 'The story' }],
  nextId: 'further',
};

afterEach(() => {
  disposeLinkCards(document.body);
  document.body.replaceChildren();
  localStorage.clear();
});

it('renders the quoted photo, link card, mention and custom emoji with a single further reference', () => {
  const open = vi.fn();
  const env = { instance: 'quote-test', settings: createSettings(), open } as unknown as ViewEnv;
  const card = quoteCard(quote, env, 'outer');
  document.body.append(card);
  expect(card.querySelector('.media.n1 img')?.getAttribute('src')).toBe(image);
  expect(card.querySelector('.link-card')?.getAttribute('href')).toBe(url);
  expect(card.querySelector('.link-card .lctitle')?.textContent).toBe('The story');
  expect(card.querySelector('.qtext button')?.textContent).toBe('@Known person');
  expect(card.querySelector('.qtext img.emo')?.getAttribute('alt')).toBe(':wave:');
  expect(card.querySelector('.quote')).toBeNull();
  card.querySelector<HTMLButtonElement>('button.clip')?.click();
  expect(open.mock.calls).toEqual([['thread', { id: 'further' }, expect.any(Object)]]);
});

it('creates no quoted media or preview wants until the warning opens', () => {
  const env = { instance: 'quote-test', settings: createSettings() } as unknown as ViewEnv;
  const card = quoteCard({ ...quote, cw: 'Warning' }, env, 'outer');
  document.body.append(card);
  expect(card.querySelector('.media, .link-card, [data-previews]')).toBeNull();
  card.querySelector<HTMLButtonElement>('.cw')?.click();
  expect(card.querySelector('[data-previews="quoted"] .media img')).not.toBeNull();
  expect(card.querySelector('[data-previews="quoted"] .link-card')).not.toBeNull();
  const missing = quoteCard({ state: 'missing', id: 'old' }, env, 'outer');
  expect(missing.textContent).toBe(t('quote.missing'));
  expect(missing.children).toHaveLength(0);
});
