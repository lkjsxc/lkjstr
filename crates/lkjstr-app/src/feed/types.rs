#![doc = "Feed-window reducer types."]

use std::collections::BTreeMap;

use lkjstr_relays::{ProgressiveEvent, ProgressiveReadSnapshot};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedWindowCursor {
    pub created_at: u64,
    pub event_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedWindowState {
    pub generation: u64,
    pub max_items: usize,
    pub events_by_id: BTreeMap<String, ProgressiveEvent>,
    pub sorted_ids: Vec<String>,
    pub newest_cursor: Option<FeedWindowCursor>,
    pub oldest_cursor: Option<FeedWindowCursor>,
    pub terminal: bool,
    pub has_older: bool,
    pub has_newer: bool,
}

impl FeedWindowState {
    #[must_use]
    pub fn visible_events(&self) -> Vec<ProgressiveEvent> {
        self.sorted_ids
            .iter()
            .filter_map(|id| self.events_by_id.get(id).cloned())
            .collect()
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct FeedWindowFlags {
    pub terminal: bool,
    pub has_older: bool,
    pub has_newer: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedWindowEvidence {
    Events {
        generation: u64,
        events: Vec<ProgressiveEvent>,
        flags: FeedWindowFlags,
    },
    Snapshot {
        generation: u64,
        snapshot: ProgressiveReadSnapshot,
        flags: FeedWindowFlags,
    },
    Reset {
        generation: u64,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedWindowStatus {
    PendingEmpty,
    PendingWithRows,
    TerminalEmpty,
    TerminalWithRows,
}
