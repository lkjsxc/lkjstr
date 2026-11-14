//! Bounded reference collection shared by visible feeds and threads.
use crate::content::{Segment, segments};
use crate::store::{Event, Store};
use lkjstr_protocol::{event_references, tags::tag_values};

#[derive(Default, Clone, PartialEq, Eq)]
pub struct Prefetch {
    pub people: Vec<String>,
    pub notes: Vec<String>,
    pub relays: Vec<String>,
    pub deletions: Vec<String>,
    pub deletion_relays: Vec<String>,
}

fn push(items: &mut Vec<String>, item: String, cap: usize) {
    if items.len() < cap && !items.contains(&item) {
        items.push(item);
    }
}

/// Profiles/references for 60 rows; deletion watches for all 600 renderable rows.
/// At most 120 missing targets, 120 people, 12 hints per want and 720 watches.
pub fn collect(rows: &[Event], store: &Store) -> Prefetch {
    let mut out = Prefetch::default();
    for event in rows.iter().take(600) {
        push(&mut out.deletions, event.id.clone(), 720);
        for relay in store.seen_on(&event.id) {
            push(&mut out.deletion_relays, relay.clone(), 12);
        }
        for (relay, _, write) in store.relay_list(&event.pubkey).unwrap_or_default() {
            if write {
                push(&mut out.deletion_relays, relay, 12);
            }
        }
    }
    for event in rows.iter().take(60) {
        for key in
            std::iter::once(event.pubkey.clone()).chain(tag_values(event, "p").into_iter().take(3))
        {
            if store.profile(&key).is_none() {
                push(&mut out.people, key, 120);
            }
        }
        let mut refs: Vec<_> = event_references(event)
            .into_iter()
            .map(|r| (r.id, r.relays))
            .collect();
        // Use the renderer's tokenizer too, so every rendered pointer is fetched.
        refs.extend(
            segments(&event.content, &[])
                .into_iter()
                .filter_map(|s| match s {
                    Segment::Quote { id, relays } => Some((id, relays)),
                    _ => None,
                }),
        );
        for (id, relays) in refs {
            for relay in relays {
                push(&mut out.relays, relay.clone(), 12);
                push(&mut out.deletion_relays, relay, 12);
            }
            if store.get(&id).is_none() {
                push(&mut out.notes, id, 120);
            } else {
                push(&mut out.deletions, id, 720);
            }
        }
    }
    out
}
