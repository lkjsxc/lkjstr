//! Accounting over emitted and delivered protocol frames, never estimated payloads.
use super::{
    fixture::{Fixture, START},
    witness::canonical,
};
use lkjstr_core::engine::Engine;
use lkjstr_protocol::{NostrEvent, NostrFilter, filter_to_value};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Default)]
struct Request {
    new_wanted: usize,
    eose: bool,
    cancelled: bool,
}
#[derive(Default)]
pub struct Metrics {
    pub requests: usize,
    pub logical_filters: usize,
    pub connects: usize,
    pub inspections: usize,
    pub disconnects: usize,
    pub bytes_out: usize,
    pub bytes_in: usize,
    pub event_bytes_in: usize,
    pub wire_events: usize,
    pub duplicate_wire_events: usize,
    pub cached_wire_events: usize,
    pub rejected_frames: usize,
    pub cancelled_frames: usize,
    pub peak_sockets: usize,
    pub peak_subscriptions: usize,
    pub first_ready: BTreeMap<String, u64>,
    seen_wire: BTreeSet<String>,
    accepted_wanted: BTreeSet<String>,
    logical_keys: BTreeSet<(String, String)>,
    sockets: BTreeSet<String>,
    connection_urls: BTreeSet<String>,
    request_records: BTreeMap<(String, String), Request>,
    by_relay: BTreeMap<String, usize>,
}
impl Metrics {
    pub fn connect(&mut self, relay: &str) {
        self.connects += 1;
        self.connection_urls.insert(relay.into());
        self.sockets.insert(relay.into());
        self.peak_sockets = self.peak_sockets.max(self.sockets.len());
    }
    pub fn disconnect(&mut self, relay: &str) {
        self.disconnects += 1;
        self.sockets.remove(relay);
    }
    pub fn request(&mut self, relay: &str, wire: &str, filters: &[NostrFilter]) {
        self.requests += 1;
        self.logical_filters += filters.len();
        *self.by_relay.entry(relay.into()).or_default() += 1;
        self.request_records
            .insert((relay.into(), wire.into()), Request::default());
        for filter in filters {
            let mut normalized = filter.clone();
            canonical(&mut normalized);
            self.logical_keys
                .insert((relay.into(), filter_to_value(&normalized).to_string()));
        }
    }
    pub fn close(&mut self, relay: &str, wire: &str) {
        if let Some(request) = self.request_records.get_mut(&(relay.into(), wire.into())) {
            request.cancelled = !request.eose;
        }
    }
    pub fn delivered(
        &mut self,
        relay: &str,
        wire: &str,
        text: &str,
        value: &Value,
        event: Option<&NostrEvent>,
        fixture: &Fixture,
    ) {
        self.bytes_in += text.len();
        let request = self.request_records.get_mut(&(relay.into(), wire.into()));
        if value[0] == "EOSE" {
            if let Some(request) = request {
                request.eose = true;
            }
        } else if value[0] == "EVENT" {
            self.wire_events += 1;
            self.event_bytes_in += text.len();
            let id = value[2]["id"].as_str().unwrap_or("");
            let fresh = self.seen_wire.insert(id.into());
            if !fresh {
                self.duplicate_wire_events += 1;
            }
            if fixture.context.iter().any(|e| e.id == id) {
                self.cached_wire_events += 1;
            }
            if fixture.wanted.contains(id)
                && event.is_some()
                && self.accepted_wanted.insert(id.into())
                && let Some(request) = request
            {
                request.new_wanted += 1;
            }
            if event.is_none() {
                self.rejected_frames += 1;
            }
        }
    }
    pub fn observe(&mut self, engine: &Engine, fixture: &Fixture, now: u64) {
        self.peak_subscriptions = self
            .peak_subscriptions
            .max(engine.network.open_wires().values().sum());
        for (name, ids) in &fixture.screens {
            if !ids.is_empty() && ids.iter().all(|id| engine.store.get(id).is_some()) {
                self.first_ready
                    .entry(name.clone())
                    .or_insert(now.saturating_sub(START));
            }
        }
    }
    pub fn counters(&self) -> Value {
        json!({"requests":self.requests, "logicalFilters":self.logical_filters,
            "bytesIn":self.bytes_in, "bytesOut":self.bytes_out,
            "wireEvents":self.wire_events, "duplicateWireEvents":self.duplicate_wire_events})
    }
    pub fn finish(&self, engine: &Engine, fixture: &Fixture) -> Value {
        let obtained = fixture
            .wanted
            .iter()
            .filter(|id| engine.store.get(id).is_some())
            .count();
        let ratio = |value: usize| (obtained > 0).then(|| value as f64 / obtained as f64);
        let per_want: BTreeMap<_, _> = fixture
            .eligible
            .iter()
            .map(|(name, ids)| {
                let found = ids
                    .iter()
                    .filter(|id| engine.store.get(id).is_some())
                    .count();
                (
                    name,
                    json!({"wanted":ids.len(), "obtained":found,
                "firstScreenTarget":fixture.screens[name].len(),
                "firstScreenVerifiedReadySimulatedMs":self.first_ready.get(name)}),
                )
            })
            .collect();
        let all_ready = (self.first_ready.len() == fixture.screens.len())
            .then(|| self.first_ready.values().copied().max())
            .flatten();
        json!({
            "wantedNewEvents":fixture.wanted.len(), "obtainedWantedNewEvents":obtained,
            "recall":obtained as f64 / fixture.wanted.len().max(1) as f64,
            "requests":self.requests, "logicalFiltersSent":self.logical_filters,
            "distinctRelayFiltersAsked":self.logical_keys.len(),
            "repeatEquivalentRelayFiltersAsked":self.logical_filters.saturating_sub(self.logical_keys.len()),
            "connectAttempts":self.connects, "distinctConnectedRelays":self.connection_urls.len(),
            "peakSockets":self.peak_sockets, "peakSubscriptions":self.peak_subscriptions,
            "relayInformationInspections":self.inspections, "disconnects":self.disconnects,
            "wireEvents":self.wire_events, "duplicateWireEvents":self.duplicate_wire_events,
            "cachedWireEvents":self.cached_wire_events,
            "bytesIn":self.bytes_in, "eventBytesIn":self.event_bytes_in, "bytesOut":self.bytes_out,
            "requestsPerObtainedWantedNewEvent":ratio(self.requests),
            "connectionsPerObtainedWantedNewEvent":ratio(self.connects),
            "duplicatesPerObtainedWantedNewEvent":ratio(self.duplicate_wire_events),
            "zeroNewWantedRequests":self.request_records.values().filter(|r| r.new_wanted == 0).count(),
            "completedZeroNewWantedRequests":self.request_records.values()
                .filter(|r| r.eose && r.new_wanted == 0).count(),
            "cancelledBeforeEoseRequests":self.request_records.values().filter(|r| r.cancelled).count(),
            "protocolRejectedEvents":self.rejected_frames,
            "responsesCancelledBeforeDelivery":self.cancelled_frames,
            "verificationRejectedEvents":engine.rejected, "verificationQueueDrops":engine.dropped,
            "firstScreenVerifiedReadySimulatedMs":all_ready, "firstPaintMs":Value::Null,
            "perWant":per_want, "requestsByRelay":self.by_relay
        })
    }
}
