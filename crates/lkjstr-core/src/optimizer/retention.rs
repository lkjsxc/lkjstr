//! Shared deterministic GDSF ordering and resource-scoped pressure targets.
use serde::{Deserialize, Serialize};
use std::{cmp::Reverse, collections::BinaryHeap};

pub const WORK: usize = 256;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Usage {
    pub regular: usize,
    pub replaceable: usize,
    pub bytes: usize,
}
impl Usage {
    pub fn total(self) -> usize {
        self.regular.saturating_add(self.replaceable)
    }
    pub fn remove(&mut self, replaceable: bool, bytes: usize) {
        let count = if replaceable {
            &mut self.replaceable
        } else {
            &mut self.regular
        };
        *count = count.saturating_sub(1);
        self.bytes = self.bytes.saturating_sub(bytes);
    }
}
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub regular: usize,
    pub replaceable: usize,
    pub total: usize,
    pub bytes: usize,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Target {
    pub regular: usize,
    pub replaceable: usize,
    pub total: usize,
    pub bytes: usize,
}
impl Limits {
    pub fn exceeded(self, used: Usage) -> bool {
        used.regular > self.regular
            || used.replaceable > self.replaceable
            || used.total() > self.total
            || used.bytes > self.bytes
    }
    pub fn target(self, used: Usage) -> Target {
        let low = |count, cap| {
            if count > cap {
                cap / 100 * 95 + cap % 100 * 95 / 100
            } else {
                cap
            }
        };
        Target {
            regular: low(used.regular, self.regular),
            replaceable: low(used.replaceable, self.replaceable),
            total: low(used.total(), self.total),
            bytes: low(used.bytes, self.bytes),
        }
    }
}
impl Target {
    pub fn needs(self, used: Usage, replaceable: bool) -> bool {
        used.bytes > self.bytes
            || used.total() > self.total
            || if replaceable {
                used.replaceable > self.replaceable
            } else {
                used.regular > self.regular
            }
    }
    pub fn satisfied(self, used: Usage) -> bool {
        !self.needs(used, false) && !self.needs(used, true)
    }
}

/// Score and exact event ID are the complete ordering key. Resource adapters
/// attach their own bytes/generation and revalidate protection before removal.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Candidate {
    pub score: u64,
    pub id: String,
    pub replaceable: bool,
    pub generation: u64,
    pub bytes: usize,
}
#[derive(Default)]
pub struct Candidates {
    heap: BinaryHeap<Reverse<Candidate>>,
}
impl Candidates {
    pub fn push(&mut self, candidate: Candidate) {
        self.heap.push(Reverse(candidate));
    }
    pub fn pop(&mut self) -> Option<Candidate> {
        self.heap.pop().map(|item| item.0)
    }
    pub fn is_empty(&self) -> bool {
        self.heap.is_empty()
    }
    pub fn managed_bytes(&self) -> usize {
        self.heap.capacity() * std::mem::size_of::<Candidate>()
            + self
                .heap
                .iter()
                .map(|item| item.0.id.capacity())
                .sum::<usize>()
    }
}
pub fn replaceable(kind: u64) -> bool {
    lkjstr_protocol::is_replaceable_kind(kind) || lkjstr_protocol::is_addressable_kind(kind)
}
pub fn own_policy(kind: u64) -> bool {
    matches!(kind, 0 | 3 | 10000 | 10002 | 10030 | 10063 | 30030)
}

/// Public optimization eligibility is identical for resident and durable headers.
pub(crate) fn public_kind(kind: u64) -> bool {
    crate::kinds::policy(kind).retained && kind != 10050
}
