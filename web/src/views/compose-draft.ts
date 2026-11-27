import type { Draft, Emoji, Mention, Uploaded } from '../engine/protocol.ts';
import type { Quoted, Ref } from './compose-context.ts';
import type { ChannelDraft } from './compose-outbox.ts';

export type ComposeState = {
  text?: string;
  outbox?: ChannelDraft[];
  fromHomeDraft?: string;
  replyTo?: string;
  replyOf?: Ref;
  quote?: string;
  quoteOf?: Quoted;
  /** Content warning: its reason ('' for none); absent when off. */
  cw?: string;
  title?: string;
  /** Custom emoji put into the text with the picker. */
  emoji?: readonly Emoji[];
  media?: Uploaded[];
  mentions?: Mention[];
};

export function composeDraft(
  state: ComposeState,
  text: string,
  media: Uploaded[],
  channel?: string,
): Draft {
  return {
    text,
    mentions: state.mentions,
    channel,
    replyTo: state.replyTo,
    quote: state.quote,
    cw: state.cw,
    media,
    emoji: (state.emoji ?? []).filter((e) => text.includes(`:${e.code}:`)),
  };
}

export function restoredDraft(state: ComposeState, draft: Draft): ComposeState {
  return {
    ...state,
    text: draft.text,
    replyTo: draft.replyTo,
    quote: draft.quote,
    quoteOf: draft.quote && draft.quote === state.quote ? state.quoteOf : undefined,
    cw: draft.cw,
    emoji: [...(draft.emoji ?? [])],
    mentions: [...(draft.mentions ?? [])],
    media: [...(draft.media ?? [])],
  };
}
