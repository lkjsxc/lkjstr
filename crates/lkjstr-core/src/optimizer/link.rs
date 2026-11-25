//! Throughput samples require queued work. Completed seconds are counted once.
use serde::Serialize;

pub const DEFAULT_BPS: u64 = 3_000_000;
pub const DEFAULT_RTT_MS: u64 = 80;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkState {
    pub throughput_bps: u64,
    pub rtt_ms: u64,
    pub saturated: bool,
    pub samples: u32,
}

impl Default for LinkState {
    fn default() -> Self {
        Self {
            throughput_bps: DEFAULT_BPS,
            rtt_ms: DEFAULT_RTT_MS,
            saturated: false,
            samples: 0,
        }
    }
}

#[derive(Default)]
pub struct Link {
    estimate: u64,
    rtt: Option<u64>,
    samples: u32,
    epoch: Option<u64>,
    last_busy_seconds: [u64; 3],
}

impl Link {
    pub fn observe_bucket(&mut self, second: u64, bytes: u64, queue_busy: bool) {
        if self.epoch.is_some_and(|previous| second <= previous) {
            return;
        }
        self.epoch = Some(second);
        self.last_busy_seconds[(second % 3) as usize] = if queue_busy { bytes } else { 0 };
        if queue_busy && bytes != 0 {
            let bytes = bytes.clamp(16_000, 1_000_000_000);
            self.estimate = if self.samples == 0 {
                bytes
            } else {
                (self.estimate * 7 + bytes) / 8
            };
            self.samples = self.samples.saturating_add(1);
        }
    }

    pub fn observe_rtt(&mut self, ms: u64) {
        let ms = ms.clamp(1, 6000);
        self.rtt = Some(self.rtt.map_or(ms, |old| (old * 7 + ms) / 8));
    }

    pub fn has_rtt(&self) -> bool {
        self.rtt.is_some()
    }

    pub fn state(&self) -> LinkState {
        let throughput_bps = if self.samples >= 4 {
            self.estimate
        } else {
            DEFAULT_BPS
        };
        let saturated = self.last_busy_seconds.iter().sum::<u64>() * 100 >= throughput_bps * 3 * 85;
        LinkState {
            throughput_bps,
            rtt_ms: self.rtt.unwrap_or(DEFAULT_RTT_MS),
            saturated,
            samples: self.samples,
        }
    }
}

pub fn cost_ms(link: LinkState, bytes: u64, reqs: u64, new_tls: u64, retry_ms: u64) -> u64 {
    (bytes.saturating_mul(1000)).div_ceil(link.throughput_bps.max(1))
        + (reqs + 3 * new_tls) * link.rtt_ms
        + retry_ms
}
