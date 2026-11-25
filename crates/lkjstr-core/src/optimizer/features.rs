//! Quantized inputs. Route indexes are session-local and contain no identities.
#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
pub struct Interaction {
    pub since_scroll: Option<u16>,
    pub since_input: Option<u16>,
    pub scroll_rate: u8,
}

impl Interaction {
    pub fn new(scroll: Option<f64>, input: Option<f64>, scroll_rate: Option<f64>) -> Self {
        let bucket = |ms: Option<f64>| {
            ms.filter(|ms| ms.is_finite() && *ms >= 0.0)
                .map(|ms| (ms as u64).checked_ilog2().unwrap_or(0) as u16)
        };
        Self {
            since_scroll: bucket(scroll),
            since_input: bucket(input),
            scroll_rate: scroll_rate.unwrap_or(0.0).round().clamp(0.0, 255.0) as u8,
        }
    }

    pub fn active(self) -> bool {
        self.since_input.is_some_and(|age| age <= 7)
            || (self.scroll_rate >= 8 && self.since_scroll.is_some_and(|age| age <= 9))
    }
}

#[derive(Clone, Copy)]
pub struct Features {
    pub focused: bool,
    pub visible: bool,
    pub hidden: bool,
    pub offline: bool,
    pub save_data: bool,
    pub awaiting_ok: bool,
    pub interaction: Interaction,
    /// L0 explicit, L1 first screen, L2 next screen, L3 speculative.
    pub lane: usize,
    pub avg_event_bytes: u64,
    pub relay_limit: u64,
    pub profile: bool,
}

impl Default for Features {
    fn default() -> Self {
        Self {
            focused: false,
            visible: true,
            hidden: false,
            offline: false,
            save_data: false,
            awaiting_ok: false,
            interaction: Interaction::default(),
            lane: 1,
            avg_event_bytes: 1100,
            relay_limit: 200,
            profile: false,
        }
    }
}

#[derive(Clone, Copy, Default)]
pub struct Route {
    pub index: usize,
    pub useful_per_mille: Option<u16>,
    pub first_event_p75_ms: Option<u64>,
    pub eose_ms: Option<u64>,
    pub cooldown: bool,
    pub closed_recent: bool,
    pub online: bool,
}

/// One bounded timing window per active relay. Cold cells return no percentile.
#[derive(Default)]
pub(crate) struct Timing {
    samples: [u16; 32],
    next: usize,
    len: usize,
}

impl Timing {
    pub fn observe(&mut self, ms: u64) {
        self.samples[self.next] = ms.clamp(1, u16::MAX.into()) as u16;
        self.next = (self.next + 1) % self.samples.len();
        self.len = (self.len + 1).min(self.samples.len());
    }

    pub fn p75(&self) -> Option<u64> {
        if self.len < 16 {
            return None;
        }
        let mut values = self.samples;
        values[..self.len].sort_unstable();
        Some(values[(self.len * 3).div_ceil(4) - 1].into())
    }
}
