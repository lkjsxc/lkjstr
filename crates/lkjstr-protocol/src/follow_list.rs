use serde::{Deserialize, Serialize};

use crate::{NostrEvent, is_pubkey, kinds::KIND_FOLLOW_LIST, normalize_relay_url};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct FollowEntry {
    pub pubkey: String,
    pub relay: Option<String>,
    pub petname: Option<String>,
}

pub fn follow_entries_from_event(event: &NostrEvent) -> Vec<FollowEntry> {
    if event.kind != KIND_FOLLOW_LIST {
        return Vec::new();
    }
    dedupe_follow_entries(
        event
            .tags
            .iter()
            .filter(|tag| tag.first().is_some_and(|name| name == "p"))
            .filter_map(|tag| follow_entry_from_tag(tag))
            .collect(),
    )
}

pub fn following_count(event: &NostrEvent) -> usize {
    follow_entries_from_event(event).len()
}

pub fn dedupe_follow_entries(entries: Vec<FollowEntry>) -> Vec<FollowEntry> {
    let mut out = Vec::new();
    for entry in entries {
        if !out
            .iter()
            .any(|item: &FollowEntry| item.pubkey == entry.pubkey)
        {
            out.push(entry);
        }
    }
    out
}

fn follow_entry_from_tag(tag: &[String]) -> Option<FollowEntry> {
    let pubkey = tag.get(1)?.to_owned();
    if !is_pubkey(&pubkey) {
        return None;
    }
    Some(FollowEntry {
        pubkey,
        relay: tag.get(2).and_then(|relay| normalize_relay_url(relay)),
        petname: tag
            .get(3)
            .map(|item| item.trim())
            .filter(|item| !item.is_empty())
            .map(ToOwned::to_owned),
    })
}
