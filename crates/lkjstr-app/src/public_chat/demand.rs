use lkjstr_protocol::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA,
    KIND_CHANNEL_MUTE_USER, NostrFilter,
};
use lkjstr_relays::{DemandPhase, DemandPurpose, DemandVisibility};

use crate::{PublicChatQueryInput, QueryDemandInput, QuerySurface};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicChatDemandContext {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub phase: DemandPhase,
    pub now_sec: u64,
}

#[must_use]
pub fn channel_discovery_query_input(
    context: PublicChatDemandContext,
    input: &PublicChatQueryInput,
) -> QueryDemandInput {
    public_chat_query(
        context,
        input,
        None,
        DemandPurpose::Feed,
        filter(vec![KIND_CHANNEL_CREATE], None, None, input.limit),
    )
}

#[must_use]
pub fn channel_metadata_query_input(
    context: PublicChatDemandContext,
    input: &PublicChatQueryInput,
) -> Option<QueryDemandInput> {
    if input.channel_ids.is_empty() {
        return None;
    }
    Some(public_chat_query(
        context,
        input,
        Some("metadata".to_owned()),
        DemandPurpose::Metadata,
        filter(
            vec![KIND_CHANNEL_METADATA],
            Some(("e", input.channel_ids.clone())),
            None,
            input.limit,
        ),
    ))
}

#[must_use]
pub fn selected_channel_messages_query_input(
    context: PublicChatDemandContext,
    input: &PublicChatQueryInput,
) -> Option<QueryDemandInput> {
    let channel_id = input.selected_channel_id.clone()?;
    Some(public_chat_query(
        context,
        input,
        Some(channel_id.clone()),
        DemandPurpose::Feed,
        filter(
            vec![KIND_CHANNEL_MESSAGE],
            Some(("e", vec![channel_id])),
            None,
            input.limit,
        ),
    ))
}

#[must_use]
pub fn own_hide_query_input(
    context: PublicChatDemandContext,
    input: &PublicChatQueryInput,
) -> Option<QueryDemandInput> {
    let author = input.active_pubkey.clone()?;
    if input.loaded_message_ids.is_empty() {
        return None;
    }
    Some(public_chat_query(
        context,
        input,
        Some("moderation-hide".to_owned()),
        DemandPurpose::EventLookup,
        filter(
            vec![KIND_CHANNEL_HIDE_MESSAGE],
            Some(("e", input.loaded_message_ids.clone())),
            Some(vec![author]),
            input.limit,
        ),
    ))
}

#[must_use]
pub fn own_mute_query_input(
    context: PublicChatDemandContext,
    input: &PublicChatQueryInput,
) -> Option<QueryDemandInput> {
    let author = input.active_pubkey.clone()?;
    if input.loaded_author_pubkeys.is_empty() {
        return None;
    }
    Some(public_chat_query(
        context,
        input,
        Some("moderation-mute".to_owned()),
        DemandPurpose::EventLookup,
        filter(
            vec![KIND_CHANNEL_MUTE_USER],
            Some(("p", input.loaded_author_pubkeys.clone())),
            Some(vec![author]),
            input.limit,
        ),
    ))
}

fn public_chat_query(
    context: PublicChatDemandContext,
    input: &PublicChatQueryInput,
    channel: Option<String>,
    purpose: DemandPurpose,
    filter: NostrFilter,
) -> QueryDemandInput {
    QueryDemandInput {
        surface: QuerySurface::PublicChat,
        owner: context.owner,
        channel,
        visibility: context.visibility,
        phase: context.phase,
        selected_relays: super::route_relays(input),
        authors: Vec::new(),
        author_routes: Vec::new(),
        disabled_relays: input.disabled_relays.clone(),
        filters: vec![filter],
        purpose,
        since: None,
        until: None,
        limit: Some(input.limit),
        now_sec: context.now_sec,
    }
}

fn filter(
    kinds: Vec<u64>,
    tag: Option<(&str, Vec<String>)>,
    authors: Option<Vec<String>>,
    limit: u64,
) -> NostrFilter {
    let mut filter = NostrFilter {
        kinds: Some(kinds),
        authors,
        limit: Some(limit),
        ..NostrFilter::default()
    };
    if let Some((name, values)) = tag {
        filter.tags.insert(name.to_owned(), values);
    }
    filter
}
