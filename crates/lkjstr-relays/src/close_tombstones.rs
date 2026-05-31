#![doc = "Close tombstones for suppressing late relay frames."]

pub const fn default_close_tombstone_ttl_ms() -> u64 {
    10_000
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayCloseTombstones {
    rows: Vec<Tombstone>,
    ttl_ms: u64,
    max_size: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct Tombstone {
    id: String,
    expires_at_ms: u64,
}

impl Default for RelayCloseTombstones {
    fn default() -> Self {
        Self::new(default_close_tombstone_ttl_ms(), 256)
    }
}

impl RelayCloseTombstones {
    #[must_use]
    pub fn new(ttl_ms: u64, max_size: usize) -> Self {
        Self {
            rows: Vec::new(),
            ttl_ms,
            max_size,
        }
    }

    pub fn record<'a>(&mut self, ids: impl IntoIterator<Item = &'a str>, now_ms: u64) {
        self.prune(now_ms);
        for id in ids {
            self.rows.retain(|row| row.id != id);
            self.rows.push(Tombstone {
                id: id.to_owned(),
                expires_at_ms: now_ms.saturating_add(self.ttl_ms),
            });
        }
        self.prune(now_ms);
    }

    pub fn has_any<'a>(&mut self, ids: impl IntoIterator<Item = &'a str>, now_ms: u64) -> bool {
        self.prune(now_ms);
        ids.into_iter()
            .any(|id| self.rows.iter().any(|row| row.id == id))
    }

    pub fn clear(&mut self) {
        self.rows.clear();
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.rows.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    fn prune(&mut self, now_ms: u64) {
        self.rows.retain(|row| row.expires_at_ms > now_ms);
        while self.rows.len() > self.max_size {
            self.rows.remove(0);
        }
    }
}
