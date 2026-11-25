//! Merge author indexes without walking unrelated events in the global timeline.
use super::{OrderedEvent, Store, decode_id};
use std::collections::{BinaryHeap, HashSet, btree_set};
use std::iter::Rev;
struct Merged<'a> {
    sources: Vec<Rev<btree_set::Iter<'a, OrderedEvent>>>,
    heap: BinaryHeap<(&'a OrderedEvent, usize)>,
}
impl<'a> Iterator for Merged<'a> {
    type Item = &'a OrderedEvent;
    fn next(&mut self) -> Option<Self::Item> {
        let (key, index) = self.heap.pop()?;
        if let Some(next) = self.sources[index].next() {
            self.heap.push((next, index));
        }
        Some(key)
    }
}
impl Store {
    pub(super) fn author_feed<'a>(
        &'a self,
        authors: &HashSet<String>,
    ) -> impl Iterator<Item = &'a OrderedEvent> + 'a {
        let mut sources: Vec<_> = authors
            .iter()
            .filter_map(|a| decode_id(a))
            .filter_map(|a| self.by_author.get(&a))
            .map(|set| set.iter().rev())
            .collect();
        let heap = sources
            .iter_mut()
            .enumerate()
            .filter_map(|(i, s)| s.next().map(|key| (key, i)))
            .collect();
        Merged { sources, heap }
    }
}
