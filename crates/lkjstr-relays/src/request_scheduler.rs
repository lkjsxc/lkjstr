#![doc = "Pure relay request scheduler."]

use std::collections::VecDeque;

pub const fn max_pending_relay_reqs() -> usize {
    64
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingReq {
    pub id: String,
    pub critical: bool,
}

impl PendingReq {
    #[must_use]
    pub fn new(id: impl Into<String>, critical: bool) -> Self {
        Self {
            id: id.into(),
            critical,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScheduleOutcome {
    pub started: Option<String>,
    pub dropped: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReleaseOutcome {
    pub started: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayReqScheduler {
    active: Vec<String>,
    pending: VecDeque<PendingReq>,
    max_pending: usize,
}

impl Default for RelayReqScheduler {
    fn default() -> Self {
        Self::new(max_pending_relay_reqs())
    }
}

impl RelayReqScheduler {
    #[must_use]
    pub fn new(max_pending: usize) -> Self {
        Self {
            active: Vec::new(),
            pending: VecDeque::new(),
            max_pending,
        }
    }

    pub fn schedule(&mut self, req: PendingReq, max_active: usize) -> ScheduleOutcome {
        self.active.retain(|id| id != &req.id);
        if self.active.len() < max_active {
            self.active.push(req.id.clone());
            return ScheduleOutcome {
                started: Some(req.id),
                dropped: Vec::new(),
            };
        }

        self.pending.retain(|item| item.id != req.id);
        let dropped = self.drop_for_capacity();
        self.pending.push_back(req);
        ScheduleOutcome {
            started: None,
            dropped,
        }
    }

    pub fn release(&mut self, id: &str, max_active: usize) -> ReleaseOutcome {
        self.active.retain(|active_id| active_id != id);
        let mut started = Vec::new();
        while self.active.len() < max_active {
            let Some(next) = self.pending.pop_front() else {
                break;
            };
            self.active.push(next.id.clone());
            started.push(next.id);
        }
        ReleaseOutcome { started }
    }

    pub fn remove(&mut self, id: &str) {
        self.pending.retain(|item| item.id != id);
        self.active.retain(|active_id| active_id != id);
    }

    pub fn clear(&mut self) {
        self.pending.clear();
        self.active.clear();
    }

    #[must_use]
    pub fn has_pending(&self) -> bool {
        !self.pending.is_empty()
    }

    #[must_use]
    pub fn active_ids(&self) -> Vec<String> {
        self.active.clone()
    }

    #[must_use]
    pub fn pending_ids(&self) -> Vec<String> {
        self.pending.iter().map(|item| item.id.clone()).collect()
    }

    fn drop_for_capacity(&mut self) -> Vec<String> {
        if self.pending.len() < self.max_pending {
            return Vec::new();
        }
        let mut index = 0;
        for (candidate, item) in self.pending.iter().enumerate() {
            if !item.critical {
                index = candidate;
                break;
            }
        }
        match self.pending.remove(index) {
            Some(dropped) => vec![dropped.id],
            None => Vec::new(),
        }
    }
}
