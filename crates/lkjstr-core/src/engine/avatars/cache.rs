//! Pure LRU plans. Read the rows and totals inside the transaction that applies the plan.
use super::{MAX_DERIVED_BYTES, host};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
pub const MAX_BYTES: u64 = 20 * 1024 * 1024;
pub const MAX_ENTRIES: usize = 4096;
// Browser storage uses exact JavaScript integers. Exhausted disposable state is rebuilt.
pub const MAX_SEQUENCE: u64 = (1 << 53) - 1;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Entry {
    pub key: String,
    pub bytes: u64,
    pub used: u64,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize, Serialize)]
pub struct Totals {
    pub bytes: u64,
    pub entries: usize,
    pub sequence: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Plan {
    pub remove: Vec<String>,
    pub totals: Totals,
    /// A concurrent writer already committed this immutable URL. Reuse its actual Blob.
    pub existing: bool,
    pub entry: Entry,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    Invalid,
    TooLarge,
    Exhausted,
}
impl Totals {
    fn next(self) -> Result<u64, Failure> {
        if self.bytes > MAX_BYTES || self.entries > MAX_ENTRIES || self.sequence > MAX_SEQUENCE {
            return Err(Failure::Invalid);
        }
        self.sequence
            .checked_add(1)
            .filter(|value| *value <= MAX_SEQUENCE)
            .ok_or(Failure::Exhausted)
    }
}
impl Entry {
    pub fn valid(&self, totals: Totals) -> bool {
        host(&self.key).is_some()
            && (1..=MAX_DERIVED_BYTES).contains(&self.bytes)
            && self.used > 0
            && self.used <= totals.sequence
    }
}

/// A hit touches one record and the sequence in the same read/write transaction.
pub fn touch(totals: Totals, entry: &Entry) -> Result<(Totals, Entry), Failure> {
    let sequence = totals.next()?;
    if !entry.valid(totals) || totals.entries == 0 || entry.bytes > totals.bytes {
        return Err(Failure::Invalid);
    }
    Ok((
        Totals { sequence, ..totals },
        Entry {
            used: sequence,
            ..entry.clone()
        },
    ))
}

/// Effects supply actual Blob.size, never Content-Length or a pre-encode estimate.
pub fn insert(
    totals: Totals,
    rows: &[Entry],
    key: &str,
    actual_bytes: u64,
) -> Result<Plan, Failure> {
    let sequence = totals.next()?;
    if rows.len() != totals.entries || host(key).is_none() {
        return Err(Failure::Invalid);
    }
    let mut keys = BTreeSet::new();
    let mut bytes = 0_u64;
    for row in rows {
        if !row.valid(totals) || !keys.insert(row.key.as_str()) {
            return Err(Failure::Invalid);
        }
        bytes = bytes.checked_add(row.bytes).ok_or(Failure::Invalid)?;
    }
    if bytes != totals.bytes {
        return Err(Failure::Invalid);
    }
    let prior = rows.iter().find(|row| row.key == key);
    let existing = prior.is_some();
    let entry = if let Some(prior) = prior {
        Entry {
            used: sequence,
            ..prior.clone()
        }
    } else {
        if !(1..=MAX_DERIVED_BYTES).contains(&actual_bytes) {
            return Err(Failure::TooLarge);
        }
        Entry {
            key: key.to_owned(),
            bytes: actual_bytes,
            used: sequence,
        }
    };
    let mut count = rows.len() + usize::from(!existing);
    if !existing {
        bytes = bytes.checked_add(entry.bytes).ok_or(Failure::TooLarge)?;
    }
    let mut oldest: Vec<_> = rows.iter().filter(|row| row.key != key).collect();
    oldest.sort_unstable_by(|a, b| a.used.cmp(&b.used).then_with(|| a.key.cmp(&b.key)));
    let mut remove = Vec::new();
    for row in oldest {
        if bytes <= MAX_BYTES && count <= MAX_ENTRIES {
            break;
        }
        bytes = bytes.checked_sub(row.bytes).ok_or(Failure::Invalid)?;
        count -= 1;
        remove.push(row.key.clone());
    }
    if bytes > MAX_BYTES || count > MAX_ENTRIES {
        return Err(Failure::TooLarge);
    }
    Ok(Plan {
        remove,
        totals: Totals {
            bytes,
            entries: count,
            sequence,
        },
        existing,
        entry,
    })
}
