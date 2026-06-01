#![doc = "Feed-window merge reducer."]

use std::collections::BTreeMap;

use lkjstr_relays::{ProgressiveEvent, ProgressiveReadStatus, page_read::merge_progressive_events};

use super::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, FeedWindowStatus,
};

#[must_use]
pub fn empty_feed_window(generation: u64, max_items: usize) -> FeedWindowState {
    FeedWindowState {
        generation,
        max_items,
        events_by_id: BTreeMap::new(),
        sorted_ids: Vec::new(),
        newest_cursor: None,
        oldest_cursor: None,
        terminal: false,
        has_older: false,
        has_newer: false,
    }
}

#[must_use]
pub fn reduce_feed_window(state: FeedWindowState, evidence: FeedWindowEvidence) -> FeedWindowState {
    match evidence {
        FeedWindowEvidence::Reset { generation } => empty_feed_window(generation, state.max_items),
        FeedWindowEvidence::Events {
            generation,
            events,
            flags,
        } => apply_events(state, generation, events, flags),
        FeedWindowEvidence::Snapshot {
            generation,
            snapshot,
            flags,
        } => {
            let flags = FeedWindowFlags {
                terminal: flags.terminal || snapshot_is_terminal(snapshot.status),
                ..flags
            };
            apply_events(state, generation, snapshot.events, flags)
        }
    }
}

#[must_use]
pub fn feed_window_empty_ready(state: &FeedWindowState) -> FeedWindowStatus {
    match (state.terminal, state.sorted_ids.is_empty()) {
        (false, true) => FeedWindowStatus::PendingEmpty,
        (false, false) => FeedWindowStatus::PendingWithRows,
        (true, true) => FeedWindowStatus::TerminalEmpty,
        (true, false) => FeedWindowStatus::TerminalWithRows,
    }
}

fn apply_events(
    state: FeedWindowState,
    generation: u64,
    events: Vec<ProgressiveEvent>,
    flags: FeedWindowFlags,
) -> FeedWindowState {
    if generation != state.generation {
        return state;
    }
    let current = state.visible_events();
    let merged = merge_progressive_events(&current, &events);
    let pruned_for_cap = merged.len() > state.max_items;
    let retained = merged
        .into_iter()
        .take(state.max_items)
        .collect::<Vec<ProgressiveEvent>>();
    rebuild_state(state, retained, flags, pruned_for_cap)
}

fn rebuild_state(
    state: FeedWindowState,
    events: Vec<ProgressiveEvent>,
    flags: FeedWindowFlags,
    pruned_for_cap: bool,
) -> FeedWindowState {
    let sorted_ids = events
        .iter()
        .map(|item| item.event.id.clone())
        .collect::<Vec<_>>();
    let newest_cursor = cursor_for(events.first());
    let oldest_cursor = cursor_for(events.last());
    let events_by_id = events
        .into_iter()
        .map(|item| (item.event.id.clone(), item))
        .collect();
    FeedWindowState {
        events_by_id,
        sorted_ids,
        newest_cursor,
        oldest_cursor,
        terminal: flags.terminal,
        has_older: flags.has_older || pruned_for_cap,
        has_newer: flags.has_newer,
        ..state
    }
}

fn cursor_for(item: Option<&ProgressiveEvent>) -> Option<FeedWindowCursor> {
    item.map(|item| FeedWindowCursor {
        created_at: item.event.created_at,
        event_id: item.event.id.clone(),
    })
}

const fn snapshot_is_terminal(status: ProgressiveReadStatus) -> bool {
    matches!(
        status,
        ProgressiveReadStatus::Complete
            | ProgressiveReadStatus::Incomplete
            | ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
    )
}
