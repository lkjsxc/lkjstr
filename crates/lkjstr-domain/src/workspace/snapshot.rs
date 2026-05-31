#![doc = "Workspace tab snapshot payloads."]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum HistoryExhaustion {
    Unknown,
    Probing,
    Proven,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedCursorPoint {
    pub created_at: u64,
    pub id: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabAnchor {
    pub anchor_key: String,
    pub offset: i64,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedTabSnapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scroll_top: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor_offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oldest_cursor: Option<FeedCursorPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub newest_cursor: Option<FeedCursorPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_older: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_newer: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub history_exhaustion: Option<HistoryExhaustion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub older_cursor_created_at: Option<u64>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub filter_state: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_record_ids: Option<Vec<String>>,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolTabSnapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scroll_top: Option<i64>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub fields: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case", tag = "kind")]
pub enum TabSnapshotPayload {
    Feed(FeedTabSnapshot),
    Tool(ToolTabSnapshot),
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabSnapshotRestore {
    pub token: String,
    pub payload: TabSnapshotPayload,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
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
