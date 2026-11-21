// The one contract between the interface (main thread, TypeScript) and the engine (a Worker: Rust/WASM, or the
// mock in `engine/mock/`). Messages are plain structured-clone values. The frontend owns this file; the engine
// mirrors it with serde (`t`, `k`, `a`, `op` and `kind` are the tags; field names are camelCase) and proposes
// changes in docs/engine-proposals.md.
//
// Division of work: the engine owns everything that is not pixels (relay connections, request planning, the event
// store, signature checks, parsing, heuristics, ranking, publishing, uploads, keys). The interface never parses an
// event and never opens a socket: a row arrives as a finished view model and is drawn as it is.
//
// Transport: `worker.postMessage(ToEngine)` and `worker.onmessage = (FromEngine)`. The engine posts `ready` once
// after it has loaded; the interface sends `configure` and `hint` first and may send anything else before `ready`
// (the engine queues it). Unknown tags are ignored by both sides, so either side can be ahead by one version.

/** 2: `account.key` exists. An engine that reports 1 cannot hand a key back, so the interface does not offer to
 * create an account on it.
 * 3: the query fields `phrases`, `exclude`, `has`, `from`, `notifications` and `show`. The interface draws their
 * controls only for an engine that reports 3 or more, and sends an older one the plain words in `text`.
 * 5: optional link previews, engine configuration and the near-note hint.
 * 4: channels (NIP-28): the sources `channels` and `channel`, `ChannelRow`, `NoteRow.channel`, `Draft.channel` and
 * the actions `channel.join`, `channel.save`, `channel.seen`. The interface draws no channel control for an engine
 * that reports less. */
/** 5: `their-home` uses `pubkey`/`ref` as the follow-list owner, independent of the acting account.
 * `people` returns at most six prefix matches from the device, follows first, then participants of `id`'s
 * thread. `authors` instead requests those profiles (at most 32); `ref` explicitly resolves a person.
 * Author.profileId identifies kind 0 for image retry. Draft.mentions holds selected UTF-16 text ranges;
 * the engine validates their labels, expands them to nostr:npub and derives p tags.
 * Also adds cache-wide month counts, window ordinals and month/ordinal anchors for time rails. */
/** 6: private messages, external encryption, encrypted key import/export and session locks. */
/** 7: atomic private visibility, correlated upload cancellation and signer ownership. */
/** 8: private conversation identities, display models, inbox lists and private draft storage. */
/** 9: provider-authorized zaps, unpaid invoice intents and current reading hints. */
/** 10: account-scoped private lists with owned signer cancellation. */
/** 11: owner-bound ephemeral bunker authorization challenges. */
/** 12: finite storage inspection; no storage mutation. */
/** 13: engine-authorized public rendering snapshots, independent of the protected event store. */
/** 14: bounded act chains, profile act context and unresolved notification states. */
/** 15: bounded absolute cache windows and current follow-list provenance. */
export const PROTOCOL_VERSION = 15;

/** Chosen by the interface, unique among its open subscriptions. */
export type SubId = string;
/** Chosen by the sender of a request, unique among its pending requests. */
export type ReqId = string;
/** 64 lower-case hex characters. */
export type Pubkey = string;
/** Identity of a row inside one subscription: stable for as long as the subscription lives, and the same for the
 * same thing across subscriptions and reloads wherever that is possible (an event id, a pubkey, a relay URL).
 * Opaque to the interface, which only compares keys and hands them back as anchors. */
export type RowKey = string;
/** Milliseconds since the epoch. The interface formats every time itself (language, absolute or relative). */
export type Millis = number;

// ───────────────────────────────────────── queries ─────────────────────────────────────────

export type Source =
  | 'their-home' // notes of the people `pubkey`/`ref` follows, usable signed out
  | 'people' // local mention suggestions or explicit profile requests (since 5)
  | 'home' // notes of the people the account follows
  | 'global' // notes from the account's read relays
  | 'profile' // one `ProfileRow` first, then that person's notes (so the header scrolls away with them)
  | 'thread' // ancestors, the focused note, replies; `NoteRow.thread` says which is which
  | 'notifications'
  | 'search' // `text` is the search; note rows, with matching people first as person rows
  | 'hashtag'
  | 'bookmarks'
  | 'list' // a NIP-51 people list or set, by `id`
  | 'relay' // notes of one relay, by `relay`
  | 'followers' // person rows
  | 'following' // person rows
  | 'mutes' // mute rows: people, words, hashtags and threads the account muted
  | 'relays' // relay rows: every relay the engine knows, those in use first
  | 'media-servers' // server rows: where uploads go
  | 'emoji' // emoji rows: the account's custom emoji (NIP-30), for the picker
  | 'diagnostics' // info rows about the engine itself
  // Since version 4 (NIP-28 public chat).
  | 'channels' // channel rows: the channels on the reader's list first (in the list's order), then the others known
  | 'channel'; // one `ChannelRow` first, then the channel's messages as note rows, newest first

export type NotificationType = 'mention' | 'reply' | 'repost' | 'reaction' | 'zap';

/** What a subscription shows. Fields that do not apply to a source are ignored. */
export type Query = {
  /** Opt in to account-scoped external private-list reads; separate from DM consent. */
  readonly privateLists?: boolean;
  readonly source: Source;
  /** The acting account (whose follows, mutes and own state apply). Absent: reading signed out. */
  readonly account?: Pubkey;
  /** `profile`, `followers`, `following`: whose. */
  readonly pubkey?: Pubkey;
  /** `thread`: the focused note (event id, hex). `channel`: the channel (id of its creation event, kind 40). */
  readonly id?: string;
  /** In place of `pubkey` or `id`: a reference as a person typed it or as an address carried it (npub, nprofile,
   * note, nevent, naddr, or a NIP-05 name). The engine resolves it; the interface never decodes one. */
  readonly ref?: string;
  /** `hashtag`: without `#`. `list`: the list's address. */
  readonly tag?: string;
  readonly relay?: string;
  // Filters. They narrow any note source and are part of the query: changing one means `close` and `open`.
  /** Only notes by these people. */
  readonly authors?: readonly Pubkey[];
  readonly since?: Millis;
  readonly until?: Millis;
  /** `notifications`: only these types (absent: all). */
  readonly types?: readonly NotificationType[];
  /** `only`: notes with media; `none`: notes without. */
  readonly media?: 'only' | 'none';
  /** Replies among the notes (default true for `profile`, `home`; the engine decides elsewhere). */
  readonly replies?: boolean;
  readonly reposts?: boolean;
  /** BCP 47 primary tags; only notes the engine judges to be in one of them. */
  readonly language?: readonly string[];
  /** Words every note must contain (any case). For `search` this is the search itself. For `channels`: words the
   * channel's name or about text must contain; a reference to a channel (its nevent, note or 64 hex id) gives
   * that channel alone, fetched when it is not known yet. */
  readonly text?: string;
  // Since version 3.
  /** Exact phrases every note must contain (any case), spaces included. */
  readonly phrases?: readonly string[];
  /** Words or phrases: a note that contains any of them (any case) is left out. */
  readonly exclude?: readonly string[];
  /** Only notes that carry every one of these: a picture, a video, a link in the text. */
  readonly has?: readonly ('image' | 'video' | 'link')[];
  /** Only notes by these people, each as the reader typed it: an npub or nprofile, a NIP-05 name, or a display
   * name. The engine resolves them (a display name against the profiles it knows, exact match first); one that
   * resolves to nobody matches nothing. With `authors`, the union of both. */
  readonly from?: readonly string[];
  /** `home`, `global`: the account's notifications flow into the list at their own time, as `NotificationRow`s
   * (the same rows the `notifications` source gives; one whose note is already in the list is left out). */
  readonly notifications?: boolean;
  /** `profile`: which of the person's events follow the header. `posts`: their notes that answer nobody;
   * `replies`: their replies; `reposts`: the notes they reposted (as repost rows); `reactions`: the notes they
   * reacted to, newest reaction first; `media`: their notes with a picture or a video. Absent: notes and replies. */
  readonly show?: 'posts' | 'replies' | 'reposts' | 'reactions' | 'media';
};

/** Where a window sits. `top` follows the head of the list: new rows are inserted as they arrive. A key holds
 * the list still around that row: rows that arrive above are only counted (`fresh`). */
export type Anchor =
  | 'top'
  | { readonly key: RowKey }
  | { readonly at: Millis }
  | { readonly month: Millis; readonly offset: number; readonly returnKey?: RowKey };

// ───────────────────────────────────────── view models ─────────────────────────────────────────

export type Emoji = { readonly code: string; readonly url: string; readonly address?: string };

export type Author = {
  readonly pubkey: Pubkey;
  readonly profileId?: string;
  readonly npub: string;
  /** Display name. May contain `:code:` of `emoji`. Until the profile is known it is empty, the pubkey or the npub:
   * the interface then shows a short npub form in its place. */
  readonly name: string;
  readonly emoji?: readonly Emoji[];
  /** https or data URL, or absent: the interface draws a flat circle in a colour from the pubkey. */
  readonly picture?: string;
  /** NIP-05 name as typed in the profile ("name@example.com"; "_@" already dropped). */
  readonly nip05?: string;
  /** The NIP-05 name was checked and points to this pubkey. */
  readonly verified?: boolean;
  /** The reader muted this person (rows by them are normally not sent at all). */
  readonly muted?: boolean;
  readonly bot?: boolean;
};

/** Note text, already split. Media addresses are taken out of the text and listed in `NoteRow.media`. */
export type Segment =
  | { readonly k: 'text'; readonly text: string } // may contain "\n"
  | { readonly k: 'link'; readonly url: string; readonly text: string } // `text`: host and a shortened path
  | { readonly k: 'mention'; readonly pubkey: Pubkey; readonly name: string }
  | { readonly k: 'hashtag'; readonly tag: string }
  | { readonly k: 'emoji'; readonly code: string; readonly url: string }
  /** A nostr: reference that is not embedded as a quote (an address, a relay, an unsupported kind). */
  | { readonly k: 'ref'; readonly bech32: string; readonly text: string };

export type Media = {
  readonly type: 'image' | 'video' | 'audio';
  readonly url: string;
  /** Smaller rendition for feeds, when a media server offers one. For a video: its poster frame. */
  readonly thumb?: string;
  /** Pixel size when known (imeta, dim): the interface reserves the space before the file loads. */
  readonly w?: number;
  readonly h?: number;
  readonly alt?: string;
  /** Average colour "#rrggbb" for the reserved box, when known. */
  readonly color?: string;
  readonly sensitive?: boolean;
};

export type Quote =
  | {
      readonly state: 'ok';
      readonly id: string;
      readonly author: Author;
      readonly at: Millis;
      readonly segments: readonly Segment[];
      readonly media: readonly Media[];
      readonly cw?: string;
    }
  /** Not found (yet), deleted, or by a muted person: one quiet line, never the raw reference. */
  | { readonly state: 'missing' | 'loading' | 'muted' | 'deleted' | 'error'; readonly id: string };

export type Reaction = {
  /** A Unicode emoji, or `:code:` with `url`. */
  readonly emoji: string;
  readonly url?: string;
  readonly count: number;
  readonly mine: boolean;
};

export type Counts = {
  /** Since version 13: persisted verified contributor context; hashes are never ordered. */
  readonly context?: {
    readonly lineage: string;
    /** Canonical unsigned decimal; compare with BigInt, never Number. */
    readonly generation: string;
    readonly token: string;
    /** The committed contributor/fence basis was applied to the Store. */
    readonly restored: boolean;
    /** The displayed values exactly match this committed basis. */
    readonly current: boolean;
    /** Committed public mute policy for the account; absence never clears a known policy. */
    readonly selection?: {
      readonly account: string;
      readonly id?: string;
      readonly createdAt?: string;
      readonly token: string;
      readonly committed: boolean;
    };
  };
  readonly replies: number;
  readonly reposts: number;
  readonly reactions: number;
  /** Sum of provider-authorized receipt amounts in sats, rounded down after summing. */
  readonly zaps: number;
  /** Trust completeness is separate from observed relay-page truncation. */
  readonly zapState?: ZapPhase;
  readonly zapUnverified?: number;
  readonly zapAmountMsat?: string;
  /** Fractional sats were rounded down or the numeric value was capped. */
  readonly zapLimited?: boolean;
  /** A relay request reached its limit: the numbers are lower bounds, drawn as "12+". */
  readonly partial: boolean;
};

/** Since version 5. Absent previews means the service is unavailable. At most two, in link order. */
export type LinkPreview = {
  readonly source: string;
  readonly url: string;
  readonly siteName?: string;
  readonly title?: string;
  readonly description?: string;
  readonly imageUrl?: string | null;
  readonly kind: 'loading' | 'link' | 'page' | 'post';
};
/** Since version 14. One verified reaction or repost link; its counts remain on that act. */
export type ActRef = {
  readonly type: 'reaction' | 'repost';
  readonly actor: Author;
  readonly emoji?: { readonly emoji: string; readonly url?: string };
};
export type NoteRow = {
  /** Profile Reactions/Reposts only: the selected person's act, which also supplies this row's time. */
  readonly act?: ActRef;
  /** The immediately targeted act; only the terminal note is rendered as the row. */
  readonly actOn?: ActRef;
  readonly previews?: readonly LinkPreview[];
  readonly kind: 'note';
  readonly key: RowKey;
  /** Event id (hex) of the note itself: for a repost row, the reposted note. */
  readonly id: string;
  /** `note1…` / `nevent1…` for copying, and the path of its web address (`/n/note1…`). */
  readonly bech32: string;
  readonly author: Author;
  readonly at: Millis;
  readonly segments: readonly Segment[];
  readonly media: readonly Media[];
  readonly quotes: readonly Quote[];
  /** What this note answers: who, and the first line of it (absent in a thread, where the parent is in view). */
  readonly replyTo?: { readonly id: string; readonly author: Author; readonly excerpt: string };
  /** Present when the row is in the list because of reposts: the latest reposters first, and how many more. */
  readonly repostedBy?: {
    readonly actors: readonly Author[];
    readonly others: number;
    readonly at: Millis;
  };
  /** NIP-36: the reason as written ('' when none was given). The text and media stay covered until pressed. */
  readonly cw?: string;
  readonly counts: Counts;
  readonly reactions: readonly Reaction[];
  /** The reader's own state. */
  readonly mine: {
    readonly reposted: boolean;
    readonly bookmarked: boolean;
    /** The reader wrote it (delete is offered). */
    readonly own: boolean;
  };
  /** A heuristic hid this note; the interface shows one quiet line with the reason and a way to see it. */
  readonly hidden?: { readonly reason: string };
  /** `thread` source only. `depth` 0 for ancestors and the focus, 1+ for replies. `parent` (additive): the id of
   * the note this one answers, also when that note is not known; absent for the note a thread starts from. */
  readonly thread?: {
    readonly role: 'ancestor' | 'focus' | 'reply';
    readonly depth: number;
    readonly parent?: string;
  };
  /** The client that wrote it, when tagged. */
  readonly client?: string;
  /** Since version 4. The note is a channel message (kind 42): which channel, and its name ('' until known).
   * Present in every source; inside the channel's own list the interface does not repeat it. `replyTo` is set
   * only when the message answers another message, never for the channel itself. */
  readonly channel?: { readonly id: string; readonly name: string };
  /** Not confirmed by any relay yet (the reader's own note, just sent). */
  readonly pending?: boolean;
  readonly connecting?: boolean;
};

export type ProfileRow = {
  readonly kind: 'profile';
  readonly key: RowKey;
  readonly author: Author;
  readonly banner?: string;
  readonly about: readonly Segment[];
  readonly website?: string;
  /** Lightning address, shown as text. */
  readonly lud16?: string;
  /** Absent: not known yet. The interface then shows no number (as it does for a partial 0). */
  readonly following?: number;
  readonly followers?: number;
  readonly notes?: number;
  /** Counts are lower bounds (see `Counts.partial`). */
  readonly partial: boolean;
  /** The reader follows them / they follow the reader / this is the reader. */
  readonly followed: boolean;
  readonly followsYou: boolean;
  readonly self: boolean;
  readonly muted: boolean;
  /** People the reader follows who follow this person: the first few, and how many more. */
  readonly knownFollowers?: { readonly actors: readonly Author[]; readonly others: number };
  /** When the profile was last changed, and the first note seen ("on Nostr since"). */
  readonly updatedAt?: Millis;
  readonly since?: Millis;
  /** The person's write relays (host names), for the curious. */
  readonly relays: readonly string[];
};

export type PersonRow = {
  /** Account-scoped selection weight; zero excludes a muted person. Feeds stay chronological. */
  readonly weight?: number;
  readonly kind: 'person';
  readonly key: RowKey;
  readonly author: Author;
  /** First line of the profile's about text. */
  readonly about: string;
  readonly followed: boolean;
  readonly followsYou: boolean;
  readonly self: boolean;
};

export type NotificationRow = {
  readonly kind: 'notification';
  readonly key: RowKey;
  readonly type: NotificationType;
  /** Who did it: latest first. Several when the engine grouped the same action on the same note. */
  readonly actors: readonly Author[];
  readonly others: number;
  readonly at: Millis;
  /** `reaction`: what they reacted with. */
  readonly emoji?: { readonly emoji: string; readonly url?: string };
  /** `zap`: sats, and the comment sent with it. */
  readonly sats?: number;
  readonly zapReceipt?: ZapReceipt;
  readonly comment?: string;
  /** The reader's note it is about (reaction, repost, zap): opened by a press on the excerpt. */
  readonly target?: {
    readonly id: string;
    readonly excerpt: string;
    readonly media: number;
    /** The reader's own reaction or repost immediately targeted by the new act. */
    readonly act?: ActRef;
  };
  /** Since version 14. The final note is unresolved; target stays absent and navigation uses an actor. */
  readonly pendingAct?: { readonly act: ActRef; readonly state: 'loading' | 'missing' | 'failed' };
  /** `mention`, `reply`: the note that mentions or answers, drawn as a full note. */
  readonly note?: NoteRow;
  /** Arrived after the reader last looked at notifications. */
  readonly unread: boolean;
};

/** One relay the engine knows. The `relays` source lists the reader's own list first (in the list's order), then
 * the other relays in use, then the rest. A relay taken off the reader's list stays a row (`why: 'unused'`, neither
 * `read` nor `write`) for as long as the engine knows it, so the interface can offer it again. */
export type RelayRow = {
  readonly kind: 'relay';
  readonly key: RowKey;
  readonly url: string;
  readonly state: 'connected' | 'connecting' | 'waiting' | 'failed' | 'idle';
  /** In use right now (a subscription or a publish depends on it). */
  readonly inUse: boolean;
  /** Why it is used or not, as a code the interface words: the reader's list, an author's outbox, a hint… */
  readonly why: 'yours' | 'outbox' | 'hint' | 'search' | 'unused' | 'failing' | 'blocked';
  /** The reader's own list says read / write. */
  readonly read: boolean;
  readonly write: boolean;
  /** Open subscriptions, events received this session, median round trip. */
  readonly subs: number;
  readonly events: number;
  readonly latencyMs?: number;
  /** Last error in the relay's or the browser's words, and when the next attempt is due. */
  readonly error?: string;
  readonly retryAt?: Millis;
  /** NIP-11 name and software, when fetched. */
  readonly name?: string;
  readonly software?: string;
  readonly authed?: boolean;
};

export type MuteTarget =
  | { readonly k: 'person'; readonly pubkey: Pubkey }
  | { readonly k: 'word'; readonly word: string }
  | { readonly k: 'hashtag'; readonly tag: string }
  | { readonly k: 'thread'; readonly id: string };

export type MuteRow = {
  readonly kind: 'mute';
  readonly key: RowKey;
  readonly target: MuteTarget;
  /** `person`: who. `thread`: the first line of its root note. */
  readonly author?: Author;
  readonly excerpt?: string;
};

export type ServerRow = {
  readonly kind: 'server';
  readonly key: RowKey;
  readonly url: string;
  /** Upload protocol the engine found there. */
  readonly protocol: 'blossom' | 'nip96' | 'unknown';
  /** Fresh required-request evidence; unknown and optional failures have checked=false. */
  readonly ok: boolean;
  readonly checked?: boolean;
  readonly error?: Failure;
};

export type EmojiRow = {
  readonly kind: 'emoji';
  readonly key: RowKey;
  /** Name of the set it belongs to ('' for the account's own list). */
  readonly set: string;
  readonly code: string;
  readonly url: string;
  /** NIP-51 coordinate of the image's set, when known. */
  readonly address?: string;
};

/** A labelled fact (`diagnostics`): event store size, protocol version, the worker kind in use. */
export type InfoRow = {
  readonly kind: 'info';
  readonly key: RowKey;
  readonly label: string;
  readonly value: string;
};

/** A public chat channel (NIP-28). Since version 4. */
export type ChannelRow = {
  readonly kind: 'channel';
  readonly key: RowKey;
  /** Event id (hex) of the channel's creation event (kind 40): what a `channel` query and the channel actions
   * name. */
  readonly id: string;
  /** `nevent1…` of the creation event, with relay hints: for copying and for handing the channel to someone. */
  readonly bech32: string;
  /** The latest metadata: kind 41 by the creator, else the creation event. `name` is '' until it is known: the
   * interface then shows a short form of `bech32`. */
  readonly name: string;
  readonly about: string;
  readonly picture?: string;
  /** Who created it. Absent until the creation event is known. */
  readonly creator?: Author;
  /** On the reader's list of channels (NIP-51 kind 10005). */
  readonly joined: boolean;
  /** The reader created it: `channel.save` with its `id` is offered. */
  readonly own: boolean;
  /** The newest message the engine knows: when, by whom, its first line. Absent: none known (yet). */
  readonly last?: { readonly at: Millis; readonly author: Author; readonly excerpt: string };
  /** Messages by others that arrived after the reader last saw the channel (`channel.seen`). Counted for joined
   * channels only (0 otherwise) and capped at 99, which the interface draws as "99+". */
  readonly unread: number;
};

export type Row =
  | ChannelRow
  | NoteRow
  | ProfileRow
  | PersonRow
  | NotificationRow
  | RelayRow
  | MuteRow
  | ServerRow
  | EmojiRow
  | InfoRow;

/** A change to the rows of one window. Ops apply in order. */
export type PatchOp =
  /** New rows, placed before the row `before` (null: at the end of the window). */
  | { readonly op: 'insert'; readonly before: RowKey | null; readonly rows: readonly Row[] }
  /** A row changed (counts, a reaction, a loaded quote, a resolved name): the whole row again. */
  | { readonly op: 'update'; readonly row: Row }
  /** Deleted, muted, or no longer matching the query. */
  | { readonly op: 'remove'; readonly key: RowKey };

/** How a subscription is doing, for honest empty and loading states. */
export type SubState = {
  /** Receipt/read evidence is independent of the relay lifecycle below. */
  readonly zapEvidence?: ZapEvidence;
  readonly privateLists?: {
    readonly phase: 'loading' | 'ready' | 'failed' | 'unsupported';
    readonly pending: number;
    readonly failed: number;
    readonly error?: Failure['code'];
  };
  /** `cache`: showing what the device has, relays still being asked. `live`: relays answered and it is following.
   * `done`: a finite list was read to its end. `failed`: nobody could be asked; `error` says why. */
  readonly phase: 'cache' | 'live' | 'done' | 'failed';
  readonly relaysAsked: number;
  readonly relaysAnswered: number;
  /** When the newest row arrived, so a quiet feed can be told from a stuck one. */
  readonly lastArrival?: Millis;
  readonly error?: string;
};

// ───────────────────────────────────────── actions ─────────────────────────────────────────

/** What `upload` returns and a draft carries back: the NIP-92 imeta of a file. */
export type Uploaded = {
  readonly url: string;
  readonly type: 'image' | 'video' | 'audio';
  readonly mime: string;
  readonly w?: number;
  readonly h?: number;
  readonly sha256?: string;
  readonly alt?: string;
};

export type Mention = {
  readonly start: number;
  readonly end: number;
  readonly pubkey: Pubkey;
  readonly label: string;
};
export type Draft = {
  readonly mentions?: readonly Mention[];
  readonly text: string;
  // engine-added 2026-11-15: 2
  readonly longForm?: { readonly identifier: string; readonly title?: string };
  // end engine-added
  /** Since version 4: a message in this channel (kind 42; the channel's id). With `replyTo`: an answer to that
   * message inside the channel. A draft whose `replyTo` is a channel message is published into that message's
   * channel even without this field (a reply written from a thread or a notification). */
  readonly channel?: string;
  /** Answer to this note (event id). */
  readonly replyTo?: string;
  /** Quotes this note: the engine appends the reference and the tags. */
  readonly quote?: string;
  readonly media?: readonly Uploaded[];
  /** Content warning: the reason ('' for a warning without one). */
  readonly cw?: string;
  /** Custom emoji used in the text. */
  readonly emoji?: readonly Emoji[];
};

export type Publish =
  | { readonly k: 'note'; readonly draft: Draft }
  | { readonly k: 'repost'; readonly id: string }
  /** `emoji`: Unicode, or `:code:` with `url`. */
  | {
      readonly k: 'reaction';
      readonly id: string;
      readonly emoji: string;
      readonly url?: string;
      readonly address?: string;
    }
  /** Deletes the reader's own event: a note, their repost of `id` (`of: 'repost'`) or their reaction to it. */
  | {
      readonly k: 'delete';
      readonly id: string;
      readonly of?: 'note' | 'repost' | 'reaction';
      readonly emoji?: string;
      /** Reaction image URL, or '' for a reaction rendered as text. */
      readonly url?: string;
    };

export type ProfileEdit = {
  readonly name: string;
  readonly about: string;
  readonly picture?: string;
  readonly banner?: string;
  readonly nip05?: string;
  readonly website?: string;
  readonly lud16?: string;
};

/** The metadata of a channel as the reader edits it (NIP-28 kind 40 and 41 content). */
export type ChannelEdit = {
  readonly name: string;
  readonly about: string;
  readonly picture?: string;
};

export type RelayEntry = { readonly url: string; readonly read: boolean; readonly write: boolean };

/** Every action is answered by exactly one `result`. */
export type Action =
  | { readonly a: 'link.check'; readonly route: 'n' | 'p' | 'a'; readonly ref: string }
  | { readonly a: 'zap.invoice'; readonly as: Pubkey; readonly intent: ZapInvoiceInput }
  | { readonly a: 'lists.retry'; readonly as: Pubkey }
  /** Register a mounted private editor before allowing input; closed leases cannot hold a lock. */
  | {
      readonly a: 'dm.editor';
      readonly as: Pubkey;
      readonly editor: string;
      readonly open: boolean;
      readonly dirty?: boolean;
    }
  | { readonly a: 'dm.send'; readonly as: Pubkey; readonly draft: DmDraft }
  | { readonly a: 'dm.seen'; readonly as: Pubkey; readonly conversation: string }
  | { readonly a: 'dm.relays.save'; readonly as: Pubkey; readonly relays: readonly string[] }
  | { readonly a: 'dm.draft.load'; readonly as: Pubkey; readonly tab: string }
  | {
      readonly a: 'dm.draft.save';
      readonly as: Pubkey;
      readonly tab: string;
      readonly state: DmDraftState;
      readonly expected?: string;
    }
  | {
      readonly a: 'dm.draft.clear';
      readonly as: Pubkey;
      readonly tab: string;
      readonly expected?: string;
    }
  | { readonly a: 'account.importEncrypted'; readonly key: string; readonly password: string }
  | { readonly a: 'account.unlock'; readonly pubkey: Pubkey; readonly password: string }
  | { readonly a: 'account.lock'; readonly pubkey: Pubkey }
  | {
      readonly a: 'account.exportEncrypted';
      readonly pubkey: Pubkey;
      readonly password: string;
      readonly logN?: number;
    }
  | { readonly a: 'publish'; readonly as: Pubkey; readonly what: Publish }
  | { readonly a: 'follow'; readonly as: Pubkey; readonly pubkey: Pubkey; readonly on: boolean }
  /** `on: false` takes a mute back. Either way the `mutes` rows and every open list are patched at once. */
  | { readonly a: 'mute'; readonly as: Pubkey; readonly target: MuteTarget; readonly on: boolean }
  | { readonly a: 'bookmark'; readonly as: Pubkey; readonly id: string; readonly on: boolean }
  /** `bytes` is transferred, not copied. Answered by `progress` messages and a `result` with `uploaded`. */
  | {
      readonly a: 'upload';
      /** One explicit destination; absent uses the first configured server. */
      readonly server?: string;
      readonly as: Pubkey;
      readonly name: string;
      readonly mime: string;
      readonly bytes: ArrayBuffer;
    }
  | { readonly a: 'profile.save'; readonly as: Pubkey; readonly profile: ProfileEdit }
  /** Replaces the reader's relay list (NIP-65) with `relays`, in this order. An entry with neither `read` nor
   * `write` is dropped; an address that is not `ws(s)://host[/path]` fails the whole action with `rejected`. The
   * `relays` rows are patched at once (before any relay has confirmed the new list) and `status` is sent again. */
  | { readonly a: 'relays.save'; readonly as: Pubkey; readonly relays: readonly RelayEntry[] }
  /** Replaces the media server list with `servers` (`https://host[/path]`), the preferred one first; anything
   * else fails with `rejected`. The `media-servers` rows are patched at once. */
  | { readonly a: 'servers.save'; readonly as: Pubkey; readonly servers: readonly string[] }
  /** Recheck required NIP-96 discovery or optional BUD-06; never uploads bytes. */
  | { readonly a: 'servers.check'; readonly server: string }
  /** Marks notifications read up to now. */
  | { readonly a: 'seen'; readonly as: Pubkey }
  // Channels (NIP-28), since version 4.
  /** Puts a channel on the reader's list (NIP-51 kind 10005, at its end) or takes it off. Every channel row is
   * patched at once, before a relay has confirmed the list. */
  | { readonly a: 'channel.join'; readonly as: Pubkey; readonly id: string; readonly on: boolean }
  /** Without `id`: creates a channel (kind 40) and puts it on the reader's list; the result's `id` is the new
   * channel. With `id`: replaces the metadata of the reader's own channel (kind 41); for someone else's channel it
   * fails with `rejected`. An empty `name` fails with `rejected`. */
  | {
      readonly a: 'channel.save';
      readonly as: Pubkey;
      readonly id?: string;
      readonly channel: ChannelEdit;
    }
  /** The reader has seen this channel up to now: its `unread` becomes 0 in every channel row. Kept on the device;
   * nothing is published. */
  | { readonly a: 'channel.seen'; readonly as: Pubkey; readonly id: string }
  // Accounts. Keys never cross to the interface except through `account.add` (typed by the reader).
  | { readonly a: 'account.add'; readonly how: 'extension' | 'create' }
  | { readonly a: 'account.add'; readonly how: 'key'; readonly key: string } // nsec, npub or bunker address
  /** The secret key of a `local` account as `nsec1…`, in the result's `key`: asked for only when the reader presses
   * "Back up key" (and once right after `create`). Any other signer fails with `unsupported`. Since version 2. */
  | { readonly a: 'account.key'; readonly pubkey: Pubkey }
  | { readonly a: 'account.use'; readonly pubkey: Pubkey }
  | { readonly a: 'account.remove'; readonly pubkey: Pubkey };

/** One relay's answer to a publish. */
export type Delivery = {
  readonly url: string;
  readonly state: 'pending' | 'ok' | 'failed' | 'timeout';
  /** The relay's own words for a refusal. */
  readonly message?: string;
};

export type Failure = {
  /** Stable code the interface words; `message` carries detail from outside (a relay, a server, the signer). */
  readonly code:
    | 'signed-out'
    | 'read-only'
    | 'signer-refused'
    | 'signer-timeout'
    | 'signer-missing'
    | 'no-relays'
    | 'relay-unreachable'
    | 'rejected'
    | 'too-large'
    | 'unsupported'
    | 'offline'
    | 'not-found'
    | 'internal'
    | 'upload-network'
    | 'upload-timeout'
    | 'upload-payment'
    | 'upload-response'
    | 'upload-discovery';
  readonly message?: string;
};

export type WriteRelayList = {
  readonly id: string;
  readonly at: number;
  readonly urls: readonly string[];
  readonly readOnly?: readonly string[];
};

export type Account = {
  /** Evidence for observed encrypted mutes used by the compatible unread count. Unknown does not prompt. */
  readonly privateLists?: {
    readonly phase: 'unknown' | 'loading' | 'ready' | 'failed' | 'unsupported';
    readonly pending: number;
    readonly failed: number;
    readonly error?: Failure['code'];
  };
  /** Observed, signature-verified kind-10050 inbox relays; absent while unknown. */
  readonly inbox?: readonly string[];
  readonly writeRelays?: WriteRelayList;
  readonly locked?: boolean;
  readonly encrypted?: boolean;
  readonly author: Author;
  readonly signer: 'local' | 'extension' | 'remote' | 'none';
  /** Unknown receipt authorization/read overflow is not a verified empty inbox. */
  readonly unreadZap?: ZapEvidence;
  /** Notifications that arrived since `seen`. */
  readonly unread: number;
};

/** Network and device facts the interface can see and the engine cannot. */
export type Hint = {
  /** Action request IDs whose composer results are still displayed. At most 128. */
  readonly deliveryWatches?: readonly ReqId[];
  /** Subscriptions whose tab is in front; the others may be paused. */
  readonly visibleSubs: readonly SubId[];
  /** Subscription in the tile receiving keyboard input, when it has one. */
  readonly focusedSub?: SubId;
  readonly pageHidden: boolean;
  /** No input for a few minutes. */
  readonly idle: boolean;
  readonly saveData: boolean;
  readonly effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  readonly deviceMemory?: number;
};

/** Engine-side settings. The interface stores settings and sends the whole object whenever one changes. */
export type EngineConfig = {
  /** Since version 5. Default on; data saver always disables it. */
  readonly linkPreviews?: boolean;
  // engine-added 2026-11-15: 2
  /** Include the lkjstr client tag on authored events (default true). */
  readonly clientTag?: boolean;
  // end engine-added
  /** Interface language, for the engine's language heuristics. */
  readonly language: string;
  /** Hide notes the engine judges to be repeated or spam (shown as one quiet line each). */
  readonly heuristics: boolean;
  /** Fetch link and media metadata ahead of the viewport. */
  readonly prefetch: boolean;
  /** The mock only: arrivals on a timer, or a still world for screenshots and tests. `slow`: a note whose text
   * holds `when` is signed `sign` ms late and its relays answer `relays` ms late (a rare outlier among sends).
   * `emoji: 'none'`: the reader has no custom emoji list. */
  readonly mock?: {
    readonly live: boolean;
    readonly accounts?: 'none';
    readonly emoji?: 'none';
    readonly slow?: { readonly when: string; readonly sign?: number; readonly relays?: number };
    /** A long thread and one whose first note answers a missing note (the thread scenes). */
    readonly threads?: boolean;
  };
};

// ───────────────────────────────────────── messages ─────────────────────────────────────────

export type SignerAuthorization = {
  readonly id: string;
  readonly peer: Pubkey;
  readonly method:
    | 'connect'
    | 'get_public_key'
    | 'sign_event'
    | 'nip44_encrypt'
    | 'nip44_decrypt'
    | 'nip04_decrypt';
  readonly url: string;
  readonly expiresAt: number;
  readonly account?: Pubkey;
  readonly actionReq?: ReqId;
};

/** Held public rendering references; these never establish event or author authority. */
export type PublicCacheHoldRow = {
  readonly key: RowKey;
  readonly id?: string;
  readonly profiles?: readonly { readonly pubkey: Pubkey; readonly id: string }[];
  readonly quotes?: readonly { readonly id: string }[];
};
export type PublicCacheReconcile = {
  readonly t: 'cache.reconcile';
  readonly sub: SubId;
  readonly removedKeys: readonly RowKey[];
  readonly invalidProfileIds: readonly string[];
  readonly removedQuoteIds: readonly string[];
};

export type ToEngine =
  | { readonly t: 'cache.hold'; readonly sub: SubId; readonly rows: readonly PublicCacheHoldRow[] }
  | { readonly t: 'storage.inspect'; readonly req: ReqId }
  | { readonly t: 'storage.close'; readonly req: ReqId }
  | { readonly t: 'signer.auth.cancel'; readonly id: string; readonly reason?: 'unsupported' }
  | { readonly t: 'zap.quote'; readonly req: ReqId; readonly query: ZapQuoteInput }
  | { readonly t: 'zap.receipts'; readonly req: ReqId; readonly query: ZapReceiptInput }
  | { readonly t: 'zap.close'; readonly req: ReqId }
  | { readonly t: 'dm.flushed'; readonly req: ReqId; readonly ok: boolean }
  | { readonly t: 'upload.cancel'; readonly req: ReqId }
  | {
      readonly t: 'dm.open';
      readonly sub: SubId;
      readonly query: DmQuery;
      /** Initial visibility is atomic with opening; omitted means visible. */
      readonly visible?: boolean;
    }
  | { readonly t: 'dm.close'; readonly sub: SubId }
  | { readonly t: 'dm.visible'; readonly sub: SubId; readonly visible: boolean }
  | { readonly t: 'dm.more'; readonly sub: SubId }
  | {
      readonly t: 'crypted';
      readonly req: ReqId;
      readonly value?: string;
      readonly error?:
        | 'rate-limited'
        | 'signer-missing'
        | 'signer-refused'
        | 'signer-timeout'
        | 'unsupported'
        | 'rejected'
        | 'too-large';
    }
  /** Since version 5. Near, uncovered note ids only, lowest priority; an empty list releases wants. */
  | { readonly t: 'preview'; readonly sub: SubId; readonly ids: readonly string[] }
  /** Since version 9. Current delivered row key; null restores the window-anchor fallback. */
  | { readonly t: 'reading'; readonly sub: SubId; readonly key: string | null }
  // engine-added 2026-11-15: 4
  | { readonly t: 'stats'; readonly req: ReqId }
  // end engine-added
  // engine-added 2026-11-15: 5
  | { readonly t: 'rowAtTime'; readonly req: ReqId; readonly sub: SubId; readonly at: Millis }
  // end engine-added
  | { readonly t: 'configure'; readonly config: EngineConfig }
  /** Replaces bootstrap relay usage; at most eight. Independent of EngineConfig. */
  | {
      readonly t: 'relays';
      readonly relays: readonly (RelayEntry & { readonly search: boolean })[];
      readonly account?: Pubkey;
      readonly cached?: WriteRelayList;
      readonly defaults?: readonly string[];
      readonly usesDefaults?: boolean;
    }
  /** Send every 20s; after 180s without contact the engine releases this client. */
  | { readonly t: 'heartbeat' }
  | { readonly t: 'detach' }
  /** Answer to getPublicKey; exactly one of pubkey or error. */
  | {
      readonly t: 'publicKey';
      readonly req: ReqId;
      readonly pubkey?: Pubkey;
      readonly error?: 'signer-missing' | 'signer-refused';
    }
  | { readonly t: 'hint'; readonly hint: Hint }
  | { readonly t: 'open'; readonly sub: SubId; readonly query: Query; readonly visible?: boolean }
  | { readonly t: 'close'; readonly sub: SubId }
  /** Asks for the rows around `anchor`: up to `before` rows above it and `after` rows from it downwards (the
   * anchor row itself counts as the first of `after`). Answered by `rows`; replaces any earlier window. */
  | {
      readonly t: 'window';
      readonly sub: SubId;
      readonly anchor: Anchor;
      readonly before: number;
      readonly after: number;
      // engine-added 2026-11-15: 5
      /** Retain up to 6000 cached rows above the anchor while extending below. */
      readonly retainAbove?: boolean;
      // end engine-added
      /** Let incoming rows fill the explicit before budget, including grouped rows. */
      readonly liveAbove?: boolean;
      /** A top window keeps this previously delivered tail while following arrivals. */
      readonly headThrough?: RowKey;
    }
  | {
      readonly t: 'act';
      readonly req: ReqId;
      readonly action: Action;
      /** Transport-owned monotonic enqueue metadata for public signing actions. */
      readonly signingTiming?: {
        readonly at: number;
        readonly hidden: boolean;
        readonly boot: boolean;
        readonly restart: boolean;
      };
    }
  /** Answer to `sign`: the signed event as JSON text, or why not. */
  | { readonly t: 'signed'; readonly req: ReqId; readonly event?: string; readonly error?: string };

// engine-added 2026-11-15: 4
export type SigningSample = {
  readonly kind: number;
  readonly signer: 'local' | 'extension' | 'remote' | 'unknown';
  readonly enqueueMs: number;
  readonly receivedMs: number;
  readonly startMs: number | null;
  readonly responseMs: number | null;
  readonly signedMs: number | null;
  readonly publishedMs: number | null;
  readonly finishedMs: number | null;
  readonly hidden: boolean;
  readonly boot: boolean;
  readonly restart: boolean;
  readonly cacheBusyAtReceipt: boolean;
  readonly accountBusyAtReceipt: boolean;
  readonly overlapping: readonly {
    readonly phase:
      | 'ingest'
      | 'verify'
      | 'plan'
      | 'render'
      | 'timeline'
      | 'output'
      | 'cache'
      | 'idb'
      | 'sync'
      | 'boot'
      | 'keyOperation';
    readonly totalMs: number;
    readonly queuedMs: number;
  }[];
};
export type EngineStats = {
  /** Public-event timings in the current Worker only. All timestamps use its monotonic clock. */
  readonly signing?: {
    readonly recent: readonly SigningSample[];
    readonly slow: readonly SigningSample[];
    readonly lastUnlockMs: number | null;
  };
  /** At most 256 logical requests; wireId groups filters sharing one envelope. */
  readonly requests?: readonly {
    readonly id: string;
    readonly relay: string;
    readonly wireId: string;
    readonly purpose:
      | 'focused'
      | 'visible'
      | 'history'
      | 'notifications'
      | 'own'
      | 'hydration'
      | 'prefetch';
    readonly priority: number;
    readonly weight: number;
    readonly received: number;
    readonly sent: boolean;
    readonly complete: boolean;
    readonly members: number;
  }[];
  readonly relays: readonly {
    readonly url: string;
    readonly state: string;
    readonly connectedSince: Millis | null;
    readonly readRule?: 'reader' | 'search' | 'hint' | 'unused';
    readonly route?: 'reading' | 'writing' | 'both' | 'search' | 'own' | 'unused';
    readonly followedCovered?: number;
    readonly firstEventMs?: number | null;
    /** Null when an inactive route has no retained transport observation. */
    readonly requestUses?: number | null;
    readonly readTimeouts?: number | null;
    readonly weight?: number | null;
    readonly eventsReceived: number;
    readonly duplicatesDropped: number;
    readonly openSubscriptions: number;
    readonly bytesIn: number;
    readonly bytesOut: number;
    readonly lastError: string | null;
    readonly latencyMs: number | null;
    /** Delivery counts across the last 32 publications; absent on older engines. */
    readonly publishPlanned?: number;
    readonly publishAccepted?: number;
    readonly publishFailed?: number;
    readonly publishOwnSkipped?: number;
    readonly publishInboxSkipped?: number;
    readonly publishCapacitySkipped?: number;
    readonly publishPending?: number;
  }[];
  /** Last 32 publications in this engine session, including excluded destinations. */
  readonly recentPublications?: readonly {
    readonly id: string;
    readonly kind: number;
    readonly at: Millis;
    readonly unresolvedRecipients?: number;
    readonly deliveries: readonly {
      readonly url: string;
      readonly rule: 'own' | 'inbox' | 'reply' | 'delete';
      readonly state: 'pending' | 'accepted' | 'rejected' | 'timeout' | 'skipped';
      readonly reason?: 'own-cap' | 'person-cap' | 'inbox-cap' | 'capacity';
    }[];
  }[];
  readonly totals: {
    readonly eventsStored: number;
    readonly cacheBytes: number;
    readonly subscriptions: number;
    /** Rows available at open; network counts accepted events this session. */
    readonly servedFromCache: number;
    readonly servedFromNetwork: number;
  };
  readonly orchestration: {
    readonly relaysCoveringFollowSet: number;
    /** Currently shared request memberships saved by coalescing. */
    readonly requestsCoalesced: number;
  };
};
// end engine-added
/** Protocol 5: exact cached note counts, UTC month starts, newest first. No relay estimates.
 * Positions name ordinals within those months, independent of the loaded window. */
export type Timeline = {
  readonly anchor?: RowKey;
  readonly newest: Millis;
  readonly oldest: Millis;
  readonly months: readonly { readonly at: Millis; readonly count: number }[];
  readonly positions: readonly {
    readonly key: RowKey;
    readonly month: Millis;
    readonly offset: number;
  }[];
  readonly supported: boolean;
  readonly older: boolean;
};
export type FromEngine =
  | PublicCacheReconcile
  | { readonly t: 'cache.policy'; readonly sub: SubId; readonly allow: boolean }
  | { readonly t: 'storage'; readonly req: ReqId; readonly report: StorageReport }
  | ({ readonly t: 'signer.auth' } & SignerAuthorization)
  | { readonly t: 'signer.auth.clear'; readonly id: string }
  | { readonly t: 'zap.quote'; readonly req: ReqId; readonly quote: ZapQuote }
  | { readonly t: 'zap.receipts'; readonly req: ReqId; readonly page: ZapReceiptView }
  | { readonly t: 'crypt.cancel'; readonly req: ReqId }
  /** Hold edits until release; acknowledge prepare only after encrypted writes have committed. */
  | {
      readonly t: 'dm.flush';
      readonly req: ReqId;
      readonly account: Pubkey;
      readonly phase: 'hold' | 'prepare' | 'release';
    }
  | { readonly t: 'dm'; readonly sub: SubId; readonly snapshot: DmSnapshot }
  | {
      readonly t: 'crypt';
      readonly req: ReqId;
      readonly pubkey: Pubkey;
      readonly peer: Pubkey;
      readonly operation: 'nip44.encrypt' | 'nip44.decrypt' | 'nip04.decrypt';
      readonly data: string;
      readonly background?: boolean;
      readonly context?: {
        readonly kind: 'private-list';
        readonly sub: SubId;
        readonly event: string;
      };
    }
  | { readonly t: 'timeline'; readonly sub: SubId; readonly timeline: Timeline }
  // engine-added 2026-11-15: 4
  | { readonly t: 'stats'; readonly req: ReqId; readonly stats: EngineStats }
  // end engine-added
  // engine-added 2026-11-15: 5
  /** First matching cached row at or before at; absent key means no cached match. */
  | {
      readonly t: 'rowAtTime';
      readonly req: ReqId;
      readonly sub: SubId;
      readonly key?: RowKey;
      readonly at?: Millis;
      readonly cached: boolean;
    }
  // end engine-added
  | { readonly t: 'heartbeat' } // acknowledgement; transport detects worker loss
  | { readonly t: 'getPublicKey'; readonly req: ReqId }
  /** Transport reconnects and reopens visible queries/windows; actions are not replayed. */
  | { readonly t: 'reconnect' }
  | {
      readonly t: 'ready';
      readonly version: number;
      /** Which engine answers: shown in About. */
      readonly engine: string;
      /** Capability handshake only; account loading failed without an Accounts snapshot. */
      readonly accountError?: { readonly code: 'internal' };
    }
  /** The accounts on this device and the active one (absent: signed out). Sent after `ready` and on change. */
  | { readonly t: 'accounts'; readonly accounts: readonly Account[]; readonly active?: Pubkey }
  /** The whole window, top to bottom. `atTop`: nothing exists above the first row. `atBottom`: nothing below the
   * last (for a live source: nothing older is known and relays have been asked). */
  | {
      readonly t: 'rows';
      readonly sub: SubId;
      readonly rows: readonly Row[];
      readonly atTop: boolean;
      readonly atBottom: boolean;
    }
  /** Since 15. Seating and independent coverage for the requested absolute time. */
  | {
      readonly t: 'timeWindow';
      readonly sub: SubId;
      readonly at: Millis;
      readonly key?: RowKey;
      readonly newer: 'cache-only' | 'unsupported';
      readonly older: 'cache-only' | 'unsupported';
      readonly followList?:
        | { readonly state: 'unknown' }
        | { readonly state: 'latest-verified'; readonly at: Millis; readonly id: string };
    }
  /** Changes to the current window, batched (at most one message per 50–100 ms per subscription). */
  | { readonly t: 'patch'; readonly sub: SubId; readonly ops: readonly PatchOp[] }
  /** Rows exist above the window that it does not show (the window is anchored to a key). 0 clears it. */
  | { readonly t: 'fresh'; readonly sub: SubId; readonly count: number; readonly ownHead?: boolean }
  | { readonly t: 'state'; readonly sub: SubId; readonly state: SubState }
  /** Upload progress. */
  | {
      readonly t: 'progress';
      readonly req: ReqId;
      readonly sent: number;
      readonly total: number;
      readonly server?: string;
      readonly phase?: 'discovering' | 'signing' | 'uploading' | 'processing';
    }
  /** Per-relay delivery of a publish, sent as answers come in (the whole list each time). */
  | { readonly t: 'delivery'; readonly req: ReqId; readonly relays: readonly Delivery[] }
  | { readonly t: 'publish.signed'; readonly req: ReqId; readonly id: string }
  | { readonly t: 'publish.fallback'; readonly req: ReqId }
  /** The end of an action. `delivery`: the final per-relay list of a publish. `uploaded`: of an upload.
   * `id`: of a published note, or of a channel created by `channel.save`. `key`: of `account.key`. */
  | {
      readonly t: 'result';
      readonly req: ReqId;
      readonly ok: boolean;
      /** Explicit cancellation acknowledged by the engine; always accompanies ok=false. */
      readonly cancelled?: boolean;
      readonly error?: Failure;
      readonly delivery?: readonly Delivery[];
      readonly uploaded?: Uploaded;
      readonly id?: string;
      /** Of `account.key`: the `nsec1…`. The interface shows it masked, never stores or logs it. */
      readonly key?: string;
      /** Explicit encrypted backup; never logged or stored by the interface. */
      readonly encryptedKey?: string;
      readonly zapIntent?: ZapIntent;
      /** Distinct participants whose wrapper reached an inbox, including the sender. */
      readonly dmDelivery?: { readonly accepted: number; readonly total: number };
      /** Private draft answers are scoped to the requesting client and never learned as public rows. */
      readonly dmDraft?: DmDraftState;
      /** Opaque account/tab revision, including a currently absent draft. */
      readonly dmDraftRevision?: string;
    }
  /** The account signs with a browser extension (NIP-07 exists only on the main thread): sign this unsigned
   * event (JSON text) and answer with `signed`. */
  | {
      readonly t: 'sign';
      readonly req: ReqId;
      readonly pubkey: Pubkey;
      readonly event: string;
      /** Upload action owning this authorization, so a removed draft cannot open a queued prompt. */
      readonly actionReq?: ReqId;
    }
  /** Connection summary for the optional count in the top bar: of the relays in use or on the reader's list
   * (`wanted`), how many are connected. Sent after `ready` and whenever either number changes. */
  | {
      readonly t: 'status';
      readonly connected: number;
      readonly wanted: number;
      readonly offline: boolean;
    };

/** Protocol 6: private data is separate from public rows and never learned by the profile cache. */
export type DmQuery = {
  /** Frame watch returns unread counts and states without private message bodies. */
  readonly unreadOnly?: boolean;
  readonly account: Pubkey;
  /** The engine canonicalizes this set, adds the account and derives the conversation identity. */
  readonly participants?: readonly Pubkey[];
  readonly conversation?: string;
  readonly before?: string;
  readonly limit?: number;
};
export type DmDraft = {
  readonly emoji?: readonly Emoji[];
  readonly recipients: readonly Pubkey[];
  readonly text: string;
  readonly replyTo?: string;
  readonly subject?: string;
};
export type DmMessage = {
  /** Inert text/link/emoji display data; media addresses remain links. */
  readonly segments?: readonly Segment[];
  readonly reply?: { readonly id: string; readonly author: Pubkey; readonly excerpt: string };
  readonly id: string;
  readonly conversation: string;
  readonly author: Pubkey;
  readonly participants: readonly Pubkey[];
  readonly at: Millis;
  readonly text: string;
  readonly replyTo: string | null;
  readonly subject: string | null;
  readonly legacy: boolean;
  readonly unread: boolean;
};
export type DmConversation = {
  /** Up to two distinct most recent authors other than the reader. */
  readonly recentAuthors?: readonly Pubkey[];
  readonly key: string;
  readonly participants: readonly Pubkey[];
  readonly last: DmMessage;
  readonly unread: number;
};
export type DmSnapshot = {
  readonly conversation?: string;
  readonly people?: readonly Author[];
  /** Only participants whose inbox absence or invalid list has been established. */
  readonly blocked?: readonly Pubkey[];
  /** All observed private unread messages, including conversations beyond the 200-row window. */
  readonly unread?: number;
  readonly account: Pubkey;
  readonly conversations: readonly DmConversation[];
  readonly messages: readonly DmMessage[];
  readonly more: boolean;
  readonly undecryptable: number;
  readonly phase: 'loading' | 'cache' | 'live' | 'failed' | 'unsupported';
  readonly error?: string;
};

/** Only encrypted Worker storage retains these private composer records across reload. */
export type DmDraftState = {
  readonly draft: DmDraft;
  readonly failed: readonly DmFailedDraft[];
};
export type DmFailedDraft = {
  readonly key: string;
  readonly draft: DmDraft;
  readonly error?: Failure;
  readonly dmDelivery?: { readonly accepted: number; readonly total: number };
  readonly id?: string;
};

/** Protocol 9 zap evidence and unpaid invoice contracts. */
export type ZapTarget =
  | { readonly k: 'event'; readonly id: string }
  | { readonly k: 'profile'; readonly pubkey: Pubkey };
export type ZapPhase = 'loading' | 'ready' | 'failed' | 'unsupported';
export type ZapEvidence = {
  readonly phase: ZapPhase;
  readonly unverified: number;
  /** Bounded deferred read history overflowed; ordinary notifications can still be acknowledged. */
  readonly readLimited?: boolean;
};
export type ZapFailure =
  | 'not-found'
  | 'unsupported'
  | 'rejected'
  | 'too-large'
  | 'network'
  | 'untrusted'
  | 'stale'
  | 'expired'
  | 'cancelled'
  | 'signer-missing'
  | 'signer-refused'
  | 'signer-timeout';
export type ZapQuoteInput = { readonly target: ZapTarget; readonly amountMsat?: number };
export type ZapQuoteRecipient = {
  readonly pubkey: Pubkey;
  readonly phase: ZapPhase;
  readonly error: ZapFailure | null;
  readonly amountMsat: number | null;
  readonly minMsat: number | null;
  readonly maxMsat: number | null;
  readonly provider: Pubkey | null;
  readonly domain: string | null;
  readonly description: string | null;
};
export type ZapQuote = {
  readonly target: ZapTarget;
  readonly phase: ZapPhase;
  readonly error: ZapFailure | null;
  readonly recipients: readonly ZapQuoteRecipient[];
};
export type ZapInvoiceInput = {
  readonly target: ZapTarget;
  readonly amountMsat: number;
  readonly comment: string;
};
export type ZapSuccessAction =
  | { readonly k: 'message'; readonly message: string }
  | { readonly k: 'url'; readonly description: string; readonly url: string };
export type ZapInvoice = {
  readonly state: 'unpaid';
  readonly recipient: Pubkey;
  readonly provider: Pubkey;
  readonly target: ZapTarget;
  readonly amountMsat: number;
  readonly invoice: string;
  readonly paymentHash: string;
  readonly expiresAt: Millis;
  readonly successAction: ZapSuccessAction | null;
};
/** No wallet action or relay EVENT is performed. Every split invoice succeeds or the whole result fails. */
export type ZapIntent = {
  readonly state: 'unpaid';
  readonly target: ZapTarget;
  readonly amountMsat: number;
  readonly invoices: readonly ZapInvoice[];
};
export type ZapSender =
  | { readonly k: 'public'; readonly pubkey: Pubkey }
  | { readonly k: 'anonymous' }
  | { readonly k: 'private' };
export type ZapReceipt = {
  readonly id: string;
  readonly createdAt: Millis;
  readonly target: ZapTarget;
  readonly sender: ZapSender;
  readonly recipient: Pubkey;
  readonly provider: Pubkey;
  readonly amountMsat: string;
  readonly verification: 'provider-authorized';
  readonly recipientProfile: string;
  readonly providerEndpoint: string;
  readonly providerObservedAt: Millis;
  readonly verifiedAt: Millis;
};
export type ZapTotal = {
  /** Exact decimal millisatoshis; sats is rounded down once after the sum. */
  readonly amountMsat: string;
  readonly sats: number;
  readonly receipts: number;
  readonly unverified: number;
  readonly phase: ZapPhase;
  readonly limited: boolean;
};
/** Opaque pagination key over retained verified receipts; at is the event's Unix second. */
export type ZapReceiptCursor = { readonly at: number; readonly id: string };
export type ZapReceiptInput = {
  readonly target: ZapTarget;
  readonly before?: ZapReceiptCursor;
  readonly limit: number;
};
export type ZapReceiptPage = {
  readonly target: ZapTarget;
  readonly rows: readonly ZapReceipt[];
  readonly total: ZapTotal;
  readonly cursor: ZapReceiptCursor | null;
  readonly more: boolean;
};
export type ZapReceiptView = {
  readonly target: ZapTarget;
  readonly phase: ZapPhase;
  readonly error: ZapFailure | null;
  /** These requested relay pages only; observed is not a claim about the whole network. */
  readonly coverage: 'loading' | 'observed' | 'truncated' | 'failed';
  readonly page: ZapReceiptPage | null;
};

/** Floored milliseconds since this Worker's performance time origin, not UTC.
 * Values from different Worker lifetimes are not comparable. */
export type StorageTime = number;
export type StorageUnknown = { readonly phase: 'unsupported' | 'failed' | 'timeout' };
/** Exact row count from one readonly events transaction, including ciphertext.
 * `at` records its completion callback; live writes may continue afterward. */
export type StoredEventCount =
  | StorageUnknown
  | {
      readonly phase: 'ready';
      readonly count: number;
      readonly at: StorageTime;
    };
/** Approximate browser estimate across this origin, including other stores.
 * Neither physical disk bytes nor the size of just the event store. */
export type OriginStorage =
  | StorageUnknown
  | {
      readonly phase: 'ready';
      readonly usage: number;
      readonly quota: number;
      readonly approximate: true;
      readonly at: StorageTime;
    };
export type StorageReport = {
  readonly startedAt: StorageTime;
  readonly finishedAt: StorageTime;
  readonly memory: {
    readonly events: number;
    /** Sum of retained event string bytes; excludes allocation/serialization overhead. */
    readonly eventPayloadBytes: number;
    readonly at: StorageTime;
  };
  readonly persistedEvents: StoredEventCount;
  readonly origin: OriginStorage;
};
