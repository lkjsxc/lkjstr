//! Bounded Home history merges; a relay result never proves global exhaustion.
use lkjstr_protocol::NostrEvent;
use lkjstr_relays::{ProgressiveReadSnapshot, page_read::merge_progressive_events};

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
    let merged = merge_progressive_events(&current.visible_events(), &snapshot.events);
    let drop_newer = if before.is_some() {
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
