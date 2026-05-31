use std::collections::BTreeMap;

use lkjstr_domain::{
    FeedCursorPoint, FeedRuntimeSnapshotSource, FeedTabSnapshot, FeedTabSnapshotPatch,
    HistoryExhaustion, TabAnchor, TabKind, TabSnapshotPatch, TabSnapshotPayload, ToolTabSnapshot,
    ToolTabSnapshotPatch, capture_tab_snapshot, feed_anchor_from_payload, feed_runtime_snapshot,
    feed_snapshot_seed_from_payload, merge_tab_snapshot_payload,
};

#[test]
fn captures_feed_and_tool_snapshots() {
    let feed = capture_tab_snapshot(
        TabKind::Timeline,
        24,
        Some(TabAnchor {
            anchor_key: "row:a".into(),
            offset: -8,
        }),
    );
    assert!(matches!(
        feed,
        TabSnapshotPayload::Feed(FeedTabSnapshot {
            scroll_top: Some(24),
            anchor_offset: Some(-8),
            ..
        })
    ));

    let tool = capture_tab_snapshot(TabKind::Settings, 12, None);
    assert!(matches!(
        tool,
        TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(12),
            ..
        })
    ));
}

#[test]
fn merges_feed_cursors_and_preserves_falsy_patch_values() -> Result<(), &'static str> {
    let base = TabSnapshotPayload::Feed(FeedTabSnapshot {
        scroll_top: Some(25),
        has_older: Some(true),
        ..FeedTabSnapshot::default()
    });
    let patch = FeedTabSnapshotPatch {
        scroll_top: Some(0),
        oldest_cursor: Some(cursor(5, "x")),
        has_older: Some(false),
        history_exhaustion: Some(HistoryExhaustion::Proven),
        anchor_key: Some("row:x".into()),
        event_ids: Some(Vec::new()),
        ..FeedTabSnapshotPatch::default()
    };

    let merged = merge_tab_snapshot_payload(base, Some(TabSnapshotPatch::Feed(patch)));

    let TabSnapshotPayload::Feed(feed) = merged else {
        return Err("expected feed");
    };
    assert_eq!(feed.scroll_top, Some(0));
    assert_eq!(feed.oldest_cursor, Some(cursor(5, "x")));
    assert_eq!(feed.has_older, Some(false));
    assert_eq!(feed.history_exhaustion, Some(HistoryExhaustion::Proven));
    assert_eq!(feed.anchor_key.as_deref(), Some("row:x"));
    assert_eq!(feed.event_ids, Some(Vec::new()));
    Ok(())
}

#[test]
fn merges_tool_fields_without_losing_existing_values() -> Result<(), &'static str> {
    let base = TabSnapshotPayload::Tool(ToolTabSnapshot {
        fields: map([("query", "nostr")]),
        ..ToolTabSnapshot::default()
    });
    let patch = ToolTabSnapshotPatch {
        scroll_top: Some(0),
        fields: Some(map([("mode", "exact")])),
    };

    let merged = merge_tab_snapshot_payload(base, Some(TabSnapshotPatch::Tool(patch)));

    let TabSnapshotPayload::Tool(tool) = merged else {
        return Err("expected tool");
    };
    assert_eq!(tool.scroll_top, Some(0));
    assert_eq!(tool.fields.get("query").map(String::as_str), Some("nostr"));
    assert_eq!(tool.fields.get("mode").map(String::as_str), Some("exact"));
    Ok(())
}

#[test]
fn derives_feed_seeds_anchors_and_truncated_runtime_patches() {
    let payload = TabSnapshotPayload::Feed(FeedTabSnapshot {
        anchor_key: Some("row:1".into()),
        oldest_cursor: Some(cursor(1, "old")),
        has_newer: Some(false),
        ..FeedTabSnapshot::default()
    });

    let seed = feed_snapshot_seed_from_payload(&payload);
    assert!(matches!(seed, Some(item) if item.has_newer == Some(false)));
    assert_eq!(
        feed_anchor_from_payload(&payload),
        Some(TabAnchor {
            anchor_key: "row:1".into(),
            offset: 0
        })
    );

    let runtime = feed_runtime_snapshot(FeedRuntimeSnapshotSource {
        event_ids: Some((0..250).map(|index| format!("event-{index}")).collect()),
        ..FeedRuntimeSnapshotSource::default()
    });
    assert_eq!(runtime.event_ids.map(|ids| ids.len()), Some(200));
}

fn cursor(created_at: u64, id: &str) -> FeedCursorPoint {
    FeedCursorPoint {
        created_at,
        id: id.to_owned(),
    }
}

fn map(entries: [(&str, &str); 1]) -> BTreeMap<String, String> {
    entries
        .into_iter()
        .map(|(key, value)| (key.to_owned(), value.to_owned()))
        .collect()
}
