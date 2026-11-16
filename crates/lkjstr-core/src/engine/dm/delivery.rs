//! Per-recipient settlement, including self; relay acknowledgements do not add recipients.
use super::{MAX_PARTICIPANTS, drafts::Delivery};

pub struct Tracker {
    waiting: Vec<bool>, // <=32 one-time recipient slots
    counts: Delivery,
}
impl Tracker {
    pub fn new(total: usize) -> Result<Self, &'static str> {
        if total == 0 || total > MAX_PARTICIPANTS {
            return Err("rejected");
        }
        Ok(Self {
            waiting: vec![true; total],
            counts: Delivery {
                accepted: 0,
                total: total as u32,
            },
        })
    }
    /// A result or terminal error settles a slot exactly once.
    pub fn settle(&mut self, recipient: usize, accepted: bool) -> bool {
        let Some(waiting) = self.waiting.get_mut(recipient) else {
            return false;
        };
        if !*waiting {
            return false;
        }
        *waiting = false;
        if accepted {
            self.counts.accepted += 1;
        }
        true
    }
    pub fn complete(&self) -> bool {
        self.waiting.iter().all(|pending| !pending)
    }
    pub fn accepted(&self) -> bool {
        self.complete() && self.counts.accepted == self.counts.total
    }
    pub fn snapshot(&self) -> Delivery {
        self.counts.clone()
    }
}
