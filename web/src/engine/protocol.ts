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
 * create an account on it. */
export const PROTOCOL_VERSION = 2;

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
  | 'diagnostics'; // info rows about the engine itself

export type NotificationType = 'mention' | 'reply' | 'repost' | 'reaction' | 'zap' | 'follow';

/** What a subscription shows. Fields that do not apply to a source are ignored. */
export type Query = {
  readonly source: Source;
  /** The acting account (whose follows, mutes and own state apply). Absent: reading signed out. */
  readonly account?: Pubkey;
  /** `profile`, `followers`, `following`: whose. */
  readonly pubkey?: Pubkey;
  /** `thread`: the focused note (event id, hex). */
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
  /** Words every note must contain (any case). For `search` this is the search itself. */
  readonly text?: string;
};

/** Where a window sits. `top` follows the head of the list: new rows are inserted as they arrive. A key holds
 * the list still around that row: rows that arrive above are only counted (`fresh`). */
export type Anchor = 'top' | { readonly key: RowKey };

// ───────────────────────────────────────── view models ─────────────────────────────────────────

export type Emoji = { readonly code: string; readonly url: string };

export type Author = {
  readonly pubkey: Pubkey;
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
  readonly replies: number;
  readonly reposts: number;
  readonly reactions: number;
  /** Sum of zap receipts in sats. */
  readonly zaps: number;
  /** The numbers are lower bounds: not every relay asked has answered. Drawn as "12+". */
  readonly partial: boolean;
};

export type NoteRow = {
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
  /** `thread` source only. `depth` 0 for ancestors and the focus, 1+ for replies. */
  readonly thread?: { readonly role: 'ancestor' | 'focus' | 'reply'; readonly depth: number };
  /** The client that wrote it, when tagged. */
  readonly client?: string;
  /** Not confirmed by any relay yet (the reader's own note, just sent). */
  readonly pending?: boolean;
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
  readonly comment?: string;
  /** The reader's note it is about (reaction, repost, zap): opened by a press on the excerpt. */
  readonly target?: { readonly id: string; readonly excerpt: string; readonly media: number };
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
  readonly ok: boolean;
};

export type EmojiRow = {
  readonly kind: 'emoji';
  readonly key: RowKey;
  /** Name of the set it belongs to ('' for the account's own list). */
  readonly set: string;
  readonly code: string;
  readonly url: string;
};

/** A labelled fact (`diagnostics`): event store size, protocol version, the worker kind in use. */
export type InfoRow = {
  readonly kind: 'info';
  readonly key: RowKey;
  readonly label: string;
  readonly value: string;
};

export type Row =
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

export type Draft = {
  readonly text: string;
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
  | { readonly k: 'reaction'; readonly id: string; readonly emoji: string; readonly url?: string }
  /** Deletes the reader's own event: a note, their repost of `id` (`of: 'repost'`) or their reaction to it. */
  | {
      readonly k: 'delete';
      readonly id: string;
      readonly of?: 'note' | 'repost' | 'reaction';
      readonly emoji?: string;
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

export type RelayEntry = { readonly url: string; readonly read: boolean; readonly write: boolean };

/** Everything the reader can do. Every action acts as `as` and is answered by exactly one `result`. */
export type Action =
  | { readonly a: 'publish'; readonly as: Pubkey; readonly what: Publish }
  | { readonly a: 'follow'; readonly as: Pubkey; readonly pubkey: Pubkey; readonly on: boolean }
  /** `on: false` takes a mute back. Either way the `mutes` rows and every open list are patched at once. */
  | { readonly a: 'mute'; readonly as: Pubkey; readonly target: MuteTarget; readonly on: boolean }
  | { readonly a: 'bookmark'; readonly as: Pubkey; readonly id: string; readonly on: boolean }
  /** `bytes` is transferred, not copied. Answered by `progress` messages and a `result` with `uploaded`. */
  | {
      readonly a: 'upload';
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
  /** Marks notifications read up to now. */
  | { readonly a: 'seen'; readonly as: Pubkey }
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
    | 'signer-missing'
    | 'no-relays'
    | 'rejected'
    | 'too-large'
    | 'unsupported'
    | 'offline'
    | 'not-found'
    | 'internal';
  readonly message?: string;
};

export type Account = {
  readonly author: Author;
  readonly signer: 'local' | 'extension' | 'remote' | 'none';
  /** Notifications that arrived since `seen`. */
  readonly unread: number;
};

/** Network and device facts the interface can see and the engine cannot. */
export type Hint = {
  /** Subscriptions whose tab is in front; the others may be paused. */
  readonly visibleSubs: readonly SubId[];
  readonly pageHidden: boolean;
  /** No input for a few minutes. */
  readonly idle: boolean;
  readonly saveData: boolean;
  readonly effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  readonly deviceMemory?: number;
};

/** Engine-side settings. The interface stores settings and sends the whole object whenever one changes. */
export type EngineConfig = {
  /** Interface language, for the engine's language heuristics. */
  readonly language: string;
  /** Hide notes the engine judges to be repeated or spam (shown as one quiet line each). */
  readonly heuristics: boolean;
  /** Fetch link and media metadata ahead of the viewport. */
  readonly prefetch: boolean;
  /** The mock only: arrivals on a timer, or a still world for screenshots and tests. */
  readonly mock?: { readonly live: boolean; readonly accounts?: 'none' };
};

// ───────────────────────────────────────── messages ─────────────────────────────────────────

export type ToEngine =
  | { readonly t: 'configure'; readonly config: EngineConfig }
  /** Replaces bootstrap relay usage; at most eight. Independent of EngineConfig. */
  | {
      readonly t: 'relays';
      readonly relays: readonly (RelayEntry & { readonly search: boolean })[];
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
  | { readonly t: 'open'; readonly sub: SubId; readonly query: Query }
  | { readonly t: 'close'; readonly sub: SubId }
  /** Asks for the rows around `anchor`: up to `before` rows above it and `after` rows from it downwards (the
   * anchor row itself counts as the first of `after`). Answered by `rows`; replaces any earlier window. */
  | {
      readonly t: 'window';
      readonly sub: SubId;
      readonly anchor: Anchor;
      readonly before: number;
      readonly after: number;
    }
  | { readonly t: 'act'; readonly req: ReqId; readonly action: Action }
  /** Answer to `sign`: the signed event as JSON text, or why not. */
  | { readonly t: 'signed'; readonly req: ReqId; readonly event?: string; readonly error?: string };

export type FromEngine =
  | { readonly t: 'heartbeat' } // acknowledgement; transport detects worker loss
  | { readonly t: 'getPublicKey'; readonly req: ReqId }
  /** Transport reconnects and reopens visible queries/windows; actions are not replayed. */
  | { readonly t: 'reconnect' }
  | {
      readonly t: 'ready';
      readonly version: number;
      /** Which engine answers: shown in About. */
      readonly engine: string;
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
  /** Changes to the current window, batched (at most one message per 50–100 ms per subscription). */
  | { readonly t: 'patch'; readonly sub: SubId; readonly ops: readonly PatchOp[] }
  /** Rows exist above the window that it does not show (the window is anchored to a key). 0 clears it. */
  | { readonly t: 'fresh'; readonly sub: SubId; readonly count: number }
  | { readonly t: 'state'; readonly sub: SubId; readonly state: SubState }
  /** Upload progress. */
  | { readonly t: 'progress'; readonly req: ReqId; readonly sent: number; readonly total: number }
  /** Per-relay delivery of a publish, sent as answers come in (the whole list each time). */
  | { readonly t: 'delivery'; readonly req: ReqId; readonly relays: readonly Delivery[] }
  /** The end of an action. `delivery`: the final per-relay list of a publish. `uploaded`: of an upload.
   * `id`: of a published note. `key`: of `account.key`. */
  | {
      readonly t: 'result';
      readonly req: ReqId;
      readonly ok: boolean;
      readonly error?: Failure;
      readonly delivery?: readonly Delivery[];
      readonly uploaded?: Uploaded;
      readonly id?: string;
      /** Of `account.key`: the `nsec1…`. The interface shows it masked, never stores or logs it. */
      readonly key?: string;
    }
  /** The account signs with a browser extension (NIP-07 exists only on the main thread): sign this unsigned
   * event (JSON text) and answer with `signed`. */
  | { readonly t: 'sign'; readonly req: ReqId; readonly pubkey: Pubkey; readonly event: string }
  /** Connection summary for the optional count in the top bar: of the relays in use or on the reader's list
   * (`wanted`), how many are connected. Sent after `ready` and whenever either number changes. */
  | {
      readonly t: 'status';
      readonly connected: number;
      readonly wanted: number;
      readonly offline: boolean;
    };
