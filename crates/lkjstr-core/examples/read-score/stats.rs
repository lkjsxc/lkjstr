use lkjstr_core::{
    engine::{
        Engine,
        protocol::{Output, Patch},
    },
    store::Store,
};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Default)]
pub struct Stats {
    pub requests: usize,
    pub connections: usize,
    pub max_connections: usize,
    pub bytes_in: usize,
    pub bytes_out: usize,
    pub wire_events: usize,
    pub duplicates: usize,
    pub held_events: usize,
    pub unwanted_events: usize,
    pub predicted_zero_yield_requests: usize,
    pub requests_received: BTreeMap<(String, String), (bool, BTreeSet<String>)>,
    pub closes: usize,
    pub wanted: BTreeSet<String>,
    pub held: BTreeSet<String>,
    pub wire_seen: BTreeSet<String>,
    pub screens: BTreeMap<String, Option<u64>>,
    pub expected: BTreeMap<String, BTreeSet<String>>,
    pub rows: BTreeMap<String, BTreeSet<String>>,
}
impl Stats {
    pub fn event(&mut self, relay: &str, sub: &str, event: &NostrEvent, bytes: usize) {
        if self.wanted.contains(&event.id)
            && !self.held.contains(&event.id)
            && let Some((_, received)) = self.requests_received.get_mut(&(relay.into(), sub.into()))
        {
            received.insert(event.id.clone());
        }
        self.bytes_in += bytes;
        self.wire_events += 1;
        if !self.wire_seen.insert(event.id.clone()) {
            self.duplicates += 1;
        }
        if self.held.contains(&event.id) {
            self.held_events += 1;
        }
        if !self.wanted.contains(&event.id) {
            self.unwanted_events += 1;
        }
    }
    pub fn output(&mut self, engine: &mut Engine, elapsed: u64) {
        for o in engine.drain() {
            match o {
                Output::Rows { sub, items, .. } => {
                    self.rows
                        .insert(sub, items.into_iter().map(|r| r.id).collect());
                }
                Output::Patch { sub, ops, .. } => {
                    for op in ops {
                        match op {
                            Patch::Upsert { item, .. } => {
                                self.rows.entry(sub.clone()).or_default().insert(item.id);
                            }
                            Patch::Remove { id } => {
                                self.rows.entry(sub.clone()).or_default().remove(&id);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        for (sub, ids) in &self.expected {
            if !ids.is_empty() && self.rows.get(sub).is_some_and(|rows| ids.is_subset(rows)) {
                self.screens
                    .entry(sub.clone())
                    .or_default()
                    .get_or_insert(elapsed);
            }
        }
    }
    pub fn report(&self, store: &Store) -> Value {
        let obtained = self
            .wanted
            .iter()
            .filter(|id| store.get(id).is_some())
            .count();
        let new = self
            .wanted
            .difference(&self.held)
            .filter(|id| store.get(id).is_some())
            .count();
        let ratio = |n: usize| {
            if new > 0 {
                Some(n as f64 / new as f64)
            } else {
                None
            }
        };
        let complete = self.screens.values().copied().collect::<Option<Vec<_>>>();
        json!({"schema":"lkjstr-read-score-1","mode":"native-actual-engine-effects",
            "recall":{"obtained":obtained,"wanted":self.wanted.len(),
                "ratio":obtained as f64 / self.wanted.len() as f64,"universeKnown":true},
            "metrics":{"wantedNew":new,"requests":self.requests,"connections":self.connections,
                "maxConnections":self.max_connections,"wireEvents":self.wire_events,
                "duplicateWireEvents":self.duplicates,"heldWireEvents":self.held_events,
                "unwantedWireEvents":self.unwanted_events,"wastedRequests":self.requests_received.values().filter(|(done,ids)|*done&&ids.is_empty()).count(),
                "unansweredRequests":self.requests_received.values().filter(|(done,_)|!*done).count(),
                "predictedZeroYieldRequests":self.predicted_zero_yield_requests,
                "bytesIn":self.bytes_in,"bytesOut":self.bytes_out,"closes":self.closes,
                "requestsPerWantedNew":ratio(self.requests),"connectionsPerWantedNew":ratio(self.connections),
                "duplicatesPerWantedNew":ratio(self.duplicates),"bytesPerWantedNew":ratio(self.bytes_in+self.bytes_out)},
            "firstScreenMs":self.screens.get("home").copied().flatten(),
            "visibleCompleteMs":complete.and_then(|v| v.into_iter().max()),
            "screens":self.screens,"measurement":"simulated relay clock; actual signed wire frames, verification, store and rendered Engine outputs; no browser paint claim"})
    }
}
