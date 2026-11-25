//! Generation cutoffs let bounded timeline scans finish while append-only traffic continues.
use super::{Store, compact::Id};
use lkjstr_protocol::{NostrEvent, is_replaceable_kind};

impl Store {
    /// Increases on every visible change; views re-query when it moves.
    pub fn revision(&self) -> u64 {
        self.revision
    }

    /// Last change that could alter membership of events already scanned.
    pub(crate) fn snapshot_revision(&self) -> u64 {
        self.snapshot_revision
    }

    pub(crate) fn existed_at(&self, id: &str, revision: u64) -> bool {
        super::decode_id(id)
            .and_then(|id| self.generations.get(&id))
            .is_some_and(|at| *at <= revision)
    }

    pub(super) fn record_insert(&mut self, event: &NostrEvent, id: Id) {
        let revision = self.revision + 1;
        // Metadata can change follows, mutes or resolved author filters. A late repost
        // target can add a row at an existing wrapper's position.
        if is_replaceable_kind(event.kind)
            || event.kind == 5
            || self
                .by_tag_e
                .get(&id)
                .is_some_and(|events| events.iter().any(|e| e.kind == 6))
        {
            self.snapshot_revision = revision;
        }
        self.generations.insert(id, revision);
    }
}
