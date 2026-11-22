//! A context is authority only when every body and historical verdict matches.
use super::*;
use std::collections::BTreeSet;
impl Context {
    /// The token binds the target and every retained contributor/fence ID.
    /// Per-record receipts bind exact checked bytes. Neither field authenticates
    /// arbitrary same-origin code; this is a corruption boundary.
    pub fn checked(&self) -> Result<BTreeMap<String, NostrEvent>, &'static str> {
        if self.rows.len() > CONTEXT_RECORDS
            || !lkjstr_protocol::is_event_id(&self.target)
            || !lkjstr_protocol::is_event_id(&self.author)
            || (self.lineage.is_empty() != (self.generation == 0))
            || (!self.lineage.is_empty() && !lkjstr_protocol::is_event_id(&self.lineage))
            || self.token
                != token(
                    &self.target,
                    &self.author,
                    &self.lineage,
                    self.generation,
                    &self.rows,
                    &self.zaps,
                )?
        {
            return Err("invalid read context token");
        }
        let mut events = BTreeMap::new();
        for row in &self.rows {
            let Ok(Restored::Verified(event)) = row.restore() else {
                return Err("unverified read context record");
            };
            let policy = crate::kinds::policy(event.kind);
            let eligible = if event.id == self.target {
                policy.context_target
            } else {
                policy.context_contributor
            };
            if !eligible || events.insert(event.id.clone(), event).is_some() {
                return Err("invalid read context membership");
            }
        }
        if events
            .get(&self.target)
            .is_none_or(|event| event.pubkey != self.author)
            && !events.values().any(|event| {
                event.kind == 5
                    && event.pubkey == self.author
                    && lkjstr_protocol::tags::tag_values(event, "e").contains(&self.target)
            })
        {
            return Err("read context lost its target");
        }
        let rows: BTreeMap<_, _> = self.rows.iter().map(|row| (&row.id, row)).collect();
        let mut zaps = BTreeSet::new();
        for zap in &self.zaps {
            if !zaps.insert(&zap.id) {
                return Err("duplicate zap context receipt");
            }
            zap.checked(
                rows.get(&zap.id)
                    .ok_or("zap context lost its raw receipt")?,
            )?;
        }
        Ok(events)
    }
    pub fn deleted(&self) -> bool {
        self.rows.iter().any(|row| {
            matches!(row.restore(), Ok(Restored::Verified(event)) if event.kind == 5
                && event.pubkey == self.author
                && lkjstr_protocol::tags::tag_values(&event, "e").contains(&self.target))
        })
    }
}
pub(super) fn token(
    target: &str,
    author: &str,
    lineage: &str,
    generation: u64,
    rows: &[Record],
    zaps: &[ReceiptRecord],
) -> Result<String, &'static str> {
    let ids: Vec<_> = rows.iter().map(|row| &row.id).collect();
    let proofs: Vec<_> = zaps.iter().map(|zap| (&zap.id, &zap.digest)).collect();
    let raw = serde_json::to_vec(&(
        "lkjstr-read-context-1",
        target,
        author,
        lineage,
        generation,
        ids,
        proofs,
    ))
    .map_err(|_| "read context token encoding failed")?;
    Ok(lkjstr_protocol::bytes_to_hex(&Sha256::digest(raw)))
}
