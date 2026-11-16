use super::*;
impl Receipts {
    /// Standalone callers may drain the bounded FIFO; runtime uses current targets.
    pub fn advance(&mut self, store: &Store, providers: &Providers, now: u64, budget: usize) {
        for _ in 0..budget.min(4) {
            let Some(id) = self.queue.first_key_value().map(|(_, id)| id.clone()) else {
                break;
            };
            self.validate_id(store, providers, &id, now);
        }
    }
    pub(super) fn validate_id(&mut self, store: &Store, providers: &Providers, id: &str, now: u64) {
        self.unqueue(id);
        let Some(entry) = self.entries.get(id) else {
            return;
        };
        let Some(recipient) = &entry.recipient else {
            return;
        };
        let Some(proof) = providers.get(store, recipient, now) else {
            return;
        };
        let Some(raw) = store.get(id) else { return };
        let mut retry_capacity = false;
        let result = receipt(store, &raw, proof.clone(), now).and_then(|mut value| {
            if let Some(existing) = self.identities.get(&value.proof) {
                value.proof = existing.clone();
            } else if self.identities.len() < MAX_HISTORICAL_IDENTITIES {
                self.identities.insert(value.proof.clone());
            } else {
                retry_capacity = true;
                return Err(Failure::TooLarge);
            }
            Ok(value)
        });
        self.detach(id);
        if let Some(entry) = self.entries.get_mut(id) {
            entry.checked = Some(Checked {
                attempt: Arc::downgrade(&proof),
                result,
                retry_capacity,
                at: now,
            });
        }
        self.attach(id);
        self.revision = self.revision.saturating_add(1);
    }
}
