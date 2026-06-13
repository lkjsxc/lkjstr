use std::collections::{BTreeMap, BTreeSet};

use lkjstr_protocol::{NostrEvent, reply_parent};
use lkjstr_relays::ProgressiveEvent;

use crate::{
    FeedContinuationRow, FeedStateRow, FeedUnavailableRow, FeedWindowEvidence, FeedWindowFlags,
    FeedWindowState, empty_feed_window, feed_continuation_row_id, feed_unavailable_row_id,
    reduce_feed_window,
};

use super::ThreadFeedViewInput;

const THREAD_MAX_INLINE_DEPTH: usize = 4;

pub(super) struct ThreadContextRows {
    pub(super) window: FeedWindowState,
    pub(super) rows: Vec<FeedStateRow>,
}

pub(super) fn thread_context_rows(input: &ThreadFeedViewInput) -> ThreadContextRows {
    let events = input.window.visible_events();
    let collapse = collapsed_branches(&events);
    let window = display_window(&input.window, events, &collapse.hidden_ids);
    let mut rows = unavailable_parent_rows(&input.unavailable_parent_ids);
    rows.extend(collapse.rows);
    ThreadContextRows { window, rows }
}

struct CollapseRows {
    hidden_ids: BTreeSet<String>,
    rows: Vec<FeedStateRow>,
}

fn collapsed_branches(events: &[ProgressiveEvent]) -> CollapseRows {
    let by_id = event_map(events);
    let children = child_map(events, &by_id);
    let mut hidden_ids = BTreeSet::new();
    let mut rows = Vec::new();
    for item in events {
        if event_depth(&item.event, &by_id) != THREAD_MAX_INLINE_DEPTH {
            continue;
        }
        let descendants = descendants(&item.event.id, &children);
        let Some(target) = descendants.first().cloned() else {
            continue;
        };
        hidden_ids.extend(descendants.iter().cloned());
        rows.push(continuation_row(target, descendants.len()));
    }
    CollapseRows { hidden_ids, rows }
}

fn display_window(
    window: &FeedWindowState,
    events: Vec<ProgressiveEvent>,
    hidden_ids: &BTreeSet<String>,
) -> FeedWindowState {
    if hidden_ids.is_empty() {
        return window.clone();
    }
    let events = events
        .into_iter()
        .filter(|item| !hidden_ids.contains(&item.event.id))
        .collect();
    reduce_feed_window(
        empty_feed_window(window.generation, window.max_items),
        FeedWindowEvidence::Events {
            generation: window.generation,
            events,
            flags: FeedWindowFlags {
                terminal: window.terminal,
                has_older: window.has_older,
                has_newer: window.has_newer,
            },
        },
    )
}

fn unavailable_parent_rows(ids: &[String]) -> Vec<FeedStateRow> {
    ids.iter()
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .map(|id| {
            FeedStateRow::Unavailable(FeedUnavailableRow {
                row_id: feed_unavailable_row_id("thread-parent-unavailable", &id),
                reason: "thread-parent-unavailable".to_owned(),
                subject: id,
                detail:
                    "Referenced Thread parent is unavailable after exact cache and relay lookup."
                        .to_owned(),
                retry_available: true,
            })
        })
        .collect()
}

fn continuation_row(target_event_id: String, hidden_count: usize) -> FeedStateRow {
    FeedStateRow::Continuation(FeedContinuationRow {
        row_id: feed_continuation_row_id(&target_event_id),
        target_event_id,
        hidden_count,
        depth: (THREAD_MAX_INLINE_DEPTH + 1) as u8,
    })
}

fn event_map(events: &[ProgressiveEvent]) -> BTreeMap<String, NostrEvent> {
    events
        .iter()
        .map(|item| (item.event.id.clone(), item.event.clone()))
        .collect()
}

fn child_map(
    events: &[ProgressiveEvent],
    by_id: &BTreeMap<String, NostrEvent>,
) -> BTreeMap<String, Vec<String>> {
    let mut children = BTreeMap::<String, Vec<String>>::new();
    for item in events {
        let Some(parent_id) = reply_parent(&item.event) else {
            continue;
        };
        if by_id.contains_key(&parent_id) {
            children
                .entry(parent_id)
                .or_default()
                .push(item.event.id.clone());
        }
    }
    children
}

fn event_depth(event: &NostrEvent, by_id: &BTreeMap<String, NostrEvent>) -> usize {
    let mut depth = 0usize;
    let mut seen = BTreeSet::new();
    let mut next_parent = reply_parent(event);
    while let Some(parent_id) = next_parent {
        if !seen.insert(parent_id.clone()) {
            break;
        }
        let Some(parent) = by_id.get(&parent_id) else {
            break;
        };
        depth += 1;
        next_parent = reply_parent(parent);
    }
    depth
}

fn descendants(id: &str, children: &BTreeMap<String, Vec<String>>) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = BTreeSet::new();
    collect_descendants(id, children, &mut seen, &mut out);
    out
}

fn collect_descendants(
    id: &str,
    children: &BTreeMap<String, Vec<String>>,
    seen: &mut BTreeSet<String>,
    out: &mut Vec<String>,
) {
    for child_id in children.get(id).into_iter().flatten() {
        if !seen.insert(child_id.clone()) {
            continue;
        }
        out.push(child_id.clone());
        collect_descendants(child_id, children, seen, out);
    }
}
