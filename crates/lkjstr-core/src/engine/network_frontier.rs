//! Bounded newest-L evidence for one logical filter in an immutable envelope.
//! Sibling filters can return older matching events beyond this filter's quota.
use std::collections::BTreeMap;

#[derive(Clone, Default)]
pub(in crate::engine) struct PageFrontier {
    // At most the transmitted page limit (relay max_limit is clamped to 200).
    times: BTreeMap<String, u64>,
    oldest: Option<u64>,
}
impl PageFrontier {
    pub(in crate::engine) fn len(&self) -> usize {
        self.times.len()
    }
    pub(in crate::engine) fn contains(&self, id: &str) -> bool {
        self.times.contains_key(id)
    }
    pub(in crate::engine) fn is_empty(&self) -> bool {
        self.times.is_empty()
    }
    pub(in crate::engine) fn iter(&self) -> impl Iterator<Item = &String> {
        self.times.keys()
    }
    pub(super) fn timestamp(&self, id: &str) -> Option<u64> {
        self.times.get(id).copied()
    }
    pub(in crate::engine) fn clear(&mut self) {
        self.times.clear();
        self.oldest = None;
    }
    pub(super) fn record(&mut self, id: &str, at: u64, limit: usize) -> Option<u64> {
        if limit == 0 {
            self.clear();
            return None;
        }
        if self.times.contains_key(id) {
            return self.oldest;
        }
        if self.times.len() < limit {
            self.times.insert(id.to_owned(), at);
            self.oldest = Some(self.oldest.map_or(at, |oldest| oldest.min(at)));
            return self.oldest;
        }
        // Equal timestamps keep the same inclusive boundary. A sibling's older
        // result is not authority to advance this filter past its own newest L.
        if self.oldest.is_some_and(|oldest| at <= oldest) {
            return self.oldest;
        }
        let victim = self
            .times
            .iter()
            .find(|(_, timestamp)| Some(**timestamp) == self.oldest)
            .map(|(id, _)| id.clone());
        if let Some(victim) = victim {
            self.times.remove(&victim);
        }
        self.times.insert(id.to_owned(), at);
        self.oldest = self.times.values().copied().min();
        self.oldest
    }
}

#[cfg(test)]
#[path = "network_frontier_test.rs"]
mod tests;
