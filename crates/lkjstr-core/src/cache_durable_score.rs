//! Score headers retain no payloads and are bounded by the captured row census.
use super::{Hint, Scan};
use crate::optimizer::keep_policy::KeepScorer;
use std::collections::{BTreeMap, BTreeSet};
pub(super) struct Header {
    pub author: String,
    pub kind: u64,
    pub hint: Hint,
}
impl Header {
    pub fn score(&self, authors: &BTreeMap<String, u64>, now: u64, bytes: usize) -> u64 {
        let observed = self.hint.observation;
        // Unknown hints default to neutral; explicit current mute zero stays zero.
        let weight = authors
            .get(&self.author)
            .copied()
            .unwrap_or_else(|| observed.weight.max(u64::from(observed.minute == 0)));
        let weight = if crate::optimizer::retention::public_kind(self.kind) {
            weight
        } else {
            0
        };
        KeepScorer::default().score(
            self.hint.inflation,
            self.kind,
            weight,
            now.saturating_sub(observed.minute),
            if observed.refetch == 0 {
                1500
            } else {
                observed.refetch
            },
            bytes,
        )
    }
}
impl Scan {
    pub fn authors(&self) -> BTreeSet<String> {
        self.scores
            .values()
            .map(|header| header.author.clone())
            .collect()
    }
    /// Recompute current utility only for the authors present in this snapshot.
    pub fn reweight(&mut self, authors: BTreeMap<String, u64>) {
        self.access.authors = authors;
        self.reweighted = true;
    }
}
