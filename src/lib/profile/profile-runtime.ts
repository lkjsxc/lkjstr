import type { ProfileSummary } from '$lib/identity/identity';
import { profileFromMetadataEvent } from '$lib/identity/profile-cache';
import type { NostrEvent } from '$lib/protocol';
import { RelayPool, type PoolEvent } from '$lib/relays/relay-pool';
import {
  cachedProfileEvent,
  cachedProfilePosts,
  storeProfileEvent,
} from './profile-store';

const sharedPool = new RelayPool();

export type ProfileState = {
  readonly profile: ProfileSummary | null;
  readonly posts: readonly NostrEvent[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly relays: readonly string[];
  readonly updatedAt: number | null;
};

export class ProfileRuntime {
  #pool: RelayPool;
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: ProfileState) => void>();
  #state: ProfileState = emptyState();

  constructor(
    readonly pubkey: string,
    readonly relays: readonly string[],
    readonly subId = `profile:${crypto.randomUUID()}`,
    pool?: RelayPool,
  ) {
    this.#pool = pool ?? sharedPool;
  }

  subscribe(listener: (state: ProfileState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    const [meta, posts] = await Promise.all([
      cachedProfileEvent(this.pubkey),
      cachedProfilePosts(this.pubkey),
    ]);
    this.#emit({
      ...this.#state,
      profile: meta ? profileFromMetadataEvent(meta) : null,
      posts,
      loading: this.relays.length > 0,
      updatedAt: meta ? meta.created_at * 1000 : null,
    });
    if (this.relays.length === 0) return;
    this.#cleanup.push(
      this.#pool.onEvent((event) => this.#receive(event)),
      this.#pool.subscribe(this.relays, this.subId, [
        { kinds: [0], authors: [this.pubkey], limit: 1 },
        { kinds: [1], authors: [this.pubkey], limit: 30 },
      ]),
    );
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false });
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId !== this.subId) return;
    await storeProfileEvent(poolEvent.event);
    if (poolEvent.event.kind === 0) this.#receiveMeta(poolEvent);
    if (poolEvent.event.kind === 1) this.#receivePost(poolEvent.event);
  }

  #receiveMeta(poolEvent: PoolEvent): void {
    this.#emit({
      ...this.#state,
      profile: profileFromMetadataEvent(poolEvent.event),
      loading: false,
      relays: [...new Set([...this.#state.relays, poolEvent.relay])],
      updatedAt: poolEvent.event.created_at * 1000,
    });
  }

  #receivePost(event: NostrEvent): void {
    const posts = [
      event,
      ...this.#state.posts.filter((item) => item.id !== event.id),
    ]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 30);
    this.#emit({ ...this.#state, posts, loading: false });
  }

  #emit(state: ProfileState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  }
}

function emptyState(): ProfileState {
  return {
    profile: null,
    posts: [],
    loading: true,
    error: null,
    relays: [],
    updatedAt: null,
  };
}
