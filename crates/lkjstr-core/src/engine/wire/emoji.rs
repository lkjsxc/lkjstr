//! Optional emoji provenance never changes the event-owned code or picture.
use crate::{engine::rows::Reaction, store::Store};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

pub(super) fn with_details(mut value: Value, address: Option<&str>, set: Option<&str>) -> Value {
    if let Some(address) = address {
        value["address"] = json!(address);
    }
    if let Some(set) = set {
        value["set"] = json!(set);
    }
    value
}
pub(super) fn entry(entry: crate::engine::emoji::Entry) -> Value {
    let row = json!({"kind":"emoji","key":entry.key(),"source":entry.source,
        "set":entry.set,"code":entry.code,"url":entry.url});
    with_details(row, entry.address.as_deref(), None)
}
pub(super) fn inline(store: &Store, event: Option<&NostrEvent>, code: &str, url: &str) -> Value {
    let (address, set) = event
        .map(|event| crate::engine::emoji::details(store, event, code, url))
        .unwrap_or_default();
    with_details(
        json!({"k":"emoji","code":code,"url":url}),
        address.as_deref(),
        set.as_deref(),
    )
}
pub(super) fn reaction(store: &Store, event: &NostrEvent) -> Value {
    let mut value = json!({"emoji":crate::reactions::label(&event.content)});
    if let Some(url) = crate::reactions::image_url(event) {
        let (address, set) = lkjstr_protocol::custom_emoji_reaction_shortcode(&event.content)
            .map(|code| crate::engine::emoji::details(store, event, &code, &url))
            .unwrap_or_default();
        value["url"] = json!(url);
        value = with_details(value, address.as_deref(), set.as_deref());
    }
    value
}
pub(super) fn chip(reaction: &Reaction) -> Value {
    let mut value = json!({"emoji":reaction.content,"count":reaction.count,"mine":reaction.mine});
    if let Some(url) = &reaction.url {
        value["url"] = json!(url);
    }
    with_details(value, reaction.address.as_deref(), reaction.set.as_deref())
}
