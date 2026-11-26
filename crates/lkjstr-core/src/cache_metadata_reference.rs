//! Required evidence can reference its existing durable body instead of duplicating it.
use super::{Checkpoint, Record, Restored, checkpoint};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const REQUIRED_EVENTS: usize = 20_000;
pub const REQUIRED_BYTES: usize = 64 * 1024 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Required {
    pub id: String,
    pub receipt: String,
}
pub struct MetadataCommit {
    pub encoded: String,
    /// Bodies referenced by the checkpoint must be written in the same transaction.
    pub required: Vec<Record>,
}
pub fn references(raw: Option<&str>) -> Result<Vec<Required>, &'static str> {
    raw.map(checkpoint)
        .transpose()
        .map(|data| data.map_or_else(Vec::new, |data| data.required))
}
pub fn resolve(raw: Option<&str>, resolved: &[Record]) -> Result<Vec<Record>, &'static str> {
    let Some(data) = raw.map(checkpoint).transpose()? else {
        return Ok(Vec::new());
    };
    resolve_checkpoint(data, resolved)
}
fn resolve_checkpoint(data: Checkpoint, resolved: &[Record]) -> Result<Vec<Record>, &'static str> {
    let mut available: BTreeMap<_, _> = resolved.iter().map(|row| (&row.id, row)).collect();
    let mut rows = data.rows;
    let mut bytes = 0_usize;
    for reference in data.required {
        let row = available
            .remove(&reference.id)
            .ok_or("required cache evidence missing")?;
        bytes = bytes.saturating_add(crate::cache::durable::charge(row));
        if bytes > REQUIRED_BYTES {
            return Err("required cache evidence exceeds durable budget");
        }
        if row.receipt.as_deref() != Some(&reference.receipt)
            || !matches!(row.restore(), Ok(Restored::Verified(_)))
            || !row.is_checkpoint()
        {
            return Err("required cache evidence failed verification");
        }
        rows.push(row.clone());
    }
    Ok(rows)
}
pub(super) fn error(message: &'static str) -> serde_json::Error {
    serde_json::Error::io(std::io::Error::other(message))
}
