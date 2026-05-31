#![doc = "Workspace tab snapshot operations."]

use crate::workspace::snapshot::{
    FeedRuntimeSnapshotSource, FeedSnapshotSeed, FeedTabSnapshot, FeedTabSnapshotPatch, TabAnchor,
    TabSnapshotPatch, TabSnapshotPayload, ToolTabSnapshot, ToolTabSnapshotPatch,
};
use crate::workspace::tab::TabKind;

#[must_use]
pub fn capture_tab_snapshot(
    tab_kind: TabKind,
    scroll_top: i64,
    anchor: Option<TabAnchor>,
) -> TabSnapshotPayload {
    if is_feed_tab_kind(tab_kind) {
        return TabSnapshotPayload::Feed(FeedTabSnapshot {
            scroll_top: Some(scroll_top),
            anchor_key: anchor.as_ref().map(|item| item.anchor_key.clone()),
            anchor_offset: anchor.map(|item| item.offset),
            ..FeedTabSnapshot::default()
        });
    }
    TabSnapshotPayload::Tool(ToolTabSnapshot {
        scroll_top: Some(scroll_top),
        ..ToolTabSnapshot::default()
    })
}

#[must_use]
pub fn merge_tab_snapshot(
    current: Option<TabSnapshotPayload>,
    scroll_top: i64,
) -> TabSnapshotPayload {
    match current {
        Some(TabSnapshotPayload::Feed(mut feed)) => {
            feed.scroll_top = Some(scroll_top);
            TabSnapshotPayload::Feed(feed)
        }
        Some(TabSnapshotPayload::Tool(mut tool)) => {
            tool.scroll_top = Some(scroll_top);
            TabSnapshotPayload::Tool(tool)
        }
        None => TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(scroll_top),
            ..ToolTabSnapshot::default()
        }),
    }
}

#[must_use]
pub fn merge_tab_snapshot_payload(
    base: TabSnapshotPayload,
    patch: Option<TabSnapshotPatch>,
) -> TabSnapshotPayload {
    match (base, patch) {
        (TabSnapshotPayload::Feed(base), Some(TabSnapshotPatch::Feed(patch))) => {
            TabSnapshotPayload::Feed(merge_feed(base, patch))
        }
        (TabSnapshotPayload::Tool(base), Some(TabSnapshotPatch::Tool(patch))) => {
            TabSnapshotPayload::Tool(merge_tool(base, patch))
        }
        (base, _) => base,
    }
}

#[must_use]
pub fn feed_snapshot_seed_from_payload(payload: &TabSnapshotPayload) -> Option<FeedSnapshotSeed> {
    let TabSnapshotPayload::Feed(feed) = payload else {
        return None;
    };
    Some(FeedSnapshotSeed {
        oldest_cursor: feed.oldest_cursor.clone(),
        newest_cursor: feed.newest_cursor.clone(),
        has_older: feed.has_older,
        has_newer: feed.has_newer,
        history_exhaustion: feed.history_exhaustion,
        older_cursor_created_at: feed.older_cursor_created_at,
    })
}

#[must_use]
pub fn feed_anchor_from_payload(payload: &TabSnapshotPayload) -> Option<TabAnchor> {
    let TabSnapshotPayload::Feed(feed) = payload else {
        return None;
    };
    feed.anchor_key.as_ref().map(|anchor_key| TabAnchor {
        anchor_key: anchor_key.clone(),
        offset: feed.anchor_offset.unwrap_or(0),
    })
}

#[must_use]
pub fn feed_runtime_snapshot(source: FeedRuntimeSnapshotSource) -> FeedTabSnapshotPatch {
    FeedTabSnapshotPatch {
        oldest_cursor: source.oldest_cursor,
        newest_cursor: source.newest_cursor,
        has_older: source.has_older,
        has_newer: source.has_newer,
        history_exhaustion: source.history_exhaustion,
        older_cursor_created_at: source.older_cursor_created_at,
        filter_state: source.filter_state,
        event_ids: source.event_ids.map(truncate_snapshot_ids),
        notification_record_ids: source.notification_record_ids.map(truncate_snapshot_ids),
        ..FeedTabSnapshotPatch::default()
    }
}

fn merge_feed(mut base: FeedTabSnapshot, patch: FeedTabSnapshotPatch) -> FeedTabSnapshot {
    if let Some(value) = patch.scroll_top {
        base.scroll_top = Some(value);
    }
    if let Some(value) = patch.anchor_key {
        base.anchor_key = Some(value);
    }
    if let Some(value) = patch.anchor_offset {
        base.anchor_offset = Some(value);
    }
    base.oldest_cursor = patch.oldest_cursor.or(base.oldest_cursor);
    base.newest_cursor = patch.newest_cursor.or(base.newest_cursor);
    base.has_older = patch.has_older.or(base.has_older);
    base.has_newer = patch.has_newer.or(base.has_newer);
    base.history_exhaustion = patch.history_exhaustion.or(base.history_exhaustion);
    base.older_cursor_created_at = patch
        .older_cursor_created_at
        .or(base.older_cursor_created_at);
    if let Some(filter_state) = patch.filter_state {
        base.filter_state.extend(filter_state);
    }
    base.event_ids = patch.event_ids.or(base.event_ids);
    base.notification_record_ids = patch
        .notification_record_ids
        .or(base.notification_record_ids);
    base
}

fn merge_tool(mut base: ToolTabSnapshot, patch: ToolTabSnapshotPatch) -> ToolTabSnapshot {
    if let Some(value) = patch.scroll_top {
        base.scroll_top = Some(value);
    }
    if let Some(fields) = patch.fields {
        base.fields.extend(fields);
    }
    base
}

fn truncate_snapshot_ids(mut ids: Vec<String>) -> Vec<String> {
    ids.truncate(200);
    ids
}

const fn is_feed_tab_kind(kind: TabKind) -> bool {
    matches!(
        kind,
        TabKind::Timeline
            | TabKind::Global
            | TabKind::Profile
            | TabKind::Notifications
            | TabKind::Thread
            | TabKind::Search
            | TabKind::CustomRequest
            | TabKind::AuthorContext
    )
}
