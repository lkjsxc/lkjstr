//! Pure request lifecycle decisions; collections are bounded by the current plan.
use std::collections::HashMap;

use crate::plan::Planned;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SubState {
    Queued,
    Waiting,
    Live,
    Done,
    Failed(String),
}

impl SubState {
    pub fn active(&self) -> bool {
        matches!(self, Self::Waiting | Self::Live)
    }
    pub fn busy(&self) -> bool {
        self.active() || *self == Self::Queued
    }
}

pub struct Sub {
    pub sub_id: String,
    pub planned: Planned,
    pub state: SubState,
    pub sent_ms: u64,
    pub events: u32,
}

/// Apply the whole diff before selecting queued work. Return active CLOSEs.
pub fn reconcile(
    subs: &mut HashMap<String, Sub>,
    planned: Vec<Planned>,
    next: &mut u32,
) -> Vec<(String, String)> {
    let planned: HashMap<_, _> = planned.into_iter().map(|p| (p.key(), p)).collect();
    let mut close = Vec::new();
    subs.retain(|key, sub| {
        if planned.contains_key(key) {
            return true;
        }
        if sub.state.active() {
            close.push((sub.planned.relay.clone(), sub.sub_id.clone()));
        }
        false
    });
    for (key, item) in planned {
        match subs.get_mut(&key) {
            Some(sub) => sub.planned.wants = item.wants,
            None => {
                *next += 1;
                subs.insert(
                    key,
                    Sub {
                        sub_id: format!("q{next}"),
                        planned: item,
                        state: SubState::Queued,
                        sent_ms: 0,
                        events: 0,
                    },
                );
            }
        }
    }
    close
}

/// Queued keys that fit the relay's currently free slots, deterministic order.
pub fn ready(subs: &HashMap<String, Sub>, relay: &str, cap: usize) -> Vec<String> {
    let active = subs
        .values()
        .filter(|s| s.planned.relay == relay && s.state.active())
        .count();
    let mut keys: Vec<_> = subs
        .iter()
        .filter(|(_, s)| s.planned.relay == relay && s.state == SubState::Queued)
        .map(|(key, _)| key.clone())
        .collect();
    keys.sort();
    keys.truncate(cap.saturating_sub(active));
    keys
}

pub fn busy(subs: &HashMap<String, Sub>, relay: &str) -> bool {
    subs.values()
        .any(|s| s.planned.relay == relay && s.state.busy())
}

/// Only an accepted acknowledgement of this socket's pending AUTH can retry.
#[derive(Default)]
pub struct Auth {
    pub pending: Option<String>,
}

impl Auth {
    pub fn acknowledge(
        &mut self,
        id: &str,
        accepted: bool,
        relay: &str,
        subs: &mut HashMap<String, Sub>,
    ) -> bool {
        if self.pending.as_deref() != Some(id) {
            return false;
        }
        self.pending = None;
        if accepted {
            for sub in subs.values_mut().filter(|s| s.planned.relay == relay) {
                if matches!(&sub.state, SubState::Failed(why) if why.starts_with("auth-required:"))
                {
                    sub.state = SubState::Queued;
                }
            }
        }
        true
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Progress {
    pub total: usize,
    pub answered: usize,
    pub failed: usize,
}

impl Progress {
    pub fn settled(&self) -> bool {
        self.answered + self.failed >= self.total
    }
    pub fn add(&mut self, other: Self) {
        self.total += other.total;
        self.answered += other.answered;
        self.failed += other.failed;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lookup {
    Loading,
    NoRelay,
    Missing,
    Failed,
}

impl Lookup {
    pub fn from_progress(progress: Option<Progress>) -> Self {
        match progress {
            None => Self::Loading,
            Some(p) if p.total == 0 => Self::NoRelay,
            Some(p) if !p.settled() => Self::Loading,
            Some(p) if p.failed == p.total => Self::Failed,
            Some(_) => Self::Missing,
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::Loading => "Looking for this note on relays…",
            Self::NoRelay => "No relay available to look for this note.",
            Self::Missing => "Note not found on the relays we asked.",
            Self::Failed => "Relays failed or refused the note lookup.",
        }
    }
}
