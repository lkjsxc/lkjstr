//! Session counters and stage-safe relay labels for the orchestration view.
use serde::Serialize;
use std::{
    cell::RefCell,
    collections::{BTreeMap, VecDeque},
};
use url::Url;

const SECONDS: usize = 60;
const EVENTS: usize = 32;
const AUTH_ORIGINS: usize = 256;

#[derive(Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Bucket {
    pub at_ms: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub events_in: u64,
    pub duplicates: u64,
    pub verified: u64,
    pub reqs_sent: u64,
    pub reqs_coalesced: u64,
    pub hedges_fired: u64,
    pub duplicate_bytes: u64,
    pub queue_busy: bool,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum Kind {
    Hedge,
    Coalesce,
    Cooldown,
    Fallback,
    Evict,
    PublishOk,
    #[allow(dead_code)]
    Trip,
    #[allow(dead_code)]
    Explore,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Decision {
    at_ms: u64,
    kind: Kind,
    #[serde(skip_serializing_if = "Option::is_none")]
    relay: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    view_sub_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    delay_ms: Option<u64>,
    summary: &'static str,
}

pub(super) struct Telemetry {
    // One slot for each of the last 60 aligned seconds, regardless of query frequency.
    bandwidth: [Option<Bucket>; SECONDS],
    // Last 32 decisions, with only stage-safe relay labels and fixed summaries.
    pub decisions: VecDeque<Decision>,
    // Last 256 distinct auth-gated origins, even if a connection is retired.
    auth: VecDeque<String>,
    // Current public views, keyed by internal subscription and replaced each plan.
    pub views: BTreeMap<String, u64>,
    // First 4096 observed routes have a stable index until the Worker stops.
    relay_indexes: RefCell<BTreeMap<String, usize>>,
}
impl Default for Telemetry {
    fn default() -> Self {
        Self {
            bandwidth: [None; SECONDS],
            decisions: VecDeque::new(),
            auth: VecDeque::new(),
            views: BTreeMap::new(),
            relay_indexes: RefCell::default(),
        }
    }
}
impl Telemetry {
    pub fn traffic(&mut self, now: u64, update: impl FnOnce(&mut Bucket)) {
        let second = now / 1000;
        let at_ms = second * 1000;
        let slot = &mut self.bandwidth[(second % SECONDS as u64) as usize];
        if slot.is_some_and(|bucket| bucket.at_ms > at_ms) {
            return;
        }
        if slot.is_none_or(|bucket| bucket.at_ms != at_ms) {
            *slot = Some(Bucket {
                at_ms,
                ..Bucket::default()
            });
        }
        if let Some(bucket) = slot {
            update(bucket);
        }
    }

    pub fn bucket(&self, second: u64) -> Bucket {
        let at_ms = second * 1000;
        self.bandwidth[(second % SECONDS as u64) as usize]
            .filter(|bucket| bucket.at_ms == at_ms)
            .unwrap_or(Bucket {
                at_ms,
                ..Bucket::default()
            })
    }

    pub fn bandwidth(&self, now: u64) -> Vec<Bucket> {
        let second = now / 1000;
        let first = second.saturating_sub(SECONDS as u64 - 1);
        (first..=second).map(|second| self.bucket(second)).collect()
    }

    pub fn member(&self, members: &std::collections::BTreeSet<String>) -> Option<u64> {
        members.iter().find_map(|member| {
            let member = member
                .strip_prefix("~prefetch:")
                .or_else(|| member.strip_prefix("~repair:"))
                .unwrap_or(member);
            let member = super::time_window_relay::view_owner(member).unwrap_or(member);
            self.views.get(member).copied()
        })
    }

    pub fn relay_index(&self, relay: &str) -> Option<usize> {
        let mut indexes = self.relay_indexes.borrow_mut();
        let next = indexes.len();
        indexes.get(relay).copied().or_else(|| {
            (next < 4096).then(|| {
                indexes.insert(relay.into(), next);
                next
            })
        })
    }

    pub fn decision(
        &mut self,
        at_ms: u64,
        kind: Kind,
        relay: Option<String>,
        view: Option<u64>,
        count: Option<usize>,
        delay_ms: Option<u64>,
    ) {
        self.traffic(at_ms, |bucket| match kind {
            Kind::Coalesce => bucket.reqs_coalesced += count.unwrap_or(1) as u64,
            Kind::Hedge => bucket.hedges_fired += 1,
            _ => {}
        });
        let summary = match kind {
            Kind::Hedge => "Added a parallel read route after a slow start",
            Kind::Coalesce => "Shared a relay request across logical reads",
            Kind::Cooldown => "Paused relay requests after a rate limit",
            Kind::Fallback => "Used an alternate relay route",
            Kind::Evict => "Reclaimed a relay request slot",
            Kind::PublishOk => "Relay accepted a publication",
            Kind::Trip => "Optimizer part returned to Stage 1",
            Kind::Explore => "Optimizer tried an alternate hedge route",
        };
        if self.decisions.len() == EVENTS {
            self.decisions.pop_front();
        }
        self.decisions.push_back(Decision {
            at_ms,
            kind,
            relay,
            view_sub_id: view.map(|id| format!("view-{id}")),
            count,
            delay_ms,
            summary,
        });
    }

    pub fn auth_required(&mut self, relay: &str) {
        let Some(url) = relay_url(relay) else { return };
        let label = origin(&url);
        for decision in &mut self.decisions {
            if decision.relay.as_deref() == Some(label.as_str()) {
                decision.relay = Some("private-relay".into());
            }
        }
        self.auth.retain(|old| old != &label);
        if self.auth.len() == AUTH_ORIGINS {
            self.auth.pop_front();
        }
        self.auth.push_back(label);
    }

    pub fn is_private(&self, url: Option<&Url>) -> bool {
        url.is_none_or(|url| {
            private_host(url.host()) || (!self.auth.is_empty() && self.auth.contains(&origin(url)))
        })
    }
}

#[path = "telemetry_relay.rs"]
mod relay;
use relay::{origin, private_host};
pub(super) use relay::{relay_error, relay_url};
