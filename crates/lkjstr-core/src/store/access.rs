//! Projection stamps and score generations, removed with the held event.
use std::collections::HashMap;

#[derive(Default)]
pub(super) struct Access {
    // One stamp for each retained event, capped by the event store itself.
    stamps: HashMap<String, Stamp>,
}

#[derive(Clone, Copy, Default)]
pub(super) struct Stamp {
    pub minute: u64,
    pub inflation: u64,
}

impl Access {
    pub fn record(&mut self, id: &str, minute: u64, inflation: u64) {
        self.stamps
            .insert(id.to_owned(), Stamp { minute, inflation });
    }

    pub fn get(&self, id: &str) -> Stamp {
        self.stamps.get(id).copied().unwrap_or_default()
    }

    pub fn remove(&mut self, id: &str) {
        self.stamps.remove(id);
    }
}
