//! Throughput samples require queued work. Completed seconds are counted once.
pub const DEFAULT_BPS: u64 = 3_000_000;
pub const DEFAULT_RTT_MS: u64 = 80;

// Browser hints are bounded scheduling priors, never observations or authority.
#[derive(Clone, Copy, Debug, serde::Serialize, serde::Deserialize)]
pub enum Hint {
    VeryThin,
    Thin,
}

impl Hint {
    pub fn from_effective_type(value: Option<&str>) -> Option<Self> {
        match value {
            Some("slow-2g" | "2g") => Some(Self::VeryThin),
            Some("3g") => Some(Self::Thin),
            _ => None,
        }
    }

    fn estimates(self) -> (u64, u64) {
        match self {
            Self::VeryThin => (6_250, 1_500),
            Self::Thin => (75_000, 500),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LinkState {
    pub throughput_bps: u64,
    pub rtt_ms: u64,
    pub saturated: bool,
    pub samples: u32,
}

impl LinkState {
    pub fn thin(self) -> bool {
        self.throughput_bps <= 75_000
    }

    pub fn very_thin(self) -> bool {
        self.throughput_bps < 16_000
    }
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
    hint: Option<Hint>,
    rtt: Option<u64>,
    samples: u32,
    epoch: Option<u64>,
    last_busy_seconds: [u64; 3],
}

impl Link {
    pub fn set_hint(&mut self, hint: Option<Hint>) {
        self.hint = hint;
    }

    pub fn ready(&self) -> bool {
        self.samples >= 4 || self.hint.is_some()
    }

    pub fn observe_bucket(&mut self, second: u64, bytes: u64, queue_busy: bool) {
        if self.epoch.is_some_and(|previous| second <= previous) {
            return;
        }
        self.epoch = Some(second);
        self.last_busy_seconds[(second % 3) as usize] = if queue_busy { bytes } else { 0 };
        if queue_busy && bytes != 0 {
            let bytes = bytes.clamp(1_000, 1_000_000_000);
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

    /// Scheduling may use a bounded browser prior before observations are sufficient.
    pub fn state(&self) -> LinkState {
        self.snapshot(self.hint)
    }

    /// Retention costs use measured state only, never a browser scheduling hint.
    pub fn observed_state(&self) -> LinkState {
        self.snapshot(None)
    }

    fn snapshot(&self, hint: Option<Hint>) -> LinkState {
        let throughput_bps = if self.samples >= 4 {
            self.estimate
        } else {
            hint.map_or(DEFAULT_BPS, |hint| hint.estimates().0)
        };
        let saturated = self.last_busy_seconds.iter().sum::<u64>() * 100 >= throughput_bps * 3 * 85;
        LinkState {
            throughput_bps,
            rtt_ms: self
                .rtt
                .unwrap_or(DEFAULT_RTT_MS)
                .max(hint.map_or(0, |hint| hint.estimates().1)),
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
