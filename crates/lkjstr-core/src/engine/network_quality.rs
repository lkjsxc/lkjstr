//! Durable observations: <=64 normalized URLs, seven-day lifetime, hourly decay.
//! Deadlines persist as remaining durations, never as process-clock timestamps.
use super::*;
use serde::{Deserialize, Serialize};
const HOUR: u64 = 3_600_000;
#[derive(Clone, Default, Serialize, Deserialize)]
pub(super) struct Observation {
    at: u64,
    useful: u64,
    received: u64,
    latency: Option<u64>,
    #[serde(default)]
    first_event: Option<u64>,
    #[serde(default)]
    timeouts: u32,
    failures: u32,
    retry: u64,
    cooldown: u64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    metadata: Vec<metadata::Stamp>,
}
impl Relay {
    pub fn quality_weight(&self, now: u64) -> u64 {
        let age = (now.saturating_sub(self.quality_at) / HOUR).min(32) as u32;
        read_plan::weight(
            self.useful.saturating_add(self.prior_useful >> age),
            self.received.saturating_add(self.prior_received >> age),
            match (self.first_event_ms, self.latency_ms) {
                (Some(first), Some(eose)) => Some((first.saturating_mul(3) + eose) / 4),
                (first, eose) => first.or(eose),
            },
            self.failures.saturating_add(self.timeouts),
            (!self.online && !self.connecting && now < self.retry_at) || now < self.cooldown_until,
            self.last_error
                .as_deref()
                .is_some_and(|s| s.starts_with("auth-required:")),
        )
    }
}
impl Network {
    pub(super) fn remember_quality(&mut self, now: u64) {
        self.observations = serde_json::from_str(&self.quality_json(now)).unwrap_or_default();
    }
    pub fn quality_json(&self, now: u64) -> String {
        let mut observations = self.observations.clone();
        observations.retain(|_, o| now.saturating_sub(o.at) < 7 * 24 * HOUR);
        for (url, r) in &self.relays {
            let age = (now.saturating_sub(r.quality_at) / HOUR).min(32) as u32;
            observations.insert(
                url.clone(),
                Observation {
                    at: now,
                    useful: r
                        .useful
                        .saturating_add(r.prior_useful >> age)
                        .min(1_000_000),
                    received: r
                        .received
                        .saturating_add(r.prior_received >> age)
                        .min(1_000_000),
                    latency: r.latency_ms.map(|v| v.min(120000)),
                    first_event: r.first_event_ms.map(|v| v.min(120000)),
                    timeouts: r.timeouts.min(8),
                    failures: r.failures.min(8),
                    retry: if r.online || r.connecting {
                        0
                    } else {
                        r.retry_at.saturating_sub(now).min(120000)
                    },
                    cooldown: r.cooldown_until.saturating_sub(now).min(120000),
                    metadata: Vec::new(),
                },
            );
        }
        while observations.len() > 64 {
            let oldest = observations
                .iter()
                .min_by_key(|(u, o)| (self.relays.contains_key(*u), o.at))
                .map(|(u, _)| u.clone());
            if let Some(url) = oldest {
                observations.remove(&url);
            }
        }
        for observation in observations.values_mut() {
            observation.metadata.clear();
        }
        if let Some(first) = observations.values_mut().next() {
            first.metadata = self.metadata.snapshot(now);
        }
        serde_json::to_string(&observations).unwrap_or_default()
    }
    pub fn restore_quality(&mut self, text: &str, now: u64) {
        if text.len() > 256 * 1024 {
            return;
        }
        let Ok(saved) = serde_json::from_str::<BTreeMap<String, Observation>>(text) else {
            return;
        };
        self.observations = saved
            .into_iter()
            .filter(|(url, o)| {
                url.len() <= 2048
                    && crate::engine::settings::strict_relay(url).as_ref() == Some(url)
                    && now.saturating_sub(o.at) < 7 * 24 * HOUR
            })
            .take(64)
            .collect();
        self.metadata.restore(
            self.observations.values().flat_map(|o| o.metadata.iter()),
            now,
        );
        for url in self.relays.keys().cloned().collect::<Vec<_>>() {
            self.apply_quality(&url, now);
        }
    }
    pub(super) fn apply_quality(&mut self, url: &str, now: u64) {
        let Some(o) = self.observations.get(url) else {
            return;
        };
        let Some(r) = self.relays.get_mut(url) else {
            return;
        };
        let elapsed = now.saturating_sub(o.at);
        let age = (elapsed / HOUR).min(32) as u32;
        r.prior_useful = o.useful.min(o.received).min(1_000_000) >> age;
        r.prior_received = o.received.min(1_000_000) >> age;
        r.quality_at = now;
        r.latency_ms = (age < 24).then_some(o.latency).flatten();
        r.first_event_ms = (age < 24).then_some(o.first_event).flatten();
        r.timeouts = o.timeouts.min(8) >> age.min(8);
        r.failures = o.failures.min(8) >> age.min(8);
        r.retry_at = now.saturating_add(o.retry.min(120000).saturating_sub(elapsed));
        r.cooldown_until = now.saturating_add(o.cooldown.min(120000).saturating_sub(elapsed));
        if r.cooldown_until > now {
            r.last_error = Some("rate-limited: cooldown".into());
        }
    }
    pub(super) fn publication_priority(
        &self,
        url: &str,
        now: u64,
    ) -> (bool, std::cmp::Reverse<u64>) {
        if let Some(relay) = self.relays.get(url) {
            let blocked = now < relay.cooldown_until
                || (!relay.online && !relay.connecting && now < relay.retry_at);
            return (blocked, std::cmp::Reverse(relay.quality_weight(now)));
        }
        let Some(observation) = self.observations.get(url) else {
            return (false, std::cmp::Reverse(600));
        };
        let age = now.saturating_sub(observation.at);
        let blocked = age < observation.retry.max(observation.cooldown);
        let weight = read_plan::weight(
            observation.useful,
            observation.received,
            observation.first_event.or(observation.latency),
            observation.failures.saturating_add(observation.timeouts),
            blocked,
            false,
        );
        (blocked, std::cmp::Reverse(weight))
    }

    /// A relay that rate-limits an EVENT also rests from posts; a read cooldown alone never does.
    pub(super) fn cool_down_writes(&mut self, url: &str, now: u64) {
        self.cool_down(url, now);
        if let Some(r) = self.relays.get_mut(url) {
            r.write_cooldown_until = r.cooldown_until;
        }
    }
    pub(super) fn cool_down(&mut self, url: &str, now: u64) {
        if let Some(r) = self.relays.get_mut(url) {
            r.failures = r.failures.saturating_add(1).min(8);
            r.cooldown_until = now.saturating_add((15000u64 << r.failures.min(3)).min(120000));
            r.next_req_at = r.next_req_at.max(r.cooldown_until);
            r.last_error = Some("rate-limited: cooldown".into());
            self.quality_revision = self.quality_revision.wrapping_add(1);
        }
    }
}
/// First useful arrivals receive credit, duplicate volume does not. Small
/// samples have a neutral prior; latency, failures and refusal reduce quality.
/// Callers retain cooling routes when no alternatives exist, so retry recovers.
pub fn weight(
    useful: u64,
    received: u64,
    latency_ms: Option<u64>,
    failures: u32,
    cooling: bool,
    refused: bool,
) -> u64 {
    if cooling {
        return 0;
    }
    let yield_score = 400u64.saturating_mul(useful.min(received).saturating_add(1))
        / received.saturating_add(2).max(1);
    let speed = 400_000 / latency_ms.unwrap_or(1000).saturating_add(1000);
    let quality = (200 + yield_score + speed) / (1 + u64::from(failures.min(8)));
    if refused { quality / 4 } else { quality }
}

pub(super) fn limited(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("rate-limit")
        || lower.contains("too many requests")
        || lower.contains("slow down")
}
