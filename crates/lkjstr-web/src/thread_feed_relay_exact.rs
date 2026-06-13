use std::collections::BTreeSet;

use lkjstr_protocol::{NostrEvent, reply_parent};

use crate::thread_feed_relay_input::ThreadRelayReadInput;

const MAX_EXACT_PARENT_IDS: usize = 24;

pub(crate) fn thread_exact_lookup_ids(input: &ThreadRelayReadInput) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    push_unique(&mut seen, &mut out, input.event_id.clone());
    push_unique(&mut seen, &mut out, input.root_event_id.clone());
    for event in input.cache_window.visible_events() {
        if out.len() >= MAX_EXACT_PARENT_IDS + 2 {
            break;
        }
        if let Some(parent) = reply_parent(&event.event) {
            push_unique(&mut seen, &mut out, parent);
        }
    }
    out
}

pub(crate) fn is_thread_exact_lookup(input: &ThreadRelayReadInput, event: &NostrEvent) -> bool {
    thread_exact_lookup_ids(input)
        .iter()
        .any(|id| id == &event.id)
}

fn push_unique(seen: &mut BTreeSet<String>, out: &mut Vec<String>, id: String) {
    if seen.insert(id.clone()) {
        out.push(id);
    }
}
