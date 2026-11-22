//! Bounded public generic projection. Private content never enters this path.
use crate::store::Store;
use lkjstr_protocol::{AddressPointer, EventPointer, NostrEvent, encode_naddr, encode_nevent};
use serde_json::{Value, json};

pub(super) fn copy_reference(event: &NostrEvent) -> Option<(String, String)> {
    let addressable = matches!(event.kind, 0 | 3 | 10000..=19999 | 30000..=39999);
    if addressable {
        let identifier = if event.kind >= 30000 {
            event
                .tags
                .iter()
                .find(|tag| tag.first().is_some_and(|v| v == "d"))
                .and_then(|tag| tag.get(1))
                .cloned()
                .unwrap_or_default()
        } else {
            String::new()
        };
        let pointer = AddressPointer {
            kind: event.kind,
            pubkey: event.pubkey.clone(),
            identifier,
            relays: None,
        };
        encode_naddr(&pointer)
            .ok()
            .map(|reference| ("a".into(), reference))
    } else {
        let pointer = EventPointer {
            id: event.id.clone(),
            author: Some(event.pubkey.clone()),
            kind: Some(event.kind),
            relays: None,
        };
        encode_nevent(&pointer)
            .ok()
            .map(|reference| ("n".into(), reference))
    }
}

fn meaning(name: &str) -> Option<&'static str> {
    match name {
        "e" | "a" | "q" => Some("event"),
        "p" => Some("person"),
        "t" => Some("topic"),
        "r" | "url" => Some("link"),
        "relay" => Some("relay"),
        "d" => Some("id"),
        "title" | "name" => Some("title"),
        "image" | "thumb" => Some("image"),
        "summary" | "description" => Some("summary"),
        _ => None,
    }
}
fn reference(name: &str, value: &str) -> Option<Value> {
    match name {
        "e" | "q" if lkjstr_protocol::is_event_id(value) => {
            Some(json!({"type":"event","id":value}))
        }
        "a" => {
            let coordinate = lkjstr_nips::address::Coordinate::parse(value).ok()?;
            if !crate::kinds::policy(coordinate.kind as u64).openable {
                return None;
            }
            Some(
                json!({"type":"address","kind":coordinate.kind,"author":coordinate.pubkey,"d":coordinate.identifier}),
            )
        }
        "p" if lkjstr_protocol::is_pubkey(value) => Some(json!({"type":"person","pubkey":value})),
        "t" => Some(json!({"type":"topic","tag":value})),
        "r" | "url" | "image" | "thumb"
            if value.starts_with("https://") || value.starts_with("http://") =>
        {
            Some(json!({"type":"link","url":value}))
        }
        "relay" if value.starts_with("wss://") || value.starts_with("ws://") => {
            Some(json!({"type":"relay","url":value}))
        }
        _ => None,
    }
}
pub(super) fn face(event: &NostrEvent, store: &Store) -> Value {
    let alt = event
        .tags
        .iter()
        .find(|tag| tag.first().is_some_and(|s| s == "alt"))
        .and_then(|tag| tag.get(1))
        .filter(|text| !text.is_empty());
    let content = event.content.trim();
    let data = !content.is_empty()
        && (serde_json::from_str::<Value>(content).is_ok()
            || (content.len() > 120 && !content.contains(char::is_whitespace)));
    let form = if content.is_empty() {
        "empty"
    } else if data {
        "data"
    } else {
        "text"
    };
    let tags = event
        .tags
        .iter()
        .take(64)
        .filter_map(|tag| {
            let name = tag.first()?;
            let value = tag.get(1).cloned().unwrap_or_default();
            let label = if name == "p" && lkjstr_protocol::is_pubkey(&value) {
                crate::engine::rows::author(store, &value).name
            } else {
                value.clone()
            };
            let mut line = json!({"name":name,"text":label});
            if let Some(meaning) = meaning(name) {
                line["meaning"] = json!(meaning);
            }
            if let Some(reference) = reference(name, &value) {
                line["ref"] = reference;
            }
            Some(line)
        })
        .collect::<Vec<_>>();
    let mut face = json!({"type":"generic","form":form,"tags":tags,
        "moreTags":event.tags.len().saturating_sub(64)});
    if let Some(alt) = alt {
        face["alt"] = json!(alt);
    }
    face
}
