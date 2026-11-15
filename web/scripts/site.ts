// Build-time HTML only: public pages share the app's Docs prose, translations and key table.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang, t } from '../src/shared/i18n.ts';
import { groupText, KEY_GROUPS, KEYS, type KeyId, keyCaps, keyText } from '../src/shared/keys.ts';
import { siteEn } from './site-words-en.ts';
import { siteJa } from './site-words-ja.ts';

export const ORIGIN = 'https://lkjstr.lkjsxc.com';
export const PAGE_IDS = Object.keys(siteEn.pages) as (keyof typeof siteEn.pages)[];
const here = fileURLToPath(new URL('..', import.meta.url));
export const escapeHtml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const prose = (s: string): string =>
  s
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n');
      let heading = '';
      if (lines[0]?.startsWith('## ')) heading = `<h2>${escapeHtml(lines.shift()!.slice(3))}</h2>`;
      if (!lines.length) return heading;
      return (
        heading +
        (lines.every((line) => line.startsWith('- '))
          ? `<ul>${lines.map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join('')}</ul>`
          : `<p>${escapeHtml(lines.join('\n'))}</p>`)
      );
    })
    .join('\n');

export function buildPublicPages(out: string, builtAt = new Date()): void {
  const urls: string[] = [];
  for (const lang of ['en', 'ja'] as const) {
    setLang(lang);
    const words = lang === 'en' ? siteEn : siteJa;
    mkdirSync(join(out, lang), { recursive: true });
    for (const id of PAGE_IDS) {
      const [heading, description] = words.pages[id];
      const title = `${heading} | lkjstr`;
      const path = `/${lang}/${id}.html`;
      const url = ORIGIN + path;
      const other = lang === 'en' ? 'ja' : 'en';
      const alternates = ['en', 'ja', 'x-default'].map((code) => {
        const href = `${ORIGIN}/${code === 'x-default' ? 'en' : code}/${id}.html`;
        return { code, href };
      });
      let body = id === 'shortcuts' ? '' : prose(words[id]);
      if (id === 'about')
        body =
          prose(t('about.what')) +
          prose(t('docs.what.b').split('\n\n').slice(1).join('\n\n')) +
          body;
      if (id === 'guide')
        body +=
          prose(`## ${t('docs.filters')}\n${t('docs.filters.b')}`) + prose(t('docs.filters.rich'));
      if (id === 'faq')
        body +=
          prose(`## ${t('docs.keys')}\n${t('docs.keys.b')}`) +
          prose(`## ${t('docs.privacy')}\n${t('docs.privacy.b')}`) +
          prose(t('docs.previewPrivacy'));
      if (id === 'shortcuts')
        body =
          `<p>${escapeHtml(words.shortcutIntro)}</p>` +
          KEY_GROUPS.map(
            (group) =>
              `<h2>${escapeHtml(t(groupText(group)))}</h2><dl>${(Object.keys(KEYS) as KeyId[])
                .filter((key) => KEYS[key].group === group)
                .map(
                  (key) =>
                    `<dt><kbd>${escapeHtml(keyCaps(key, false).join(' / '))}</kbd></dt><dd>${escapeHtml(t(keyText(key)))}</dd>`,
                )
                .join('')}</dl>`,
          ).join('\n');
      writeFileSync(
        join(out, path),
        `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description!)}">
<link rel="canonical" href="${url}">
${alternates.map(({ code, href }) => `<link rel="alternate" hreflang="${code}" href="${href}">`).join('\n')}
<meta property="og:type" content="website">
<meta property="og:site_name" content="lkjstr">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description!)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ja_JP'}">
<meta property="og:locale:alternate" content="${lang === 'en' ? 'ja_JP' : 'en_US'}">
<meta property="og:image" content="${ORIGIN}/icon-512.png">
<meta property="og:image:alt" content="lkjstr">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description!)}">
<meta name="twitter:image" content="${ORIGIN}/icon-512.png">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
</head>
<body>
<header><a class="brand" href="/${lang}/about.html">lkjstr</a><a href="/${other}/${id}.html" lang="${other}" hreflang="${other}">${words.language}</a><a class="open" href="/">${words.open}</a></header>
<nav aria-label="${t('view.docs')}">${PAGE_IDS.map((page) => `<a href="/${lang}/${page}.html"${page === id ? ' aria-current="page"' : ''}>${escapeHtml(words.pages[page][0]!)}</a>`).join('')}</nav>
<main><article><h1>${escapeHtml(heading!)}</h1><p class="lede">${escapeHtml(description!)}</p>${body}</article></main>
<footer><a href="/privacy.html">${words.privacy}</a><a href="/LICENSE.txt">${words.licence}</a><a href="https://github.com/lkjsxc/lkjstr">${words.source}</a></footer>
</body>
</html>
`,
      );
      urls.push(
        `<url><loc>${url}</loc><lastmod>${builtAt.toISOString()}</lastmod>${alternates.map(({ code, href }) => `<xhtml:link rel="alternate" hreflang="${code}" href="${href}"/>`).join('')}</url>`,
      );
    }
  }
  setLang('en');
  writeFileSync(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
  );
  writeFileSync(
    join(out, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
  );
  copyFileSync(join(here, 'src/static/site.css'), join(out, 'site.css'));
}

// The host's native HTTP regression uses the same generator in an isolated asset fixture.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2])
  buildPublicPages(process.argv[2]);
