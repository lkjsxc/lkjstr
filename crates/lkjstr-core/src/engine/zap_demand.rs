//! Stable unfinished work and per-view round-robin admission share finite capacity.
use super::Target;
use std::collections::{BTreeMap, BTreeSet};
pub(super) type Groups = Vec<(String, Vec<Target>)>;
#[derive(Default)]
pub(super) struct Selection {
    retained: BTreeSet<Target>,
    cursor: BTreeMap<String, usize>,
    after: Option<String>,
}
impl Selection {
    pub(super) fn select(
        &mut self,
        groups: &Groups,
        limit: usize,
        pending: impl Fn(&Target) -> bool,
    ) -> Vec<Target> {
        self.cursor
            .retain(|key, _| groups.iter().any(|(g, _)| g == key));
        let eligible: BTreeSet<_> = groups.iter().flat_map(|(_, rows)| rows).collect();
        let mut selected = BTreeSet::new();
        // Reserve a current reading target for every visible tile/account first.
        let priority: Vec<_> = groups
            .iter()
            .filter_map(|(_, rows)| rows.first())
            .filter(|t| selected.insert((*t).clone()))
            .take(limit)
            .cloned()
            .collect();
        for target in &self.retained {
            if selected.len() == limit {
                break;
            }
            if eligible.contains(target) && pending(target) {
                selected.insert(target.clone());
            }
        }
        let start = self
            .after
            .as_ref()
            .and_then(|key| groups.iter().position(|(g, _)| g > key))
            .unwrap_or(0);
        while selected.len() < limit {
            let mut added = false;
            for n in 0..groups.len() {
                let (key, rows) = &groups[(start + n) % groups.len()];
                if rows.is_empty() {
                    continue;
                }
                let cursor = self.cursor.entry(key.clone()).or_default();
                for _ in 0..rows.len() {
                    let target = &rows[*cursor % rows.len()];
                    *cursor = (*cursor + 1) % rows.len();
                    if selected.insert(target.clone()) {
                        added = true;
                        self.after = Some(key.clone());
                        break;
                    }
                }
                if selected.len() == limit {
                    break;
                }
            }
            if !added {
                break;
            }
        }
        self.retained = selected.clone();
        for t in &priority {
            selected.remove(t);
        }
        priority.into_iter().chain(selected).collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn groups() -> Groups {
        (0..8)
            .map(|v| {
                (
                    format!("view-{v}"),
                    (0..128)
                        .map(|n| Target::Event {
                            id: format!("{v}:{n}"),
                        })
                        .collect(),
                )
            })
            .collect()
    }
    #[test]
    fn excess_current_rows_receive_turns_after_prior_work_settles() {
        let mut s = Selection::default();
        let groups = groups();
        let mut admitted = BTreeSet::new();
        for _ in 0..3 {
            let next = s.select(&groups, 800, |_| false);
            assert_eq!(next.len(), 800);
            for (_, rows) in &groups {
                assert!(next.contains(&rows[0]));
            }
            admitted.extend(next);
        }
        assert_eq!(admitted.len(), 1024);
    }
    #[test]
    fn unfinished_visible_work_is_stable_but_hiding_releases_it() {
        let mut s = Selection::default();
        let groups = groups();
        let first = s.select(&groups, 800, |_| true);
        for _ in 0..5 {
            assert_eq!(s.select(&groups, 800, |_| true), first);
        }
        let next = s.select(&groups[1..].to_vec(), 800, |_| true);
        assert!(!next.iter().any(|t| groups[0].1.contains(t)));
        assert!(next.iter().any(|t| !first.contains(t)));
        assert!(s.select(&vec![], 800, |_| true).is_empty());
        assert!(s.cursor.is_empty());
    }
}
