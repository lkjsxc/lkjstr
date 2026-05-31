use serde::{Deserialize, Serialize};

use crate::NostrEvent;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct IndexedTags {
    pub events: Vec<String>,
    pub pubkeys: Vec<String>,
    pub quotes: Vec<String>,
    pub addresses: Vec<String>,
    pub topics: Vec<String>,
    pub relays: Vec<String>,
}

pub fn first_tag_value(event: &NostrEvent, name: &str) -> Option<String> {
    event
        .tags
        .iter()
        .find(|tag| tag.first().is_some_and(|item| item == name))
        .and_then(|tag| tag.get(1))
        .cloned()
}

pub fn tag_values(event: &NostrEvent, name: &str) -> Vec<String> {
    event
        .tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|item| item == name))
        .filter_map(|tag| tag.get(1).filter(|value| !value.is_empty()).cloned())
        .collect()
}

pub fn index_tags(event: &NostrEvent) -> IndexedTags {
    IndexedTags {
        events: tag_values(event, "e"),
        pubkeys: tag_values(event, "p"),
        quotes: tag_values(event, "q"),
        addresses: tag_values(event, "a"),
        topics: tag_values(event, "t"),
        relays: tag_values(event, "r"),
    }
}

pub fn reply_root(event: &NostrEvent) -> Option<String> {
    marker(&event.tags, "root").or_else(|| tag_values(event, "e").first().cloned())
}

pub fn reply_parent(event: &NostrEvent) -> Option<String> {
    if let Some(reply) = marker(&event.tags, "reply") {
        return Some(reply);
    }
    let events = tag_values(event, "e");
    if events.len() > 1 {
        events.last().cloned()
    } else {
        None
    }
}

fn marker(tags: &[Vec<String>], marker_name: &str) -> Option<String> {
    tags.iter()
        .find(|tag| {
            tag.first().is_some_and(|item| item == "e")
                && tag.get(3).is_some_and(|item| item == marker_name)
        })
        .and_then(|tag| tag.get(1))
        .cloned()
}
