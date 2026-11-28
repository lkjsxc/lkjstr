//! Observe physical request envelopes and admitted public event frames, never filters or bodies.
use super::*;
use crate::engine::fetch_records::{Source, *};
use std::collections::VecDeque;
#[path = "network_fetch_attempts.rs"]
mod attempts;

#[derive(Default)]
pub(super) struct FetchAttempts {
    active: BTreeMap<KeyHash, Attempt>,
    replay: BTreeSet<KeyHash>,
    order: VecDeque<KeyHash>,
}
struct Attempt {
    record: FetchRecord,
    relay: KeyHash,
    pending: usize,
    yielded: bool,
    ended: bool,
}
#[derive(Clone, Copy)]
pub(in crate::engine) struct Receipt {
    record: u64,
    attempt: Option<KeyHash>,
}
impl Request {
    fn observable(&self) -> bool {
        self.visible_in_stats()
            && !self.members.iter().any(|m| m.starts_with("~dm"))
            && self.filter.kinds.as_ref().is_none_or(|ks| {
                !ks.is_empty() && ks.iter().all(|k| ResourceClass::event(*k).is_some())
            })
    }
    fn resource_class(&self) -> ResourceClass {
        if super::scheduler::counts_filter(&self.filter) {
            return ResourceClass::Counts;
        }
        let mut classes = self
            .filter
            .kinds
            .iter()
            .flatten()
            .filter_map(|&k| ResourceClass::event(k));
        let first = classes.next().unwrap_or(ResourceClass::OtherPublic);
        if classes.any(|class| class != first) {
            ResourceClass::Mixed
        } else {
            first
        }
    }
    fn annotate(&self, observer: &Observer, r: &mut FetchRecord) {
        r.lane = match self.purpose {
            "focused" => Lane::L0,
            "visible" | "history" => Lane::L1,
            "prefetch" => Lane::L3,
            _ if self.priority <= 1 => Lane::L1,
            _ => Lane::Unknown,
        };
        r.view = self
            .members
            .iter()
            .find(|m| !m.starts_with('~'))
            .and_then(|m| observer.key(m));
        r.slot = observer.key(self.purpose);
    }
}
fn event_identity(event: &NostrEvent) -> String {
    match event.kind {
        0 | 3 | 10000..=19999 => format!("{}:{}", event.kind, event.pubkey),
        _ => event.id.clone(),
    }
}
impl Network {
    pub(super) fn public_relay(&self, relay: &str) -> bool {
        self.relays.get(relay).is_some_and(|p| !p.auth_required)
    }
    pub(super) fn observe_event_frame(
        &mut self,
        relay: &str,
        wire: &str,
        event: &NostrEvent,
        bytes: usize,
        now: u64,
    ) {
        if !self.public_relay(relay) {
            return;
        }
        let Some(class) = ResourceClass::event(event.kind) else {
            return;
        };
        let Some(r) = self.requests.values().find(|r| {
            r.relay == relay
                && r.wire_id == wire
                && r.sent
                && r.observable()
                && lkjstr_protocol::matches_filter(event, &r.filter)
        }) else {
            return;
        };
        let class = if super::scheduler::counts_filter(&r.filter) {
            ResourceClass::Counts
        } else {
            class
        };
        let Some(mut record) = self.fetches.draft(
            class,
            Scope::Resource,
            &event_identity(event),
            Some(relay),
            now,
        ) else {
            return;
        };
        r.annotate(&self.fetches, &mut record);
        record.connection = Connection::Reused;
        record.start_ms = Some(r.sent_at);
        record.first_byte_ms = Some(now); // Whole-frame delivery is the browser's first observation.
        record.source = Source::Network;
        record.outcome = Outcome::PendingVerification;
        record.wire_bytes = WireBytes::Measured(bytes as u64);
        record.link_ms = link_cost(
            self.optimizer.link.observed_state(),
            record.wire_bytes,
            false,
            record.connection,
        );
        let attempt = self.fetches.key(wire).filter(|key| {
            self.fetch_attempts.active.get_mut(key).is_some_and(|a| {
                if a.ended {
                    return false;
                }
                a.record.first_byte_ms.get_or_insert(now);
                a.pending += 1;
                true
            })
        });
        self.last_fetch = Some(Receipt {
            record: self.fetches.record(record),
            attempt,
        });
    }
    pub(in crate::engine) fn observe_cache_resource(
        &self,
        event: &NostrEvent,
        now: u64,
    ) -> Option<Receipt> {
        let mut record = self.fetches.draft(
            ResourceClass::event(event.kind)?,
            Scope::Resource,
            &event_identity(event),
            None,
            now,
        )?;
        record.source = Source::Indexeddb;
        record.wire_bytes = WireBytes::Measured(0);
        record.link_ms = Some(0);
        record.outcome = Outcome::PendingVerification;
        Some(Receipt {
            record: self.fetches.record(record),
            attempt: None,
        })
    }
    pub(in crate::engine) fn observed_receipt(
        &mut self,
        receipt: Option<Receipt>,
        outcome: Outcome,
        stored_bytes: Option<u64>,
        yielded: bool,
    ) {
        let Some(receipt) = receipt else {
            return;
        };
        self.fetches.finish(receipt.record, outcome, stored_bytes);
        if let Some(key) = receipt.attempt {
            if let Some(a) = self.fetch_attempts.active.get_mut(&key) {
                a.pending = a.pending.saturating_sub(1);
                a.yielded |= yielded;
            }
            self.flush_attempt(key, false);
        }
    }
    pub(super) fn observe_batch_decision(
        &self,
        first: &str,
        candidates: &[(&String, &Request)],
        chosen: &[String],
        now: u64,
    ) {
        if !self.fetches.decisions_enabled() || !self.requests[first].observable() {
            return;
        }
        self.fetches.decision(
            Action::Fetch,
            now,
            std::iter::once((first, Some(self.fetch_weight(&self.requests[first], now)))).chain(
                candidates
                    .iter()
                    .filter(|(_, r)| r.observable())
                    .map(|(key, r)| (key.as_str(), Some(self.fetch_weight(r, now)))),
            ),
            chosen
                .iter()
                .filter(|key| self.requests[*key].observable())
                .map(String::as_str),
        );
    }
    pub(super) fn observe_route_decision(
        &self,
        f: &NostrFilter,
        candidates: &[super::read_plan::Candidate],
        routes: &[String],
        now: u64,
    ) {
        if self.fetches.decisions_enabled() && super::stats_relay::public_filter(f) {
            self.fetches.decision(
                Action::Relay,
                now,
                candidates
                    .iter()
                    .filter(|c| self.relays.get(&c.url).is_some_and(|r| !r.auth_required))
                    .map(|c| (c.url.as_str(), Some(c.weight))),
                routes
                    .iter()
                    .filter(|url| self.relays.get(*url).is_some_and(|r| !r.auth_required))
                    .map(String::as_str),
            );
        }
    }
}

#[cfg(test)]
#[path = "network_fetch_records_test.rs"]
mod tests;
