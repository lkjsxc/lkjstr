use crate::store::Store;
use lkjstr_protocol::{NostrEvent, reply_parent, reply_root};
use std::collections::{HashMap, VecDeque};

fn parent(event: &NostrEvent) -> Option<String> {
    reply_parent(event).or_else(|| reply_root(event))
}

/// Temporary indexes bounded by Store::thread's 500-note walk. Build before
/// filtering/windowing so hidden parents still contribute to reply depth.
pub(super) fn positions(store: &Store, focus: &str) -> HashMap<String, (&'static str, usize)> {
    let events = store.thread(focus);
    let by_id: HashMap<_, _> = events.iter().map(|e| (e.id.as_str(), e)).collect();
    let mut children: HashMap<String, Vec<&str>> = HashMap::new();
    for event in &events {
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
        current = by_id.get(id.as_str()).copied();
        // A root tag can still identify a cached ancestor across a cache gap.
        if current.is_none()
            && let Some(root) = reply_root(event)
            && !positions.contains_key(&root)
        {
            positions.insert(root.clone(), ("ancestor", 0));
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
    positions
}
