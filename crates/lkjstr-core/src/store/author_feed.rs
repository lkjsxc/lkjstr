//! Merge author indexes without walking unrelated events in the global timeline.
use super::{Key, Store};
use std::collections::{BinaryHeap, HashSet, btree_set};
use std::iter::Rev;
struct Merged<'a> {
    sources: Vec<Rev<btree_set::Iter<'a, Key>>>,
    heap: BinaryHeap<(&'a Key, usize)>,
}
impl<'a> Iterator for Merged<'a> {
    type Item = &'a Key;
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
    ) -> impl Iterator<Item = &'a Key> + 'a {
        let mut sources: Vec<_> = authors
            .iter()
            .filter_map(|author| self.by_author.get(author))
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
