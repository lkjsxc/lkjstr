//! A payload-byte bound supplements event-count limits against large notes.
use super::Store;
use lkjstr_protocol::NostrEvent;
pub fn event_payload_bytes(e: &NostrEvent) -> usize {
    e.id.len()
        + e.pubkey.len()
        + e.sig.len()
        + e.content.len()
        + e.tags.iter().flatten().map(String::len).sum::<usize>()
}
impl Store {
    pub fn with_byte_cap(mut self, cap: usize) -> Self {
        self.byte_cap = cap;
        self.evict();
        self
    }
    pub(crate) fn byte_cap(&self) -> usize {
        self.byte_cap
    }
    pub(crate) fn replaceable_len(&self) -> usize {
        self.replaceable.len() + self.addressable.len()
    }
    pub fn payload_bytes(&self) -> usize {
        self.payload_bytes
    }
}
