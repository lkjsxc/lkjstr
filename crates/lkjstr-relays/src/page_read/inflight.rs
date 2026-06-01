#![doc = "Pure in-flight page-read registry state."]

use std::collections::BTreeMap;

use super::inflight_read::InFlightPageRead;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PageReadAttachAction {
    Start,
    Share,
    Closed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageReadAttachment {
    pub read_key: String,
    pub owner_id: String,
    pub has_abort_signal: bool,
    pub has_snapshot_listener: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageReadAttachOutcome {
    pub action: PageReadAttachAction,
    pub read_key: String,
    pub owner_count: usize,
    pub listener_count: usize,
    pub abort_signal_count: usize,
    pub aborted: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PageReadAbortOutcome {
    Missing,
    Aborted(PageReadCleanup),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PageReadSettleOutcome {
    Missing,
    Settled(PageReadCleanup),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageReadCleanup {
    pub read_key: String,
    pub owner_count: usize,
    pub listener_count: usize,
    pub abort_signal_count: usize,
    pub aborted: bool,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct InFlightPageReadCounts {
    pub reads: usize,
    pub owners: usize,
    pub listeners: usize,
    pub abort_signals: usize,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct InFlightPageReadRegistry {
    reads: BTreeMap<String, InFlightPageRead>,
    closed: bool,
}

impl InFlightPageReadRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn is_closed(&self) -> bool {
        self.closed
    }

    pub fn attach(&mut self, attachment: PageReadAttachment) -> PageReadAttachOutcome {
        if self.closed {
            return PageReadAttachOutcome::closed(attachment.read_key);
        }
        match self.reads.get_mut(&attachment.read_key) {
            Some(read) => {
                read.attach(&attachment);
                PageReadAttachOutcome::from_read(PageReadAttachAction::Share, read)
            }
            None => {
                let mut read = InFlightPageRead::new(attachment.read_key.clone());
                read.attach(&attachment);
                let outcome = PageReadAttachOutcome::from_read(PageReadAttachAction::Start, &read);
                self.reads.insert(attachment.read_key, read);
                outcome
            }
        }
    }

    pub fn abort(&mut self, read_key: &str) -> PageReadAbortOutcome {
        match self.reads.get_mut(read_key) {
            Some(read) => {
                read.mark_aborted();
                PageReadAbortOutcome::Aborted(read.cleanup())
            }
            None => PageReadAbortOutcome::Missing,
        }
    }

    pub fn settle(&mut self, read_key: &str) -> PageReadSettleOutcome {
        match self.reads.remove(read_key) {
            Some(read) => PageReadSettleOutcome::Settled(read.cleanup()),
            None => PageReadSettleOutcome::Missing,
        }
    }

    pub fn close(&mut self) -> Vec<PageReadCleanup> {
        if self.closed {
            return Vec::new();
        }
        self.closed = true;
        let reads = std::mem::take(&mut self.reads);
        reads
            .into_values()
            .map(|mut read| {
                read.mark_aborted();
                read.cleanup()
            })
            .collect()
    }

    #[must_use]
    pub fn counts(&self) -> InFlightPageReadCounts {
        self.reads
            .values()
            .fold(InFlightPageReadCounts::default(), |mut counts, read| {
                counts.reads += 1;
                counts.owners += read.owner_count();
                counts.listeners += read.listener_count();
                counts.abort_signals += read.abort_signal_count();
                counts
            })
    }
}

impl PageReadAttachOutcome {
    fn closed(read_key: String) -> Self {
        Self {
            action: PageReadAttachAction::Closed,
            read_key,
            owner_count: 0,
            listener_count: 0,
            abort_signal_count: 0,
            aborted: false,
        }
    }

    fn from_read(action: PageReadAttachAction, read: &InFlightPageRead) -> Self {
        let cleanup = read.cleanup();
        Self {
            action,
            read_key: cleanup.read_key,
            owner_count: cleanup.owner_count,
            listener_count: cleanup.listener_count,
            abort_signal_count: cleanup.abort_signal_count,
            aborted: cleanup.aborted,
        }
    }
}
