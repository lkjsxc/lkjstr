use lkjstr_protocol::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA,
    KIND_CHANNEL_MUTE_USER, NostrFilter,
};

use crate::public_chat::{PublicChatQueryInput, PublicChatReadPlan};

#[must_use]
pub fn channel_discovery_plan(input: &PublicChatQueryInput) -> PublicChatReadPlan {
    let relays = route_relays(input);
    read_plan(
        format!("public-chat:channels:{}", relays.join(",")),
        relays,
        filter(vec![KIND_CHANNEL_CREATE], None, None, input.limit),
    )
}

#[must_use]
pub fn channel_metadata_plan(input: &PublicChatQueryInput) -> Option<PublicChatReadPlan> {
    if input.channel_ids.is_empty() {
        return None;
    }
    let relays = route_relays(input);
    let channel_key = input.channel_ids.join(",");
    Some(read_plan(
        format!("public-chat:metadata:{channel_key}:{}", relays.join(",")),
        relays,
        filter(
            vec![KIND_CHANNEL_METADATA],
            Some(("e", input.channel_ids.clone())),
            None,
            input.limit,
        ),
    ))
}

#[must_use]
pub fn selected_channel_messages_plan(input: &PublicChatQueryInput) -> Option<PublicChatReadPlan> {
    let channel_id = input.selected_channel_id.clone()?;
    let relays = route_relays(input);
    Some(read_plan(
        format!("public-chat:messages:{channel_id}:{}", relays.join(",")),
        relays,
        filter(
            vec![KIND_CHANNEL_MESSAGE],
            Some(("e", vec![channel_id])),
            None,
            input.limit,
        ),
    ))
}

#[must_use]
pub fn own_hide_plan(input: &PublicChatQueryInput) -> Option<PublicChatReadPlan> {
    let author = input.active_pubkey.clone()?;
    if input.loaded_message_ids.is_empty() {
        return None;
    }
    let relays = route_relays(input);
    Some(read_plan(
        format!("public-chat:moderation:{author}:hide"),
        relays,
        filter(
            vec![KIND_CHANNEL_HIDE_MESSAGE],
            Some(("e", input.loaded_message_ids.clone())),
            Some(vec![author]),
            input.limit,
        ),
    ))
}

#[must_use]
pub fn own_mute_plan(input: &PublicChatQueryInput) -> Option<PublicChatReadPlan> {
    let author = input.active_pubkey.clone()?;
    if input.loaded_author_pubkeys.is_empty() {
        return None;
    }
    let relays = route_relays(input);
    Some(read_plan(
        format!("public-chat:moderation:{author}:mute"),
        relays,
        filter(
            vec![KIND_CHANNEL_MUTE_USER],
            Some(("p", input.loaded_author_pubkeys.clone())),
            Some(vec![author]),
            input.limit,
        ),
    ))
}

#[must_use]
pub fn route_relays(input: &PublicChatQueryInput) -> Vec<String> {
    let mut relays = Vec::new();
    for relay in &input.selected_read_relays {
        if !input.disabled_relays.contains(relay) && !relays.contains(relay) {
            relays.push(relay.clone());
        }
    }
    let mut added_hints = 0usize;
    for relay in &input.relay_hints {
        if added_hints >= input.max_hint_relays {
            break;
        }
        if !input.disabled_relays.contains(relay) && !relays.contains(relay) {
            relays.push(relay.clone());
            added_hints += 1;
        }
    }
    relays
}

fn read_plan(demand_key: String, relays: Vec<String>, filter: NostrFilter) -> PublicChatReadPlan {
    PublicChatReadPlan {
        demand_key,
        relays,
        filters: vec![filter],
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
