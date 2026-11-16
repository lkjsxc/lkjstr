use super::*;
impl Receipts {
    pub(super) fn insert_entry(&mut self, id: String, entry: Entry) {
        if let Some(target) = &entry.target {
            self.index
                .entry(target.clone())
                .or_default()
                .ids
                .insert(id.clone());
        }
        self.entries.insert(id, entry);
    }
    pub(super) fn unqueue(&mut self, id: &str) {
        let Some(entry) = self.entries.get_mut(id) else {
            return;
        };
        if let Some(seq) = entry.queued.take() {
            self.queue.remove(&seq);
            if let Some(index) = entry.target.as_ref().and_then(|t| self.index.get_mut(t)) {
                index.queued.remove(&seq);
            }
        }
    }
    pub(super) fn remove_entry(&mut self, id: &str) {
        self.detach(id);
        self.unqueue(id);
        if let Some(target) = self.entries.remove(id).and_then(|e| e.target)
            && let Some(index) = self.index.get_mut(&target)
        {
            index.ids.remove(id);
            if index.ids.is_empty() {
                self.index.remove(&target);
            }
        }
    }
}
