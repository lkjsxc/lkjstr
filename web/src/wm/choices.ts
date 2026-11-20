// What the New tab page offers: every view that can start empty (Documentation once), and for typed text the pages
// of Documentation it names, a search, a hashtag, or the note or person a pasted Nostr address names. Matching uses
// both languages whatever the interface language.

import { both, t } from '../shared/i18n.ts';
import { knownPeople } from '../shared/people.ts';
import { DOC_PAGES, docSearch } from '../views/docs.ts';
import { plainName } from '../views/parts.ts';
import { offered, serves, VIEWS, viewOf } from '../views/registry.ts';
import { homeTitle } from '../views/their-home.ts';
import { type Choice, matchesWords } from './launcher.ts';

const REF = /^(npub1|nprofile1|note1|nevent1)[a-z0-9]+$/;

const choice = (kind: string, state?: object, title?: string): Choice => {
  const v = viewOf(kind);
  return {
    kind,
    state,
    title: title ?? (v ? t(v.title) : kind),
    hint: v ? t(v.hint) : '',
    search: v ? `${both(v.title)} ${both(v.hint)} ${kind} ${v.aliases ?? ''}`.toLowerCase() : kind,
  };
};

export const CHOICES = {
  choices: (): Choice[] => VIEWS.filter(offered).map((v) => choice(v.id)),
  typed(text: string): Choice[] {
    const theirs = (ref: string, name: string) =>
      choice('their-home', { ref, title: homeTitle(name) }, homeTitle(name));
    if (REF.test(text)) {
      const kind = text.startsWith('np') ? 'profile' : 'thread';
      return [
        choice(kind, { ref: text }, t('launcher.open', { what: `${text.slice(0, 14)}…` })),
        ...(kind === 'profile' && serves(5) ? [theirs(text, `${text.slice(0, 10)}…`)] : []),
      ];
    }
    // Each page of Documentation is gone to by its own name once something is typed ("shortcuts", "terms").
    const pages = DOC_PAGES.filter((p) => matchesWords(docSearch(p), text)).map((p) => ({
      ...choice('docs', { page: p.id }, t(p.title)),
      hint: t('view.docs'),
      search: docSearch(p),
    }));
    const tag = text.replace(/^#/, '');
    const one = !/\s/.test(tag);
    return [
      ...pages,
      ...(serves(5) ? knownPeople() : [])
        .filter((a) =>
          [a.name, a.nip05 ?? ''].some((s) =>
            s.normalize('NFKC').toLowerCase().startsWith(text.normalize('NFKC').toLowerCase()),
          ),
        )
        .slice(0, 6)
        .map((a) => theirs(a.npub, plainName(a))),
      ...(text.startsWith('#') && one ? [choice('hashtag', { tag }, `#${tag}`)] : []),
      choice('search', { text }, t('launcher.search', { text })),
      ...(!text.startsWith('#') && one ? [choice('hashtag', { tag }, `#${tag}`)] : []),
    ];
  },
};
