use super::*;
use crate::optimizer::link::LinkState;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    sync::{Arc, Mutex},
};

pub const MAX_RECORDS: usize = 4096;
pub const MAX_DECISIONS: usize = 512;
pub const MAX_CANDIDATES: usize = 128;
const MAX_ORIGIN: usize = 320;

#[derive(Default, Debug, Serialize)]
pub struct Ledger {
    records: VecDeque<(u64, FetchRecord)>,
    decisions: VecDeque<Decision>,
    pub totals: BTreeMap<ResourceClass, Totals>,
    pub dropped_records: u64,
    pub dropped_decisions: u64,
    next: u64,
    #[serde(skip)]
    decision_enabled: bool,
    #[serde(skip)]
    pub(super) ghost_order: VecDeque<(ResourceClass, KeyHash)>,
    #[serde(skip)]
    pub(super) ghost_keys: BTreeSet<(ResourceClass, KeyHash)>,
}
impl Ledger {
    pub fn records(&self) -> impl Iterator<Item = &FetchRecord> {
        self.records.iter().map(|(_, r)| r)
    }
    pub fn decisions(&self) -> impl Iterator<Item = &Decision> {
        self.decisions.iter()
    }
    fn push(&mut self, record: FetchRecord) -> u64 {
        let t = self.totals.entry(record.class).or_default();
        t.records = t.records.saturating_add(1);
        match record.wire_bytes {
            WireBytes::Measured(bytes) => t.measured_bytes = t.measured_bytes.saturating_add(bytes),
            WireBytes::Unmeasured => t.unmeasured = t.unmeasured.saturating_add(1),
        }
        match record.link_ms {
            Some(ms) => t.link_ms = t.link_ms.saturating_add(ms),
            None => t.unknown_link = t.unknown_link.saturating_add(1),
        }
        if self.records.len() == MAX_RECORDS {
            self.records.pop_front();
            self.dropped_records = self.dropped_records.saturating_add(1);
        }
        let id = self.next;
        self.next = self.next.saturating_add(1);
        self.records.push_back((id, record));
        id
    }
    fn update(&mut self, id: u64, outcome: Outcome, stored_bytes: Option<u64>) {
        let Some((first, _)) = self.records.front() else {
            return;
        };
        if let Some((actual, r)) = id
            .checked_sub(*first)
            .and_then(|offset| usize::try_from(offset).ok())
            .and_then(|offset| self.records.get_mut(offset))
            && *actual == id
        {
            r.outcome = outcome;
            r.stored_bytes = stored_bytes;
        }
    }
}
/// Per-engine shared handle. No persistence, outputs, global registry, or learning.
#[derive(Clone)]
pub struct Observer {
    seed: Option<[u8; 16]>,
    ledger: Arc<Mutex<Ledger>>,
}
impl std::fmt::Debug for Observer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Observer").finish_non_exhaustive()
    }
}
impl Default for Observer {
    fn default() -> Self {
        let mut seed = [0; 16];
        Self {
            seed: getrandom::fill(&mut seed).ok().map(|()| seed),
            ledger: Default::default(),
        }
    }
}
impl Observer {
    pub fn disabled() -> Self {
        Self {
            seed: None,
            ledger: Default::default(),
        }
    }
    pub fn inspect<T>(&self, f: impl FnOnce(&Ledger) -> T) -> T {
        f(&self.ledger.lock().unwrap_or_else(|err| err.into_inner()))
    }
    pub(super) fn edit<T>(&self, f: impl FnOnce(&mut Ledger) -> T) -> T {
        f(&mut self.ledger.lock().unwrap_or_else(|err| err.into_inner()))
    }
    pub fn key(&self, identity: &str) -> Option<KeyHash> {
        let seed = self.seed?;
        let digest = Sha256::new()
            .chain_update(seed)
            .chain_update(identity.as_bytes())
            .finalize();
        Some(KeyHash(u64::from_le_bytes(digest[..8].try_into().ok()?)))
    }
    pub fn record(&self, record: FetchRecord) -> u64 {
        self.edit(|l| l.push(record))
    }
    pub fn finish(&self, id: u64, outcome: Outcome, stored_bytes: Option<u64>) {
        self.edit(|l| l.update(id, outcome, stored_bytes));
    }
    pub fn count(&self, class: ResourceClass, f: impl FnOnce(&mut Totals)) {
        self.edit(|l| f(l.totals.entry(class).or_default()));
    }
    pub fn set_decisions(&self, enabled: bool) {
        self.edit(|l| l.decision_enabled = enabled);
    }
    pub fn decisions_enabled(&self) -> bool {
        self.inspect(|l| l.decision_enabled)
    }
    /// Candidates are hashed synchronously, and only when explicitly enabled.
    pub fn decision<'a>(
        &self,
        action: Action,
        at_ms: u64,
        candidates: impl IntoIterator<Item = (&'a str, Option<u64>)>,
        chosen: impl IntoIterator<Item = &'a str>,
    ) {
        if !self.decisions_enabled() || self.seed.is_none() {
            return;
        }
        let mut d = Decision {
            action,
            at_ms,
            candidates: Vec::new(),
            omitted: 0,
            chosen: Vec::new(),
            chosen_omitted: 0,
        };
        for (key, score) in candidates {
            if d.candidates.len() < MAX_CANDIDATES {
                if let Some(key) = self.key(key) {
                    d.candidates.push(Candidate { key, score });
                }
            } else {
                d.omitted += 1;
            }
        }
        for key in chosen {
            if d.chosen.len() < MAX_CANDIDATES {
                if let Some(key) = self.key(key) {
                    d.chosen.push(key);
                }
            } else {
                d.chosen_omitted += 1;
            }
        }
        self.edit(|l| {
            if l.decisions.len() == MAX_DECISIONS {
                l.decisions.pop_front();
                l.dropped_decisions = l.dropped_decisions.saturating_add(1);
            }
            l.decisions.push_back(d);
        });
    }
    pub fn draft(
        &self,
        class: ResourceClass,
        scope: Scope,
        identity: &str,
        origin: Option<&str>,
        end_ms: u64,
    ) -> Option<FetchRecord> {
        Some(FetchRecord {
            class,
            scope,
            key: self.key(identity)?,
            lane: Lane::Unknown,
            origin: origin.and_then(origin_only),
            connection: Connection::Unknown,
            wire_bytes: WireBytes::Unmeasured,
            stored_bytes: None,
            start_ms: None,
            first_byte_ms: None,
            end_ms,
            outcome: Outcome::Unknown,
            source: Source::Unknown,
            display_size: None,
            first_visible_ms: None,
            view: None,
            slot: None,
            link_ms: None,
        })
    }
}
fn origin_only(raw: &str) -> Option<String> {
    let url = url::Url::parse(raw).ok()?;
    if !matches!(url.scheme(), "http" | "https" | "ws" | "wss") {
        return None;
    }
    let origin = url.origin().ascii_serialization();
    (origin.len() <= MAX_ORIGIN).then_some(origin)
}
/// Charge the observed application bytes once, plus one RTT for an existing
/// request or three for a new connection. No invented cost for unmeasured data.
pub fn link_cost(
    link: LinkState,
    bytes: WireBytes,
    request: bool,
    connection: Connection,
) -> Option<u64> {
    let WireBytes::Measured(bytes) = bytes else {
        return None;
    };
    let overhead = if request {
        match connection {
            Connection::New => 3,
            Connection::Reused => 1,
            Connection::Unknown => return None,
        }
    } else {
        0
    };
    Some(
        bytes
            .saturating_mul(1000)
            .div_ceil(link.throughput_bps.max(1))
            .saturating_add(link.rtt_ms.saturating_mul(overhead)),
    )
}
