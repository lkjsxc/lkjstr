//! Session counters and stage-safe relay labels for the orchestration view.
use serde::Serialize;
use std::{collections::VecDeque, net::Ipv4Addr};
use url::{Host, Url};

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
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Decision {
    at_ms: u64,
    kind: Kind,
    #[serde(skip_serializing_if = "Option::is_none")]
    relay: Option<String>,
    summary: &'static str,
}

pub(super) struct Telemetry {
    // One slot for each of the last 60 aligned seconds, regardless of query frequency.
    bandwidth: [Option<Bucket>; SECONDS],
    // Last 32 decisions, with only stage-safe relay labels and fixed summaries.
    pub decisions: VecDeque<Decision>,
    // Last 256 distinct auth-gated origins, even if a connection is retired.
    auth: VecDeque<String>,
}
impl Default for Telemetry {
    fn default() -> Self {
        Self {
            bandwidth: [None; SECONDS],
            decisions: VecDeque::new(),
            auth: VecDeque::new(),
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

    pub fn bandwidth(&self, now: u64) -> Vec<Bucket> {
        let second = now / 1000;
        let first = second.saturating_sub(SECONDS as u64 - 1);
        (first..=second)
            .map(|second| {
                let at_ms = second * 1000;
                self.bandwidth[(second % SECONDS as u64) as usize]
                    .filter(|bucket| bucket.at_ms == at_ms)
                    .unwrap_or(Bucket {
                        at_ms,
                        ..Bucket::default()
                    })
            })
            .collect()
    }

    pub fn decision(&mut self, at_ms: u64, kind: Kind, relay: Option<String>) {
        let summary = match kind {
            Kind::Hedge => "Added a parallel read route after a slow start",
            Kind::Coalesce => "Shared a relay request across logical reads",
            Kind::Cooldown => "Paused relay requests after a rate limit",
            Kind::Fallback => "Used an alternate relay route",
            Kind::Evict => "Reclaimed a relay request slot",
            Kind::PublishOk => "Relay accepted a publication",
        };
        if self.decisions.len() == EVENTS {
            self.decisions.pop_front();
        }
        self.decisions.push_back(Decision {
            at_ms,
            kind,
            relay,
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

pub(super) fn relay_url(raw: &str) -> Option<Url> {
    let mut url = Url::parse(raw).ok()?;
    if !matches!(url.scheme(), "ws" | "wss") || !url.has_host() {
        return None;
    }
    url.set_username("").ok()?;
    url.set_password(None).ok()?;
    url.set_query(None);
    url.set_fragment(None);
    Some(url)
}

pub(super) fn relay_label(raw: &str) -> String {
    relay_url(raw).map_or_else(|| "private-relay".into(), |url| url.into())
}

fn origin(url: &Url) -> String {
    url.origin().ascii_serialization()
}

fn private_host(host: Option<Host<&str>>) -> bool {
    match host {
        Some(Host::Ipv4(ip)) => private_v4(ip),
        Some(Host::Ipv6(ip)) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.to_ipv4_mapped().is_some_and(private_v4)
        }
        Some(Host::Domain(name)) => {
            let name = name.trim_end_matches('.');
            name == "localhost"
                || name.ends_with(".localhost")
                || name.ends_with(".local")
                || name.ends_with(".onion")
        }
        None => true,
    }
}

fn private_v4(ip: Ipv4Addr) -> bool {
    ip.is_loopback() || ip.is_private() || ip.is_link_local() || ip.is_unspecified()
}

/// Relay responses can echo arbitrary event fields or credentials.
pub(super) fn relay_error(value: &str) -> &'static str {
    match value {
        "connection-lost" => "connection-lost",
        "read-timeout" => "read-timeout",
        "rate-limited: cooldown" => "rate-limited: cooldown",
        "capacity" => "capacity",
        _ if value.starts_with("auth-required:") => "auth-required",
        _ => "relay-error",
    }
}
