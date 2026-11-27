//! Bounded signed-note checkpoint encoding and validation.
use super::*;
use crate::engine::settings::strict_relay;

pub struct Checkpoint {
    pub revision: u64,
    pub rows: Vec<(String, String)>,
}
pub struct Merge {
    pub raw: String,
    pub settled: Vec<Status>,
}

impl NoteOutbox {
    pub(in crate::engine) fn reconcile(&mut self, status: Status, now: u64) -> bool {
        if !self.pending(&status.id) {
            return false;
        }
        let id = status.id.clone();
        self.settle(&id, status.phase, status.deliveries, now);
        true
    }

    pub fn snapshot(&self) -> Option<Checkpoint> {
        if self.revision == self.committed {
            return None;
        }
        let mut accounts = BTreeMap::<_, Vec<_>>::new();
        for e in self.entries.values().filter(|e| e.dirty > self.committed) {
            accounts.entry(e.account.as_str()).or_default().push(e);
        }
        Some(Checkpoint {
            revision: self.revision,
            rows: accounts
                .into_iter()
                .filter_map(|(a, es)| Some((storage_key(a), serde_json::to_string(&es).ok()?)))
                .collect(),
        })
    }

    pub fn committed(&mut self, revision: u64) {
        self.committed = self.committed.max(revision);
        prune(&mut self.entries, |entry| entry.dirty <= self.committed);
    }

    pub fn restore(&mut self, account: &str, raw: &str) -> bool {
        let Some(entries) = decode(raw) else {
            return false;
        };
        let mut valid = true;
        for mut e in entries.into_iter().take(MAX_PENDING + MAX_SETTLED) {
            let id = &e.status.id;
            if e.account != account
                || !lkjstr_protocol::is_event_id(id)
                || !(e.status.key == *id || valid_key(&e.status.key))
                || e.routes.len() > 128
                || e.hard.len() > 128
                || e.status.deliveries.len() > 128
                || e.routes
                    .iter()
                    .any(|d| strict_relay(&d.url).as_deref() != Some(&d.url))
                || e.event.as_ref().is_some_and(|event| {
                    event.id != *id
                        || event.pubkey != account
                        || event.kind != 1
                        || !self.admit(event)
                        || !matches!(
                            lkjstr_protocol::verify_event(event),
                            lkjstr_protocol::VerificationResult::Ok(_)
                        )
                })
            {
                valid = false;
                continue;
            }
            if e.event.is_some() {
                e.status.phase = Phase::Retrying;
                e.restored = true;
                e.bytes = e.event.as_ref().map_or(0, encoded_len);
            }
            self.entries.insert(id.clone(), e);
        }
        prune(&mut self.entries, |_| true);
        valid
    }
}

fn decode(raw: &str) -> Option<Vec<Entry>> {
    if raw.len() > MAX_BYTES + 8 * 1024 * 1024 {
        return None;
    }
    let entries: Vec<Entry> = serde_json::from_str(raw).ok()?;
    (entries.len() <= MAX_PENDING + MAX_SETTLED).then_some(entries)
}

fn prune(entries: &mut BTreeMap<String, Entry>, committed: impl Fn(&Entry) -> bool) {
    let mut finished: Vec<_> = entries
        .values()
        .filter(|e| e.event.is_none() && committed(e))
        .map(|e| (e.changed, e.status.id.clone()))
        .collect();
    finished.sort();
    let excess = finished.len().saturating_sub(MAX_SETTLED);
    for (_, id) in finished.into_iter().take(excess) {
        entries.remove(&id);
    }
}

/// Update only this writer's changed notes, within the account transaction.
/// An older graph cannot replace another graph's accepted or discarded body.
pub fn merge(raw: Option<&str>, updates: &str) -> Option<Merge> {
    let mut entries: BTreeMap<_, _> = decode(raw.unwrap_or("[]"))?
        .into_iter()
        .map(|e| (e.status.id.clone(), e))
        .collect();
    let mut settled = vec![];
    for e in decode(updates)? {
        if e.event.is_some()
            && let Some(current) = entries.get(&e.status.id).filter(|row| row.event.is_none())
        {
            settled.push(current.status.clone());
        } else {
            entries.insert(e.status.id.clone(), e);
        }
    }
    prune(&mut entries, |_| true);
    if entries.values().filter(|e| e.event.is_some()).count() > MAX_PENDING {
        return None;
    }
    let raw = serde_json::to_string(&entries.into_values().collect::<Vec<_>>()).ok()?;
    (raw.len() <= MAX_BYTES + 8 * 1024 * 1024).then_some(Merge { raw, settled })
}
