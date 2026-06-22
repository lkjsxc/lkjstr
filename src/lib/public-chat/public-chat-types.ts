import type { NostrEvent, NostrFilter, NostrTag } from '$lib/protocol';
import type { PublishResult } from '$lib/relays/relay-pool';
import type { RelayRequestPurpose } from '$lib/relays/relay-request-compat';

export type PublicChatMetadata = {
  readonly name?: string;
  readonly about?: string;
  readonly picture?: string;
  readonly relays: readonly string[];
};

export type PublicChatChannel = {
  readonly id: string;
  readonly creatorPubkey: string;
  readonly createdAt: number;
  readonly metadata: PublicChatMetadata;
  readonly metadataEventId?: string;
  readonly metadataUpdatedAt?: number;
  readonly relayHints: readonly string[];
  readonly lastMessageAt?: number;
};

export type PublicChatMessage = {
  readonly eventId: string;
  readonly channelId: string;
  readonly pubkey: string;
  readonly createdAt: number;
  readonly content: string;
  readonly replyTo?: string;
  readonly relayUrls: readonly string[];
  readonly hidden: boolean;
  readonly mutedAuthor: boolean;
};

export type PublicChatCoverage = {
  readonly relays: readonly string[];
  readonly incomplete: boolean;
  readonly diagnostics: readonly string[];
};

export type PublicChatPublishStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'queued'; readonly event: NostrEvent }
  | {
      readonly kind: 'partial';
      readonly event: NostrEvent;
      readonly results: readonly PublishResult[];
    }
  | { readonly kind: 'failed'; readonly message: string };

export type PublicChatState = {
  readonly channels: readonly PublicChatChannel[];
  readonly selectedChannelId?: string;
  readonly messages: readonly PublicChatMessage[];
  readonly channelCoverage: PublicChatCoverage;
  readonly messageCoverage: PublicChatCoverage;
  readonly hiddenMessageIds: readonly string[];
  readonly mutedPubkeys: readonly string[];
};

export type PublicChatReadPlan = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly purpose: RelayRequestPurpose;
};

export type PublicChatPublishTemplate = {
  readonly kind: number;
  readonly content: string;
  readonly tags: readonly NostrTag[];
};
