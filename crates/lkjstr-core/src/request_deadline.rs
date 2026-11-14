//! Freeze unanswered work at a want's deadline; answered streams keep running.
use std::collections::HashMap;

use super::{Progress, Sub, SubState};
use crate::plan::{Planned, WantId};

pub fn progress(subs: &HashMap<String, Sub>, want: WantId) -> Progress {
    let mut out = Progress::default();
    for sub in subs.values().filter(|s| s.planned.wants.contains(&want)) {
        out.total += 1;
        match sub.state {
            SubState::Live | SubState::Done => out.answered += 1,
            SubState::Failed(_) => out.failed += 1,
            SubState::Queued | SubState::Waiting => {}
        }
    }
    out
}

pub struct Deadline {
    pub progress: Progress,
    /// At most the want's answered requests from the current bounded plan.
    /// Retained until retry/change/drop, including across socket reconnects.
    answered: Vec<Planned>,
}

impl Deadline {
    pub fn expire(subs: &HashMap<String, Sub>, want: WantId) -> Self {
        Self {
            progress: progress(subs, want).timed_out(),
            answered: subs
                .values()
                .filter(|s| {
                    s.planned.wants.contains(&want)
                        && matches!(s.state, SubState::Live | SubState::Done)
                })
                .map(|s| {
                    let mut planned = s.planned.clone();
                    planned.wants = [want].into();
                    planned
                })
                .collect(),
        }
    }

    /// Merge retained answers with fresh work, preserving shared membership.
    pub fn plan<'a>(fresh: Vec<Planned>, expired: impl Iterator<Item = &'a Self>) -> Vec<Planned> {
        let mut planned: HashMap<_, _> = fresh.into_iter().map(|p| (p.key(), p)).collect();
        for item in expired.flat_map(|deadline| &deadline.answered) {
            planned
                .entry(item.key())
                .and_modify(|p| p.wants.extend(&item.wants))
                .or_insert_with(|| item.clone());
        }
        planned.into_values().collect()
    }
}
