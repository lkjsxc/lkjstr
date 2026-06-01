#![doc = "Progressive read event provenance."]

use std::collections::{BTreeMap, BTreeSet};

use lkjstr_protocol::{NostrEvent, compare_events_desc};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgressiveEvent {
    pub relays: Vec<String>,
    pub sub_id: String,
    pub event: NostrEvent,
}

#[must_use]
pub fn merge_progressive_events(
    current: &[ProgressiveEvent],
    incoming: &[ProgressiveEvent],
) -> Vec<ProgressiveEvent> {
    let mut by_id = BTreeMap::<String, ProgressiveEvent>::new();
    for item in current.iter().chain(incoming.iter()) {
        let next = match by_id.get(&item.event.id) {
            Some(existing) => merge_event_receipt(existing, item),
            None => item.clone(),
        };
        by_id.insert(item.event.id.clone(), next);
    }
    sort_progressive_events(by_id.into_values().collect())
}

#[must_use]
pub fn event_relays(events: &[ProgressiveEvent], id: &str) -> Vec<String> {
    events
        .iter()
        .filter(|item| item.event.id == id)
        .flat_map(|item| item.relays.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn merge_event_receipt(a: &ProgressiveEvent, b: &ProgressiveEvent) -> ProgressiveEvent {
    let event = if b.event.created_at > a.event.created_at {
        b.event.clone()
    } else {
        a.event.clone()
    };
    ProgressiveEvent {
        event,
        relays: merged_relays(a, b),
        sub_id: a.sub_id.clone(),
    }
}

fn merged_relays(a: &ProgressiveEvent, b: &ProgressiveEvent) -> Vec<String> {
    a.relays
        .iter()
        .chain(b.relays.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn sort_progressive_events(mut events: Vec<ProgressiveEvent>) -> Vec<ProgressiveEvent> {
    events.sort_by(|a, b| compare_events_desc(&a.event, &b.event));
    events
}
