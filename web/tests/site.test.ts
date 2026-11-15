// @vitest-environment node
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { buildPublicPages, ORIGIN, PAGE_IDS } from '../scripts/site.ts';
import { setLang, t } from '../src/shared/i18n.ts';
import { KEYS } from '../src/shared/keys.ts';

const out = join(import.meta.dirname, '../../tmp/site-test');
const parse = (html: string) => {
  const window = new Window();
  window.document.write(html);
  return window.document;
};
describe('public documentation build', () => {
  it('emits paired, script-free pages with complete metadata and shared app prose', () => {
    mkdirSync(out, { recursive: true });
    buildPublicPages(out);
    expect(readdirSync(join(out, 'en')).sort()).toEqual(readdirSync(join(out, 'ja')).sort());
    const sitemap = readFileSync(join(out, 'sitemap.txt'), 'utf8');
    expect(sitemap).toBe(
      [
        `${ORIGIN}/`,
        `${ORIGIN}/privacy.html`,
        ...['en', 'ja'].flatMap((lang) => PAGE_IDS.map((id) => `${ORIGIN}/${lang}/${id}.html`)),
        '',
      ].join('\n'),
    );
    expect(readFileSync(join(out, 'robots.txt'), 'utf8')).toContain(
      `Sitemap: ${ORIGIN}/sitemap.txt\n`,
    );
    for (const lang of ['en', 'ja'] as const) {
      setLang(lang);
      for (const id of PAGE_IDS) {
        const doc = parse(readFileSync(join(out, lang, `${id}.html`), 'utf8'));
        const url = `${ORIGIN}/${lang}/${id}.html`;
        expect(doc.documentElement.lang).toBe(lang);
        expect(doc.querySelectorAll('h1')).toHaveLength(1);
        expect(doc.querySelectorAll('title')).toHaveLength(1);
        expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBeTruthy();
        expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(url);
        for (const code of ['en', 'ja', 'x-default']) {
          expect(doc.querySelector(`link[hreflang="${code}"]`)?.getAttribute('href')).toBe(
            `${ORIGIN}/${code === 'x-default' ? 'en' : code}/${id}.html`,
          );
        }
        for (const field of ['title', 'description', 'url', 'image'])
          expect(
            doc.querySelector(`meta[property="og:${field}"]`)?.getAttribute('content'),
          ).toBeTruthy();
        expect(doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
          `${ORIGIN}/icon-512.png`,
        );
        expect(doc.querySelector('header a.open')?.getAttribute('href')).toBe('/');
        expect(doc.querySelectorAll('script')).toHaveLength(0);
        if (id === 'shortcuts')
          expect(doc.querySelectorAll('dt')).toHaveLength(Object.keys(KEYS).length);
        if (id === 'about') expect(doc.body.textContent).toContain(t('about.what'));
        if (id === 'faq') expect(doc.body.textContent).toContain(t('docs.previewPrivacy'));
      }
    }
    setLang('en');
  });
});
