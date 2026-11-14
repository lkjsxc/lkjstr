//! Relay heuristics learned on the client: latency, success, yield and
//! freshness feed a score; failures back off with jittered exponential delay.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

const BACKOFF_BASE_MS: f64 = 2_000.0;
const BACKOFF_MAX_MS: f64 = 300_000.0;
const LATENCY_ALPHA: f64 = 0.3;
const FRESH_MS: f64 = 3_600_000.0;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RelayStats {
    /// Smoothed time from REQ to first answer (event or EOSE).
    pub latency_ms: Option<f64>,
    pub connects: u32,
    pub connect_failures: u32,
    pub consecutive_failures: u32,
    pub reqs: u32,
    pub answered: u32,
    pub refused: u32,
    pub events: u64,
    pub new_events: u64,
    pub last_event_ms: u64,
    pub backoff_until_ms: u64,
    pub auth_required: bool,
}

impl RelayStats {
    pub fn usable(&self, now_ms: u64) -> bool {
        now_ms >= self.backoff_until_ms
    }

    /// 0..=1; unknown relays start in the middle so they get tried.
    pub fn score(&self, now_ms: u64) -> f64 {
        if !self.usable(now_ms) {
            return 0.0;
        }
        let laplace = |good: f64, total: f64| (good + 1.0) / (total + 2.0);
        let answered = laplace(f64::from(self.answered), f64::from(self.reqs));
        let connected = laplace(
            f64::from(self.connects.saturating_sub(self.connect_failures)),
            f64::from(self.connects),
        );
        let speed = self.latency_ms.map_or(0.5, |ms| 1.0 / (1.0 + ms / 800.0));
        let useful = laplace(self.new_events as f64, self.events as f64);
        let age = now_ms.saturating_sub(self.last_event_ms) as f64;
        let fresh = if self.last_event_ms == 0 {
            0.3
        } else {
            (-age / FRESH_MS).exp()
        };
        let auth = if self.auth_required { 0.5 } else { 1.0 };
        auth * (0.35 * answered * connected + 0.3 * speed + 0.2 * useful + 0.15 * fresh)
    }

    pub fn on_connect(&mut self) {
        self.connects += 1;
        self.consecutive_failures = 0;
    }

    /// Records a failure and schedules the next attempt. `jitter` is in 0..1.
    pub fn on_failure(&mut self, now_ms: u64, jitter: f64) {
        self.connects += 1;
        self.connect_failures += 1;
        self.consecutive_failures = self.consecutive_failures.saturating_add(1);
        self.backoff_until_ms = now_ms + backoff_ms(self.consecutive_failures, jitter);
    }

    pub fn on_answer(&mut self, latency_ms: f64) {
        self.answered += 1;
        self.latency_ms = Some(match self.latency_ms {
            Some(old) => old + LATENCY_ALPHA * (latency_ms - old),
            None => latency_ms,
        });
    }

    /// No answer in time: counts as slow so the planner hedges elsewhere.
    pub fn on_timeout(&mut self, waited_ms: f64) {
        self.on_answer(waited_ms * 2.0);
        self.answered = self.answered.saturating_sub(1);
    }

    pub fn on_event(&mut self, now_ms: u64, was_new: bool) {
        self.events += 1;
        if was_new {
            self.new_events += 1;
        }
        self.last_event_ms = now_ms;
    }
}

/// Equal-jitter exponential backoff: half fixed, half random.
pub fn backoff_ms(failures: u32, jitter: f64) -> u64 {
    let exp = BACKOFF_BASE_MS * 2f64.powi(failures.saturating_sub(1).min(16) as i32);
    let cap = exp.min(BACKOFF_MAX_MS);
    (cap * (0.5 + jitter.clamp(0.0, 1.0) / 2.0)) as u64
}

/// Scores for every relay ever used, keyed by normalized URL.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Scores {
    pub relays: BTreeMap<String, RelayStats>,
}

impl Scores {
    pub fn get(&self, url: &str) -> RelayStats {
        self.relays.get(url).cloned().unwrap_or_default()
    }

    pub fn entry(&mut self, url: &str) -> &mut RelayStats {
        self.relays.entry(url.to_owned()).or_default()
    }

    pub fn usable(&self, url: &str, now_ms: u64) -> bool {
        self.relays
            .get(url)
            .is_none_or(|stats| stats.usable(now_ms))
    }

    /// `urls` ordered best first, unusable ones dropped, ties kept stable.
    pub fn rank(&self, urls: &[String], now_ms: u64) -> Vec<String> {
        let mut scored: Vec<(f64, usize, &String)> = urls
            .iter()
            .enumerate()
            .filter(|(_, url)| self.usable(url, now_ms))
            .map(|(index, url)| (self.get(url).score(now_ms), index, url))
            .collect();
        scored.sort_by(|a, b| {
            b.0.partial_cmp(&a.0)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.1.cmp(&b.1))
        });
        scored.into_iter().map(|(_, _, url)| url.clone()).collect()
    }
}
