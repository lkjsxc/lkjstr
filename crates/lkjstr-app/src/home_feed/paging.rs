//! Bounded Home history merges; a relay result never proves global exhaustion.
use lkjstr_protocol::{NostrEvent, NostrFilter, matches_filter};
use lkjstr_relays::{
    ProgressiveReadSnapshot, ProgressiveReadStatus, ProgressiveRelayState,
    page_read::merge_progressive_events,
};
use std::{cmp::Ordering, collections::BTreeSet};

use crate::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, empty_feed_window,
    reduce_feed_window,
};

#[must_use]
pub fn home_older_footer(
    input: &super::HomeFeedViewInput,
    mut footer: crate::FeedFooterRow,
    enabled: bool,
) -> crate::FeedFooterRow {
    footer.command = None;
    if enabled
        && input.window.oldest_cursor.is_some()
        && (input.window.terminal
            || input.source_state == super::HomeFeedSourceState::CacheComplete)
    {
        footer.command = Some(crate::FEED_LOAD_OLDER_COMMAND.to_owned());
    }
    footer
}

#[must_use]
pub fn home_event_before_cursor(event: &NostrEvent, before: &FeedWindowCursor) -> bool {
    event.created_at < before.created_at
        || (event.created_at == before.created_at && event.id > before.event_id)
}

/// The latest common frontier supported by every exact relay/filter prefix.
/// Raw inclusive-boundary events must be present, including previously seen ids.
#[must_use]
pub fn home_history_cursor(
    snapshot: &ProgressiveReadSnapshot,
    expected_relays: &[String],
    filters: &[NostrFilter],
    previous: Option<&FeedWindowCursor>,
    retained_oldest: Option<&FeedWindowCursor>,
) -> Option<FeedWindowCursor> {
    let unique: BTreeSet<_> = expected_relays.iter().collect();
    if !snapshot.final_read
        || snapshot.status != ProgressiveReadStatus::Complete
        || filters.is_empty()
        || unique.is_empty()
        || unique.len() != expected_relays.len()
        || snapshot.relays.len() != unique.len()
        || unique.iter().any(|relay| {
            let mut states = snapshot
                .relays
                .iter()
                .filter(|state| &state.relay == *relay);
            states
                .next()
                .is_none_or(|state| state.state != ProgressiveRelayState::Eose)
                || states.next().is_some()
        })
    {
        return previous.cloned();
    }
    // A multi-filter REQ returns a union without per-event filter provenance.
    // Overlapping rows cannot prove how far each individual prefix reached.
    if filters.len() > 1
        && snapshot.events.iter().any(|item| {
            item.sub_id == snapshot.read_id
                && item
                    .relays
                    .iter()
                    .any(|relay| expected_relays.contains(relay))
                && filters
                    .iter()
                    .filter(|filter| matches_filter(&item.event, filter))
                    .nth(1)
                    .is_some()
        })
    {
        return previous.cloned();
    }
    let mut frontier = None;
    for relay in expected_relays {
        for filter in filters {
            let oldest = snapshot
                .events
                .iter()
                .filter(|item| {
                    item.sub_id == snapshot.read_id
                        && item.relays.contains(relay)
                        && matches_filter(&item.event, filter)
                })
                .map(|item| FeedWindowCursor {
                    created_at: item.event.created_at,
                    event_id: item.event.id.clone(),
                })
                .max_by(cursor_order);
            if let Some(oldest) = oldest {
                frontier = Some(match frontier {
                    Some(current) if cursor_order(&current, &oldest).is_lt() => current,
                    _ => oldest,
                });
            }
        }
    }
    let Some(mut frontier) = frontier else {
        return previous.cloned();
    };
    // Do not move past a prefix discarded by the bounded newest-window merge.
    if let Some(oldest) = retained_oldest
        && cursor_order(&frontier, oldest).is_gt()
    {
        frontier = oldest.clone();
    }
    if previous.is_some_and(|before| !cursor_order(&frontier, before).is_gt()) {
        return previous.cloned();
    }
    Some(frontier)
}

fn cursor_order(left: &FeedWindowCursor, right: &FeedWindowCursor) -> Ordering {
    right
        .created_at
        .cmp(&left.created_at)
        .then(left.event_id.cmp(&right.event_id))
}

#[must_use]
pub fn home_window_from_snapshot(
    current: &FeedWindowState,
    mut snapshot: ProgressiveReadSnapshot,
    before: Option<&FeedWindowCursor>,
) -> FeedWindowState {
    if let Some(before) = before {
        snapshot
            .events
            .retain(|item| home_event_before_cursor(&item.event, before));
    }
    // An oversized response must keep the next prefix, not its distant tail.
    // The separate continuation is clamped to this retained prefix afterward.
    if snapshot.events.len() > current.max_items {
        snapshot.events = merge_progressive_events(&[], &snapshot.events);
        snapshot.events.truncate(current.max_items);
    }
    let merged = merge_progressive_events(&current.visible_events(), &snapshot.events);
    // A sparse displayed tail can lie behind this read's proven frontier.
    // Gap refill must retain its new rows, not repeatedly preserve that tail.
    let moving_older = before
        .zip(current.oldest_cursor.as_ref())
        .is_some_and(|(before, oldest)| !cursor_order(oldest, before).is_gt());
    let drop_newer = if moving_older {
        merged.len().saturating_sub(current.max_items)
    } else {
        0
    };
    snapshot.events = merged.into_iter().skip(drop_newer).collect();
    let has_older = !snapshot.events.is_empty();
    reduce_feed_window(
        empty_feed_window(current.generation, current.max_items),
        FeedWindowEvidence::Snapshot {
            generation: current.generation,
            snapshot,
            flags: FeedWindowFlags {
                has_older,
                has_newer: current.has_newer || drop_newer > 0,
                ..FeedWindowFlags::default()
            },
        },
    )
}
