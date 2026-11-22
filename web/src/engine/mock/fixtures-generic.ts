// N2/N7 public non-feed review fixtures; no real Nostr events or private data.

import type { NoteSpec } from './fixtures-notes.ts';
import { byHandle } from './people.ts';
import type { MNote } from './world.ts';

export function addGenericFixtures(
  base: number,
  minute: number,
  idOf: (n: number) => string,
  make: (spec: NoteSpec, id: string, at: number) => MNote,
  add: (note: MNote) => MNote,
): void {
  // N2/N7 review fixtures. These are public non-feed events, not regular note traffic.
  const owner = 'komorebi';
  const generic = make(
    {
      by: owner,
      ago: 0,
      text: 'Meet at the river after the talk. A public session with a short description.',
    },
    idOf(9700),
    base - 36 * minute,
  );
  add({
    ...generic,
    eventKind: 30311,
    copyLink: `/n/nevent1${generic.id.slice(0, 58)}`,
    face: {
      type: 'generic',
      alt: 'Afternoon Nostr Meetup',
      form: 'text',
      tags: [
        { name: 'title', text: 'Afternoon Nostr Meetup', meaning: 'title' },
        { name: 't', text: 'nostr', meaning: 'topic', ref: { type: 'topic', tag: 'nostr' } },
        {
          name: 'p',
          text: byHandle('aoi').author.pubkey,
          meaning: 'person',
          ref: { type: 'person', pubkey: byHandle('aoi').author.pubkey },
        },
        {
          name: 'url',
          text: 'https://example.org/meetup',
          meaning: 'link',
          ref: { type: 'link', url: 'https://example.org/meetup' },
        },
        {
          name: 'custom',
          text: 'A long unknown raw item that is deliberately hidden behind a short ellipsis on narrow screens',
        },
      ],
      moreTags: 0,
    },
  });
  const payload = make(
    { by: owner, ago: 0, text: '{"server":"wss://relay.example.org","active":true,"count":24}' },
    idOf(9701),
    base - 37 * minute,
  );
  add({
    ...payload,
    eventKind: 30311,
    face: {
      type: 'generic',
      alt: 'Relay availability data',
      form: 'data',
      tags: [
        { name: 'd', text: 'relay-data', meaning: 'id' },
        { name: 'r', text: 'wss://relay.example.org', meaning: 'link' },
      ],
      moreTags: 0,
    },
  });
  const article = make(
    {
      by: owner,
      ago: 0,
      text: 'An article about building better Nostr clients, with a careful reading of tradeoffs.',
    },
    idOf(9702),
    base - 38 * minute,
  );
  add({ ...article, eventKind: 30023 });
  const list = make(
    { by: owner, ago: 0, text: 'Public collection of developer tools' },
    idOf(9703),
    base - 39 * minute,
  );
  add({
    ...list,
    eventKind: 30030,
    face: {
      type: 'generic',
      form: 'text',
      tags: [{ name: 'd', text: 'developer-tools', meaning: 'id' }],
      moreTags: 0,
    },
  });
}
