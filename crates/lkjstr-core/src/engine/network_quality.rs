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
    failures: u32,
    retry: u64,
    cooldown: u64,
}
impl Relay {
    pub fn quality_weight(&self, now: u64) -> u64 {
        let age = (now.saturating_sub(self.quality_at) / HOUR).min(32) as u32;
        read_plan::weight(
            self.useful.saturating_add(self.prior_useful >> age),
            self.received.saturating_add(self.prior_received >> age),
            self.latency_ms,
            self.failures,
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
                    failures: r.failures.min(8),
                    retry: if r.online || r.connecting {
                        0
                    } else {
                        r.retry_at.saturating_sub(now).min(120000)
                    },
                    cooldown: r.cooldown_until.saturating_sub(now).min(120000),
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
        r.failures = o.failures.min(8) >> age.min(8);
        r.retry_at = now.saturating_add(o.retry.min(120000).saturating_sub(elapsed));
        r.cooldown_until = now.saturating_add(o.cooldown.min(120000).saturating_sub(elapsed));
        if r.cooldown_until > now {
            r.last_error = Some("rate-limited: cooldown".into());
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
pub(super) fn limited(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("rate-limit")
        || lower.contains("too many requests")
        || lower.contains("slow down")
}
