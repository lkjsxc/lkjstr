// What the New tab page offers: every view that can start empty, and for typed text a search, a hashtag, or the
// note or person a pasted Nostr address names. Matching uses both languages whatever the interface language.
import { both, t } from '../shared/i18n.ts';
import { VIEWS, viewOf } from '../views/registry.ts';
import type { Choice } from './launcher.ts';

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
  choices: (): Choice[] => VIEWS.filter((v) => v.launch).map((v) => choice(v.id)),
  typed(text: string): Choice[] {
    if (REF.test(text)) {
      const kind = text.startsWith('np') ? 'profile' : 'thread';
      return [choice(kind, { ref: text }, t('launcher.open', { what: `${text.slice(0, 14)}…` }))];
    }
    const tag = text.replace(/^#/, '');
    const one = !/\s/.test(tag);
    return [
      ...(text.startsWith('#') && one ? [choice('hashtag', { tag }, `#${tag}`)] : []),
      choice('search', { text }, t('launcher.search', { text })),
      ...(!text.startsWith('#') && one ? [choice('hashtag', { tag }, `#${tag}`)] : []),
    ];
  },
};
