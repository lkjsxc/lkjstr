//! Displayed authors plus bounded reference context; follows only the last act target.
use crate::{
    content::{Segment, segments},
    store::{Event, Store},
};
use lkjstr_protocol::{event_references, tags::tag_values};
use std::collections::{BTreeMap, BTreeSet};
pub(super) fn visit(
    store: &Store,
    e: &Event,
    depth: usize,
    out: &mut BTreeMap<String, BTreeSet<String>>,
) {
    let relays: BTreeSet<_> = store.seen_on(&e.id).iter().cloned().collect();
    for key in std::iter::once(e.pubkey.clone()).chain(tag_values(e, "p").into_iter().take(3)) {
        if out.len() < 6000 || out.contains_key(&key) {
            out.entry(key).or_default().extend(relays.clone());
        }
    }
    // Repost headers are projected from referencing wrappers, not just targets.
    for wrapper in store
        .referencing(&e.id)
        .into_iter()
        .filter(|r| {
            matches!(r.kind, 6 | 16)
                && crate::engine::acts::target(r).as_deref() == Some(e.id.as_str())
        })
        .take(3)
    {
        if out.len() < 6000 || out.contains_key(&wrapper.pubkey) {
            out.entry(wrapper.pubkey.clone())
                .or_default()
                .extend(store.seen_on(&wrapper.id).iter().cloned());
        }
    }
    if super::super::acts::is_act(e.kind) {
        if depth < 4
            && let Some(target) = super::super::acts::target(e).and_then(|id| store.get(&id))
        {
            visit(store, &target, depth + 1, out);
        }
        return;
    }
    if depth >= 2 {
        return;
    }
    let ids = event_references(e).into_iter().map(|r| r.id).chain(
        segments(&e.content, &[])
            .into_iter()
            .filter_map(|s| match s {
                Segment::Quote { id, .. } => Some(id),
                _ => None,
            }),
    );
    for id in ids.take(120) {
        if let Some(target) = store.get(&id) {
            visit(store, &target, depth + 1, out);
        }
    }
}
