import type { NostrTag } from '../protocol';
import { kinds } from '../protocol';
import {
  signAndPublish,
  type EventPublishStatus,
} from '../events/publish-event';
import type { RelaySet } from '../relays/relay-store';
import { latestEventByAuthorKind } from '../events/repository';
import { storeProfileEvent } from './profile-store';
import { activeAccount } from '../accounts/account-store';
import {
  mergeProfileMetadataDraft,
  profileUpdatedEvent,
  type ProfileMetadataDraft,
} from './profile-metadata-draft';

export async function loadFollowState(
  accountPubkey: string,
  targetPubkey: string,
): Promise<boolean> {
  const event = (await latestEventByAuthorKind(accountPubkey, kinds.followList))
    ?.event;
  return Boolean(
    event?.tags.some((tag) => tag[0] === 'p' && tag[1] === targetPubkey),
  );
}

export async function publishFollowMutation(
  targetPubkey: string,
  follow: boolean,
  relaySets: readonly RelaySet[],
): Promise<EventPublishStatus> {
  const account = await activeAccount();
  if (!account) return { ok: false, message: 'Add a signing account first.' };
  const tags = await nextFollowTags(account.pubkey, targetPubkey, follow);
  return signAndPublish(
    (pubkey) => ({
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: kinds.followList,
      tags,
      content: '',
    }),
    relaySets,
  );
}

export async function publishProfileMetadata(
  updates: ProfileMetadataDraft,
  relaySets: readonly RelaySet[],
  expectedPubkey?: string,
): Promise<EventPublishStatus> {
  const account = await activeAccount();
  if (!account) return { ok: false, message: 'Add a signing account first.' };
  if (expectedPubkey && account.pubkey !== expectedPubkey)
    return {
      ok: false,
      message: 'Active account changed before profile save.',
    };
  const metadata = mergeProfileMetadataDraft(
    await cachedMetadata(account.pubkey),
    updates,
  );
  const result = await signAndPublish(
    (pubkey) => ({
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: kinds.metadata,
      tags: [],
      content: JSON.stringify(metadata),
    }),
    relaySets,
  );
  if (result.ok) {
    await storeProfileEvent(result.event);
    dispatchProfileUpdated(account.pubkey);
  }
  return result;
}

export async function loadProfileMetadata(
  pubkey: string,
): Promise<Record<string, unknown>> {
  return cachedMetadata(pubkey);
}

async function nextFollowTags(
  pubkey: string,
  targetPubkey: string,
  follow: boolean,
): Promise<NostrTag[]> {
  const current = await cachedFollowTags(pubkey);
  const without = current.filter(
    (tag) => !(tag[0] === 'p' && tag[1] === targetPubkey),
  );
  return follow ? [...without, ['p', targetPubkey]] : without;
}

async function cachedFollowTags(pubkey: string): Promise<NostrTag[]> {
  return [
    ...((await latestEventByAuthorKind(pubkey, kinds.followList))?.event.tags ??
      []),
  ];
}

async function cachedMetadata(
  pubkey: string,
): Promise<Record<string, unknown>> {
  const content = (await latestEventByAuthorKind(pubkey, kinds.metadata))?.event
    .content;
  if (!content) return {};
  try {
    const value = JSON.parse(content) as unknown;
    return typeof value === 'object' && value
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function dispatchProfileUpdated(pubkey: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(profileUpdatedEvent, { detail: pubkey }),
  );
}
