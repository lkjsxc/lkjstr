use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::{KIND_RELAY_LIST_METADATA, NostrEvent, normalize_relay_url};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct RelayListSuggestion {
    pub relay_url: String,
    pub read: bool,
    pub write: bool,
}

pub fn parse_relay_list_suggestions(event: &NostrEvent) -> Vec<RelayListSuggestion> {
    if event.kind != KIND_RELAY_LIST_METADATA {
        return Vec::new();
    }
    let mut by_relay = BTreeMap::<String, RelayListSuggestion>::new();
    for tag in &event.tags {
        if tag.first().is_none_or(|name| name != "r") {
            continue;
        }
        let Some(raw_url) = tag.get(1).filter(|value| !value.is_empty()) else {
            continue;
        };
        let Some(relay_url) = normalize_relay_url(raw_url) else {
            continue;
        };
        let marker = tag.get(2).map(String::as_str);
        let read = marker != Some("write");
        let write = marker != Some("read");
        let existing = by_relay
            .remove(&relay_url)
            .unwrap_or_else(|| RelayListSuggestion {
                relay_url: relay_url.to_owned(),
                read: false,
                write: false,
            });
        by_relay.insert(
            relay_url.to_owned(),
            RelayListSuggestion {
                relay_url,
                read: read || existing.read,
                write: write || existing.write,
            },
        );
    }
    by_relay.into_values().collect()
}
