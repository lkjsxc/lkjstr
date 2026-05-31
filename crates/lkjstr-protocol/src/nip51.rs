use serde::{Deserialize, Serialize};

use crate::{
    CustomEmoji, KIND_EMOJI_SET, NostrEvent, custom_emoji_tag, valid_custom_emoji_address,
};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct EmojiAddress {
    pub address: String,
    pub pubkey: String,
    pub identifier: String,
}

pub fn account_emoji_source(lists: &[NostrEvent], sets: &[NostrEvent]) -> Vec<CustomEmoji> {
    let list = newest_event(lists);
    let mut events = Vec::new();
    if let Some(item) = list {
        events.push(item);
    }
    events.extend(newest_events_by_address(sets));
    dedupe_custom_emoji_by_shortcode(
        &events
            .iter()
            .flat_map(custom_emojis_from_event)
            .collect::<Vec<_>>(),
    )
}

pub fn custom_emojis_from_event(event: &NostrEvent) -> Vec<CustomEmoji> {
    let address = emoji_set_address(event);
    event
        .tags
        .iter()
        .filter_map(|tag| custom_emoji_tag(tag))
        .map(|mut emoji| {
            if emoji.address.is_none()
                && let Some(value) = &address
            {
                emoji.address = Some(value.to_owned());
            }
            emoji
        })
        .collect()
}

pub fn emoji_addresses_from_lists(events: &[NostrEvent]) -> Vec<EmojiAddress> {
    let mut items = Vec::new();
    for event in events {
        for tag in &event.tags {
            if tag.first().is_some_and(|name| name == "a")
                && let Some(address) = tag.get(1).and_then(|value| parse_address(value))
                && !items
                    .iter()
                    .any(|item: &EmojiAddress| item.address == address.address)
            {
                items.push(address);
            }
        }
    }
    items
}

pub fn emoji_set_address(event: &NostrEvent) -> Option<String> {
    if event.kind != KIND_EMOJI_SET {
        return None;
    }
    let identifier = event
        .tags
        .iter()
        .find(|tag| tag.first().is_some_and(|name| name == "d"))
        .and_then(|tag| tag.get(1))
        .filter(|value| !value.is_empty())?;
    let address = format!("30030:{}:{identifier}", event.pubkey);
    valid_custom_emoji_address(&address).then_some(address)
}

pub fn newest_event(events: &[NostrEvent]) -> Option<NostrEvent> {
    let mut items = events.to_vec();
    items.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    items.into_iter().next()
}

pub fn newest_events_by_address(events: &[NostrEvent]) -> Vec<NostrEvent> {
    let mut items: Vec<NostrEvent> = events
        .iter()
        .filter(|event| emoji_set_address(event).is_some())
        .cloned()
        .collect();
    items.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    let mut kept = Vec::new();
    for event in items {
        let address = emoji_set_address(&event);
        if address.is_some() && !kept.iter().any(|item| emoji_set_address(item) == address) {
            kept.push(event);
        }
    }
    kept
}

pub fn dedupe_custom_emoji_by_shortcode(items: &[CustomEmoji]) -> Vec<CustomEmoji> {
    let mut kept = Vec::<CustomEmoji>::new();
    for item in items.iter().rev() {
        if !kept.iter().any(|emoji| emoji.shortcode == item.shortcode) {
            kept.push(item.clone());
        }
    }
    kept.sort_by(|a, b| a.shortcode.cmp(&b.shortcode));
    kept
}

fn parse_address(value: &str) -> Option<EmojiAddress> {
    if !valid_custom_emoji_address(value) {
        return None;
    }
    let mut parts = value.splitn(3, ':');
    let _kind = parts.next()?;
    let pubkey = parts.next()?.to_owned();
    let identifier = parts.next()?.to_owned();
    Some(EmojiAddress {
        address: value.to_owned(),
        pubkey,
        identifier,
    })
}
