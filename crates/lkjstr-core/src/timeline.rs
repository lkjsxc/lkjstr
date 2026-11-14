//! Stable timelines: the reader's list never jumps. Items newer than the top
//! wait behind a "new" marker until the reader asks for them (or is at the
//! top); older items append below.

use std::collections::HashSet;

/// One timeline entry: (created_at, id).
pub type Item = (u64, String);

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Timeline {
    shown: Vec<Item>,
    pending: Vec<Item>,
    ids: HashSet<String>,
    /// Most entries kept shown; the oldest fall off (they can be re-paged).
    cap: usize,
}

impl Timeline {
    pub fn new(cap: usize) -> Timeline {
        Timeline {
            cap,
            ..Timeline::default()
        }
    }

    pub fn shown(&self) -> &[Item] {
        &self.shown
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    pub fn oldest(&self) -> Option<u64> {
        self.shown.last().map(|(at, _)| *at)
    }

    /// Merges a newest-first query result. With `at_top`, new items show at
    /// once; otherwise those newer than the top item wait in `pending`.
    pub fn merge(&mut self, items: &[Item], at_top: bool) {
        let top = self.shown.first().cloned();
        let mut fresh_older = Vec::new();
        for item in items {
            if self.ids.contains(&item.1) {
                continue;
            }
            self.ids.insert(item.1.clone());
            match &top {
                Some(top) if !at_top && item > top => self.pending.push(item.clone()),
                _ => fresh_older.push(item.clone()),
            }
        }
        if fresh_older.is_empty() && !(at_top && !self.pending.is_empty()) {
            return;
        }
        if at_top {
            fresh_older.append(&mut self.pending);
        }
        self.shown.extend(fresh_older);
        self.shown.sort_by(|a, b| b.cmp(a));
        self.trim();
    }

    /// Shows everything waiting behind the "new" marker.
    pub fn reveal(&mut self) {
        let mut pending = std::mem::take(&mut self.pending);
        self.shown.append(&mut pending);
        self.shown.sort_by(|a, b| b.cmp(a));
        self.trim();
    }

    /// Forgets items no longer in the source (deleted or evicted).
    pub fn retain(&mut self, keep: impl Fn(&str) -> bool) {
        self.shown.retain(|item| keep(&item.1));
        self.pending.retain(|item| keep(&item.1));
        self.ids.retain(|id| keep(id));
    }

    fn trim(&mut self) {
        if self.shown.len() > self.cap {
            for (_, id) in self.shown.drain(self.cap..) {
                self.ids.remove(&id);
            }
        }
    }
}
