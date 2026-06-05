import { resolveActiveSigner } from '$lib/accounts/signer';
import { upsertEvent } from '$lib/events/repository';
import { kinds, type NostrEvent, type NostrTag } from '$lib/protocol';
import { sharedRelayPool, type PublishResult } from '$lib/relays/relay-pool';
import type { RelaySet } from '$lib/relays/relay-store';
import { selectedUserWriteRelays } from '$lib/relays/relay-selection';
import { channelReplyTags, channelRootTag } from './public-chat-metadata';
import type {
  PublicChatMetadata,
  PublicChatPublishTemplate,
} from './public-chat-types';

export type PublicChatQueuedPublish =
  | {
      readonly ok: true;
      readonly event: NostrEvent;
      readonly delivery: Promise<PublishResult[]>;
    }
  | { readonly ok: false; readonly message: string };

export async function publishPublicChatTemplate(
  template: PublicChatPublishTemplate,
  relaySets: readonly RelaySet[],
  extraRelays: readonly string[] = [],
): Promise<PublicChatQueuedPublish> {
  const signer = await signerResult();
  if (!signer.ok) return signer;
  const relays = [
    ...new Set([...selectedUserWriteRelays(relaySets), ...extraRelays]),
  ];
  if (relays.length === 0)
    return { ok: false, message: 'Enable at least one write relay.' };
  const event = await signer.signEvent({
    pubkey: signer.account.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: template.kind,
    tags: template.tags,
    content: template.content,
  });
  await upsertEvent(event, relays);
  return { ok: true, event, delivery: sharedRelayPool.publish(relays, event) };
}

export function createChannelTemplate(
  metadata: PublicChatMetadata,
): PublicChatPublishTemplate {
  return {
    kind: kinds.channelCreate,
    content: JSON.stringify(metadata),
    tags: [],
  };
}

export function updateChannelMetadataTemplate(
  channelId: string,
  metadata: PublicChatMetadata,
): PublicChatPublishTemplate {
  return {
    kind: kinds.channelMetadata,
    content: JSON.stringify(metadata),
    tags: [channelRootTag(channelId)],
  };
}

export function channelMessageTemplate(
  channelId: string,
  content: string,
): PublicChatPublishTemplate {
  return {
    kind: kinds.channelMessage,
    content,
    tags: [channelRootTag(channelId)],
  };
}

export function channelReplyTemplate(
  channelId: string,
  rootMessageId: string,
  replyMessageId: string,
  content: string,
): PublicChatPublishTemplate {
  return {
    kind: kinds.channelMessage,
    content,
    tags: channelReplyTags(channelId, rootMessageId, replyMessageId),
  };
}

export function hideMessageTemplate(
  messageId: string,
  reason = '',
): PublicChatPublishTemplate {
  return {
    kind: kinds.channelHideMessage,
    content: reason,
    tags: [['e', messageId]],
  };
}

export function muteUserTemplate(
  pubkey: string,
  reason = '',
): PublicChatPublishTemplate {
  return {
    kind: kinds.channelMuteUser,
    content: reason,
    tags: [['p', pubkey]],
  };
}

async function signerResult() {
  try {
    return { ok: true as const, ...(await resolveActiveSigner()) };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'Signing failed.',
    };
  }
}

export function templateTags(
  template: PublicChatPublishTemplate,
): readonly NostrTag[] {
  return template.tags;
}
