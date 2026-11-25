//! Managed allocation ledger: exact owned payloads plus conservative opaque indexes.
//! Standard library hash/tree node layouts are private. Charge their spare slots,
//! control bytes and worst-case half-full nodes; this is not process RSS.
use super::*;
use std::mem::size_of;

pub(super) fn table<K, V>(capacity: usize) -> usize {
    if capacity == 0 {
        return 0;
    }
    // Hash tables leave at least 1/8 of buckets empty and reserve control bytes.
    let buckets = capacity.saturating_mul(8).div_ceil(7).next_power_of_two();
    buckets
        .saturating_mul(size_of::<(K, V)>() + 1)
        .saturating_add(16)
}
fn map<K, V>(value: &HashMap<K, V>) -> usize {
    table::<K, V>(value.capacity())
}
fn set<K>(value: &HashSet<K>) -> usize {
    table::<K, ()>(value.capacity())
}
fn tree<K, V>(count: usize) -> usize {
    if count == 0 {
        return 11 * size_of::<(K, V)>() + 16;
    }
    let node = 11 * size_of::<(K, V)>() + 12 * size_of::<usize>() + 16;
    (count.div_ceil(5) + 1).saturating_mul(node)
}
fn ordered<K>(value: &BTreeSet<K>) -> usize {
    tree::<K, ()>(value.len())
}
fn strings<'a>(values: impl Iterator<Item = &'a String>) -> usize {
    values.map(String::capacity).sum()
}

impl Store {
    /// All resident payload leases (even pending after eviction), dictionaries,
    /// parsed profiles, relay observations, indexes and bounded policy evidence.
    /// Transient protocol projections and host-owned buffers have separate owners.
    pub fn managed_bytes(&self) -> usize {
        let mut bytes =
            size_of::<Self>() + self.compact.managed_bytes() + self.persistence_overhead;
        bytes += map(&self.events) + map(&self.seen_on) + ordered(&self.by_time);
        bytes += self.seen_on_bytes;
        bytes += map(&self.by_author) + self.by_author.values().map(ordered).sum::<usize>();
        bytes += map(&self.by_tag_p) + self.by_tag_p.values().map(ordered).sum::<usize>();
        bytes += map(&self.by_tag_e)
            + self
                .by_tag_e
                .values()
                .map(|v| v.capacity() * size_of::<Lease>())
                .sum::<usize>();
        bytes += map(&self.by_comment_address)
            + strings(self.by_comment_address.keys())
            + self
                .by_comment_address
                .values()
                .map(|v| v.capacity() * size_of::<Lease>())
                .sum::<usize>();
        bytes += map(&self.replaceable)
            + map(&self.addressable)
            + self
                .addressable
                .keys()
                .map(|(_, _, d)| d.capacity())
                .sum::<usize>();
        bytes += map(&self.profiles) + strings(self.profiles.keys());
        bytes += self
            .profiles
            .values()
            .map(|p| {
                size_of::<Profile>()
                    + 2 * size_of::<usize>()
                    + [
                        &p.name,
                        &p.display_name,
                        &p.about,
                        &p.picture,
                        &p.banner,
                        &p.nip05,
                        &p.lud16,
                        &p.website,
                    ]
                    .into_iter()
                    .map(String::capacity)
                    .sum::<usize>()
            })
            .sum::<usize>();
        bytes += map(&self.verified_nip05)
            + strings(self.verified_nip05.keys())
            + strings(self.verified_nip05.values());
        bytes += map(&self.query_names)
            + strings(self.query_names.keys())
            + strings(self.query_names.values());
        bytes += set(&self.deleted)
            + self
                .deleted
                .iter()
                .map(|(a, b)| a.capacity() + b.capacity())
                .sum::<usize>();
        bytes += set(&self.context_pins) + strings(self.context_pins.iter());
        bytes += set(&self.context_deleted)
            + self
                .context_deleted
                .iter()
                .map(|(a, b)| a.capacity() + b.capacity())
                .sum::<usize>();
        bytes += map(&self.verified_deleted) + strings(self.verified_deleted.keys());
        bytes += ordered(&self.expiry_deadlines)
            + self
                .expiry_deadlines
                .iter()
                .map(|(_, id)| id.capacity())
                .sum::<usize>();
        bytes += tree::<String, (u64, String)>(self.expired.len())
            + self
                .expired
                .iter()
                .map(|(id, (_, author))| id.capacity() + author.capacity())
                .sum::<usize>();
        bytes += tree::<String, eviction_fences::Fence>(self.evicted.len())
            + self
                .evicted
                .iter()
                .map(|(id, fence)| id.capacity() + fence.heap_bytes())
                .sum::<usize>();
        bytes += ordered(&self.evicted_order)
            + self
                .evicted_order
                .iter()
                .map(|(_, id)| id.capacity())
                .sum::<usize>();
        bytes += ordered(&self.evicted_times)
            + self
                .evicted_times
                .iter()
                .map(|(_, id)| id.capacity())
                .sum::<usize>();
        bytes
            + map(&self.generations)
            + self.access.managed_bytes()
            + self.address_deletions.managed_bytes()
    }
}
