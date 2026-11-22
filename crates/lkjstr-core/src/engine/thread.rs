use crate::{
    kinds::policy,
    store::{Event, Store},
};
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{NostrEvent, NostrFilter, is_event_id, reply_parent, reply_root};
use std::collections::{HashMap, VecDeque};

pub(super) fn address(target: &str) -> Option<Coordinate> {
    Coordinate::parse(target)
        .ok()
        .filter(|address| policy(address.kind.into()).openable)
}

pub(super) fn address_filter(address: Coordinate) -> NostrFilter {
    let mut filter = NostrFilter {
        authors: Some(vec![address.pubkey]),
        kinds: Some(vec![address.kind.into()]),
        limit: Some(1),
        ..Default::default()
    };
    if address.kind >= 30000 {
        filter.tags.insert("d".into(), vec![address.identifier]);
    }
    filter
}

pub(super) fn focus(store: &Store, target: &str) -> Option<String> {
    if is_event_id(target) {
        return store
            .get(target)
            .is_none_or(|event| policy(event.kind).openable)
            .then(|| target.to_owned());
    }
    store
        .addressed(&address(target)?)
        .map(|event| event.id.clone())
}

pub(super) fn extra_filter(store: &Store, query: &super::Query) -> Option<NostrFilter> {
    let target = query.target.as_deref()?;
    if let Some(address) = address(target) {
        let mut replies = query.clone();
        replies.target = Some(store.addressed(&address)?.id.clone());
        return Some(super::query::filter(store, &replies));
    }
    (is_event_id(target) && store.get(target).is_none()).then(|| NostrFilter {
        ids: Some(vec![target.to_owned()]),
        limit: Some(1),
        ..Default::default()
    })
}

/// The note an event answers in a thread: its reply parent, else (outside channels) its root.
pub(crate) fn parent(event: &NostrEvent) -> Option<String> {
    policy(event.kind)
        .thread_parent
        .then(|| {
            reply_parent(event).or_else(|| {
                policy(event.kind)
                    .thread_root
                    .then(|| reply_root(event))
                    .flatten()
            })
        })
        .flatten()
}

/// Temporary indexes bounded by the retained event store. Build before
/// filtering/windowing so hidden parents still contribute to reply depth.
type Positions = HashMap<String, (&'static str, usize)>;
pub(super) fn positions(store: &Store, focus: &str) -> Positions {
    classify(&store.thread(focus), focus).0
}
fn classify(events: &[Event], focus: &str) -> (Positions, Vec<String>) {
    let mut ancestors = Vec::new();
    let by_id: HashMap<_, _> = events.iter().map(|e| (e.id.as_str(), e)).collect();
    let mut children: HashMap<String, Vec<&str>> = HashMap::new();
    for event in events {
        if let Some(id) = parent(event) {
            children.entry(id).or_default().push(&event.id);
        }
    }
    let mut positions = HashMap::from([(focus.to_owned(), ("focus", 0))]);
    let mut current = by_id.get(focus).copied();
    while let Some(event) = current {
        let Some(id) = parent(event) else { break };
        if positions.contains_key(&id) {
            break;
        }
        positions.insert(id.clone(), ("ancestor", 0));
        ancestors.push(id.clone());
        current = by_id.get(id.as_str()).copied();
        // A root tag can still identify a cached ancestor across a cache gap.
        if current.is_none()
            && policy(event.kind).thread_root
            && let Some(root) = reply_root(event)
            && !positions.contains_key(&root)
        {
            positions.insert(root.clone(), ("ancestor", 0));
            ancestors.push(root.clone());
            current = by_id.get(root.as_str()).copied();
        }
    }
    let mut queue = VecDeque::from([(focus, 0)]);
    while let Some((id, depth)) = queue.pop_front() {
        for child in children.get(id).into_iter().flatten() {
            if !positions.contains_key(*child) {
                positions.insert((*child).to_owned(), ("reply", depth + 1));
                queue.push_back((child, depth + 1));
            }
        }
    }
    (positions, ancestors)
}

/// Ancestors follow their reply chain above the focus, independently of clocks or
/// ID ties. Replies retain the store's timestamp/ID order and existing depths.
pub(super) fn ordered(store: &Store, focus: &str) -> Vec<Event> {
    let events = store.thread(focus);
    let (positions, ancestors) = classify(&events, focus);
    let by_id: HashMap<_, _> = events
        .iter()
        .map(|event| (event.id.as_str(), event))
        .collect();
    let mut out: Vec<_> = ancestors
        .into_iter()
        .rev()
        .filter_map(|id| by_id.get(id.as_str()).map(|event| (*event).clone()))
        .collect();
    if let Some(event) = by_id.get(focus) {
        out.push((*event).clone());
    }
    out.extend(events.into_iter().filter(|event| {
        positions
            .get(&event.id)
            .is_some_and(|(role, _)| *role == "reply")
    }));
    out
}
