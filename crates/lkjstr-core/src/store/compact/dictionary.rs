use super::{
    Atom, AtomRef, CompactEvent, Id, Lease, Tags,
    accounting::{Charge, Ledger, arc_bytes, hash_reservation},
    atom::{Value, ValueRef},
    decode_id,
    identity::Encoding,
};
use lkjstr_protocol::NostrEvent;
use std::{
    collections::HashMap,
    hash::{BuildHasher, BuildHasherDefault, DefaultHasher},
    mem::size_of,
    sync::Arc,
};

/// Strings longer than this retain a direct payload reference without occupying
/// dictionary lookup buckets. Event content is never interned.
const INTERN_BYTES: usize = 128;
#[derive(Default)]
pub struct Pool {
    ledger: Arc<Ledger>,
    // Strong entries permit exact Arc lifetime charging. A map-only entry is
    // reclaimed by reap; no Weak control block survives an uncharged Atom drop.
    symbols: HashMap<u64, Vec<AtomRef>>,
    bucket_bytes: usize,
    packs: usize,
    last_reaped: usize,
    #[cfg(test)]
    reaps: usize,
}
impl Pool {
    pub fn pack(&mut self, event: NostrEvent) -> Result<Lease, &'static str> {
        let encoding = Encoding::of(&event)?;
        Ok(self.pack_encoded(event, encoding))
    }
    pub(crate) fn pack_encoded(&mut self, event: NostrEvent, encoding: Encoding) -> Lease {
        let Encoding { id, author, sig } = encoding;
        let wire_bytes = crate::store::event_payload_bytes(&event);
        let expires_at = crate::store::expiration::deadline(&event).ok().flatten();
        let author = self.key(author);
        let tags = Tags::pack(event.tags, self);
        let content = event.content.into_boxed_str();
        let bytes = arc_bytes::<CompactEvent>() + content.len() + tags.owned_bytes();
        let attributed_bytes = bytes + author.managed_bytes() + tags.symbols_bytes();
        let lease = Arc::new(CompactEvent {
            order: (event.created_at, id),
            author,
            kind: event.kind,
            sig,
            content,
            tags,
            wire_bytes,
            expires_at,
            charge: Charge::new(&self.ledger, bytes),
            attributed_bytes,
        });
        self.packs = self.packs.wrapping_add(1);
        if self.packs.is_multiple_of(256) && self.ledger.releases() != self.last_reaped {
            self.reap();
        }
        lease
    }
    pub fn text(&mut self, value: &str) -> AtomRef {
        let (hash, existing) = self.lookup(ValueRef::Text(value));
        existing.unwrap_or_else(|| self.intern_new(hash, Value::Text(value.into())))
    }
    pub fn key(&mut self, value: Id) -> AtomRef {
        self.intern(Value::Key(value))
    }
    pub(super) fn field(&mut self, value: String) -> AtomRef {
        if let Some(key) = decode_id(&value) {
            return self.key(key);
        }
        if value.len() > INTERN_BYTES {
            return self.allocate(Value::Text(value.into_boxed_str()));
        }
        let (hash, existing) = self.lookup(ValueRef::Text(&value));
        existing.unwrap_or_else(|| self.intern_new(hash, Value::Text(value.into_boxed_str())))
    }
    fn allocate(&self, value: Value) -> AtomRef {
        let bytes = arc_bytes::<Atom>()
            + match &value {
                Value::Key(_) => 0,
                Value::Text(text) => text.len(),
            };
        Arc::new(Atom {
            value,
            charge: Charge::new(&self.ledger, bytes),
        })
    }
    fn lookup(&self, value: ValueRef<'_>) -> (u64, Option<AtomRef>) {
        let hash = BuildHasherDefault::<DefaultHasher>::default().hash_one(&value);
        let existing = self.symbols.get(&hash).and_then(|bucket| {
            bucket
                .iter()
                .find(|atom| atom.value.borrowed() == value)
                .map(Arc::clone)
        });
        (hash, existing)
    }
    fn intern(&mut self, value: Value) -> AtomRef {
        let (hash, existing) = self.lookup(value.borrowed());
        existing.unwrap_or_else(|| self.intern_new(hash, value))
    }
    fn intern_new(&mut self, hash: u64, value: Value) -> AtomRef {
        let atom = self.allocate(value);
        let bucket = self.symbols.entry(hash).or_default();
        let before = bucket.capacity();
        bucket.push(Arc::clone(&atom));
        self.bucket_bytes += (bucket.capacity() - before) * size_of::<AtomRef>();
        atom
    }
    pub fn reap(&mut self) {
        // Snapshot before the sweep: a concurrent lease release must remain
        // visible to the next periodic pass, even if this sweep misses it.
        let releases = self.ledger.releases();
        #[cfg(test)]
        {
            self.reaps += 1;
        }
        let mut bucket_bytes = 0;
        self.symbols.retain(|_, bucket| {
            bucket.retain(|atom| Arc::strong_count(atom) > 1);
            if bucket.len() * 4 < bucket.capacity() {
                bucket.shrink_to_fit();
            }
            bucket_bytes += bucket.capacity() * size_of::<AtomRef>();
            !bucket.is_empty()
        });
        self.bucket_bytes = bucket_bytes;
        if self.symbols.len() * 4 < self.symbols.capacity() {
            self.symbols.shrink_to_fit();
        }
        self.last_reaped = releases;
    }
    #[cfg(test)]
    pub(super) fn maintenance_counts(&self) -> (usize, usize) {
        (self.reaps, self.symbols.values().map(Vec::len).sum())
    }
    pub fn managed_bytes(&self) -> usize {
        self.ledger.bytes()
            + arc_bytes::<Ledger>()
            + self.bucket_bytes
            + hash_reservation::<u64, Vec<AtomRef>>(self.symbols.capacity())
    }
}

#[cfg(test)]
#[path = "dictionary_test.rs"]
mod tests;
