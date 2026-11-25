//! Allocation ledger shared by the dictionary and every outstanding lease.
use std::mem::size_of;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering::Relaxed},
};

#[derive(Debug, Default)]
pub(super) struct Ledger {
    bytes: AtomicUsize,
    releases: AtomicUsize,
}

// Arc's allocation contains two reference counters followed by its value. This
// repr(C) charge includes the alignment padding on native and wasm32 targets.
#[repr(C)]
struct ArcAllocation<T> {
    counters: [usize; 2],
    value: T,
}
pub(super) fn arc_bytes<T>() -> usize {
    size_of::<ArcAllocation<T>>()
}

impl Ledger {
    pub fn bytes(&self) -> usize {
        self.bytes.load(Relaxed)
    }
    pub fn releases(&self) -> usize {
        self.releases.load(Relaxed)
    }
}

#[derive(Debug)]
pub(super) struct Charge {
    ledger: Arc<Ledger>,
    bytes: usize,
}
impl Charge {
    pub fn new(ledger: &Arc<Ledger>, bytes: usize) -> Self {
        ledger.bytes.fetch_add(bytes, Relaxed);
        Self {
            ledger: Arc::clone(ledger),
            bytes,
        }
    }
    pub fn bytes(&self) -> usize {
        self.bytes
    }
}
impl Drop for Charge {
    fn drop(&mut self) {
        self.ledger.bytes.fetch_sub(self.bytes, Relaxed);
        self.ledger.releases.fetch_add(1, Relaxed);
    }
}

/// Reservation for an opaque hash table, including spare/control capacity.
/// This intentionally exceeds its requested allocation on the pinned toolchain;
/// it is not a claim that the standard library exposes exact internal bytes.
pub(super) fn hash_reservation<K, V>(capacity: usize) -> usize {
    capacity
        .saturating_mul(size_of::<(K, V)>() + 2 * size_of::<usize>())
        .saturating_mul(2)
}
