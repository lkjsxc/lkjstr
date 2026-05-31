#![doc = "Workspace tab snapshot payloads."]

use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HistoryExhaustion {
    Unknown,
    Probing,
    Proven,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedCursorPoint {
    pub created_at: u64,
    pub id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TabAnchor {
    pub anchor_key: String,
    pub offset: i64,
}

#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct FeedTabSnapshot {
    pub scroll_top: Option<i64>,
    pub anchor_key: Option<String>,
    pub anchor_offset: Option<i64>,
    pub oldest_cursor: Option<FeedCursorPoint>,
    pub newest_cursor: Option<FeedCursorPoint>,
    pub has_older: Option<bool>,
    pub has_newer: Option<bool>,
    pub history_exhaustion: Option<HistoryExhaustion>,
    pub older_cursor_created_at: Option<u64>,
    pub filter_state: BTreeMap<String, String>,
    pub event_ids: Option<Vec<String>>,
    pub notification_record_ids: Option<Vec<String>>,
}

#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct ToolTabSnapshot {
    pub scroll_top: Option<i64>,
    pub fields: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TabSnapshotPayload {
    Feed(FeedTabSnapshot),
    Tool(ToolTabSnapshot),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TabSnapshotRestore {
    pub token: String,
    pub payload: TabSnapshotPayload,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedSnapshotSeed {
    pub oldest_cursor: Option<FeedCursorPoint>,
    pub newest_cursor: Option<FeedCursorPoint>,
    pub has_older: Option<bool>,
    pub has_newer: Option<bool>,
    pub history_exhaustion: Option<HistoryExhaustion>,
    pub older_cursor_created_at: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct FeedTabSnapshotPatch {
    pub scroll_top: Option<i64>,
    pub anchor_key: Option<String>,
    pub anchor_offset: Option<i64>,
    pub oldest_cursor: Option<FeedCursorPoint>,
    pub newest_cursor: Option<FeedCursorPoint>,
    pub has_older: Option<bool>,
    pub has_newer: Option<bool>,
    pub history_exhaustion: Option<HistoryExhaustion>,
    pub older_cursor_created_at: Option<u64>,
    pub filter_state: Option<BTreeMap<String, String>>,
    pub event_ids: Option<Vec<String>>,
    pub notification_record_ids: Option<Vec<String>>,
}

#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct ToolTabSnapshotPatch {
    pub scroll_top: Option<i64>,
    pub fields: Option<BTreeMap<String, String>>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TabSnapshotPatch {
    Feed(FeedTabSnapshotPatch),
    Tool(ToolTabSnapshotPatch),
}

#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct FeedRuntimeSnapshotSource {
    pub oldest_cursor: Option<FeedCursorPoint>,
    pub newest_cursor: Option<FeedCursorPoint>,
    pub has_older: Option<bool>,
    pub has_newer: Option<bool>,
    pub history_exhaustion: Option<HistoryExhaustion>,
    pub older_cursor_created_at: Option<u64>,
    pub filter_state: Option<BTreeMap<String, String>>,
    pub event_ids: Option<Vec<String>>,
    pub notification_record_ids: Option<Vec<String>>,
}
