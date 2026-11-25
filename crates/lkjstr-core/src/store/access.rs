//! Projection stamps and score generations, removed with the held event.
use std::collections::HashMap;

#[derive(Default)]
pub(super) struct Access {
    // One stamp for each retained event, capped by the event store itself.
    stamps: HashMap<super::Id, Stamp>,
}

#[derive(Clone, Copy, Default)]
pub(super) struct Stamp {
    pub minute: u64,
    pub inflation: u64,
}

impl Access {
    pub fn managed_bytes(&self) -> usize {
        super::accounting::table::<super::Id, Stamp>(self.stamps.capacity())
    }
    pub fn record(&mut self, id: &super::Id, minute: u64, inflation: u64) {
        self.stamps.insert(*id, Stamp { minute, inflation });
    }

    pub fn get(&self, id: &super::Id) -> Stamp {
        self.stamps.get(id).copied().unwrap_or_default()
    }

    pub fn remove(&mut self, id: &super::Id) {
        self.stamps.remove(id);
    }
}
