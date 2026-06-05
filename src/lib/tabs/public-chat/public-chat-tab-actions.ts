import {
  channelMessageTemplate,
  channelReplyTemplate,
  createChannelTemplate,
  hideMessageTemplate,
  muteUserTemplate,
  publishPublicChatTemplate,
  updateChannelMetadataTemplate,
} from '$lib/public-chat/public-chat-publish';
import { reducePublicChatEvents } from '$lib/public-chat/public-chat-reducer';
import type {
  PublicChatChannel,
  PublicChatMessage,
  PublicChatState,
} from '$lib/public-chat/public-chat-types';
import type { RelaySet } from '$lib/relays/relay-store';

export type PublicChatActionResult = {
  readonly state: PublicChatState;
  readonly status: string;
  readonly clearDraft?: boolean;
  readonly clearReply?: boolean;
  readonly clearNewChannelName?: boolean;
  readonly deliveryStatus?: Promise<string | undefined>;
};

type ActionBase = {
  readonly relaySets: readonly RelaySet[];
  readonly writeRelays: readonly string[];
  readonly state: PublicChatState;
};

export async function createChannelAction(
  input: ActionBase & { readonly name: string },
): Promise<PublicChatActionResult> {
  const queued = await publishPublicChatTemplate(
    createChannelTemplate({ name: input.name.trim() || undefined, relays: [] }),
    input.relaySets,
  );
  return queued.ok
    ? queuedResult(input, queued, 'Channel publish queued.', true)
    : failed(input.state, queued.message);
}

export async function sendMessageAction(
  input: ActionBase & {
    readonly channel: PublicChatChannel;
    readonly draft: string;
    readonly replyTo?: PublicChatMessage;
  },
): Promise<PublicChatActionResult> {
  const text = input.draft.trim();
  const template = input.replyTo
    ? channelReplyTemplate(
        input.channel.id,
        input.replyTo.eventId,
        input.replyTo.eventId,
        text,
      )
    : channelMessageTemplate(input.channel.id, text);
  const queued = await publishPublicChatTemplate(
    template,
    input.relaySets,
    input.channel.relayHints,
  );
  return queued.ok
    ? {
        ...queuedResult(input, queued, 'Message publish queued.'),
        clearDraft: true,
        clearReply: true,
      }
    : failed(input.state, queued.message);
}

export async function editMetadataAction(
  input: ActionBase & {
    readonly channel: PublicChatChannel;
    readonly name: string;
    readonly about: string;
  },
): Promise<PublicChatActionResult> {
  const queued = await publishPublicChatTemplate(
    updateChannelMetadataTemplate(input.channel.id, {
      name: input.name.trim() || undefined,
      about: input.about.trim() || undefined,
      relays: input.channel.relayHints,
    }),
    input.relaySets,
    input.channel.relayHints,
  );
  return queued.ok
    ? queuedResult(input, queued, 'Metadata publish queued.')
    : failed(input.state, queued.message);
}

export async function hideMessageAction(
  input: ActionBase & { readonly message: PublicChatMessage },
): Promise<PublicChatActionResult> {
  const queued = await publishPublicChatTemplate(
    hideMessageTemplate(input.message.eventId),
    input.relaySets,
  );
  return queued.ok
    ? queuedResult(input, queued, 'Hide message publish queued.')
    : failed(input.state, queued.message);
}

export async function muteUserAction(
  input: ActionBase & { readonly message: PublicChatMessage },
): Promise<PublicChatActionResult> {
  const queued = await publishPublicChatTemplate(
    muteUserTemplate(input.message.pubkey),
    input.relaySets,
  );
  return queued.ok
    ? queuedResult(input, queued, 'Mute user publish queued.')
    : failed(input.state, queued.message);
}

async function recordDelivery(
  label: string,
  delivery: Promise<readonly { accepted?: boolean }[]>,
) {
  return (await delivery).some((result) => result.accepted === false)
    ? `${label} had partial relay results.`
    : undefined;
}

function queuedResult(
  input: ActionBase,
  queued: Extract<
    Awaited<ReturnType<typeof publishPublicChatTemplate>>,
    { ok: true }
  >,
  status: string,
  clearNewChannelName = false,
): PublicChatActionResult {
  return {
    state: reducePublicChatEvents(
      input.state,
      [queued.event],
      input.writeRelays,
    ),
    status,
    clearNewChannelName,
    deliveryStatus: recordDelivery(status, queued.delivery),
  };
}

function failed(
  state: PublicChatState,
  message: string,
): PublicChatActionResult {
  return { state, status: message };
}
