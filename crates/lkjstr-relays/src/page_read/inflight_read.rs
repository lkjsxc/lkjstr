#![doc = "Internal in-flight page-read record."]

use std::collections::BTreeSet;

use super::inflight::{PageReadAttachment, PageReadCleanup};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct InFlightPageRead {
    read_key: String,
    owners: BTreeSet<String>,
    listener_count: usize,
    abort_signal_count: usize,
    aborted: bool,
}

impl InFlightPageRead {
    pub(super) fn new(read_key: String) -> Self {
        Self {
            read_key,
            owners: BTreeSet::new(),
            listener_count: 0,
            abort_signal_count: 0,
            aborted: false,
        }
    }

    pub(super) fn attach(&mut self, attachment: &PageReadAttachment) {
        self.owners.insert(attachment.owner_id.clone());
        if attachment.has_snapshot_listener {
            self.listener_count = self.listener_count.saturating_add(1);
        }
        if attachment.has_abort_signal {
            self.abort_signal_count = self.abort_signal_count.saturating_add(1);
        }
    }

    pub(super) fn mark_aborted(&mut self) {
        self.aborted = true;
    }

    pub(super) fn owner_count(&self) -> usize {
        self.owners.len()
    }

    pub(super) fn listener_count(&self) -> usize {
        self.listener_count
    }

    pub(super) fn abort_signal_count(&self) -> usize {
        self.abort_signal_count
    }

    pub(super) fn cleanup(&self) -> PageReadCleanup {
        PageReadCleanup {
            read_key: self.read_key.clone(),
            owner_count: self.owner_count(),
            listener_count: self.listener_count,
            abort_signal_count: self.abort_signal_count,
            aborted: self.aborted,
        }
    }
}
