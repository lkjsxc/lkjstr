pub const DEFAULT_INITIAL_SPAN_SECONDS: u64 = 60;
pub const DEFAULT_MIN_SPAN_SECONDS: u64 = 1;
pub const DEFAULT_MAX_SPAN_SECONDS: u64 = 180 * 24 * 60 * 60;
pub const DEFAULT_HINT_TTL_SECONDS: u64 = 7 * 24 * 60 * 60;
pub const DEFAULT_STALE_HALF_LIFE_SECONDS: u64 = 7 * 24 * 60 * 60;
pub const DEFAULT_TARGET_LIMIT_NUMERATOR: u32 = 2;
pub const DEFAULT_TARGET_LIMIT_DENOMINATOR: u32 = 3;
pub const DEFAULT_MAX_SINGLE_CHANGE_FACTOR: f64 = 4.0;
pub const DEFAULT_MINIMUM_DENSITY_PER_SECOND: f64 = 0.000_001;

#[derive(Clone, Debug, PartialEq)]
pub struct ScanSpanConfig {
    pub min_span_seconds: u64,
    pub max_span_seconds: u64,
    pub neutral_span_seconds: u64,
    pub target_limit_numerator: u32,
    pub target_limit_denominator: u32,
    pub max_single_change_factor: f64,
    pub stale_half_life_seconds: u64,
    pub minimum_density_per_second: f64,
}

impl Default for ScanSpanConfig {
    fn default() -> Self {
        Self {
            min_span_seconds: DEFAULT_MIN_SPAN_SECONDS,
            max_span_seconds: DEFAULT_MAX_SPAN_SECONDS,
            neutral_span_seconds: DEFAULT_INITIAL_SPAN_SECONDS,
            target_limit_numerator: DEFAULT_TARGET_LIMIT_NUMERATOR,
            target_limit_denominator: DEFAULT_TARGET_LIMIT_DENOMINATOR,
            max_single_change_factor: DEFAULT_MAX_SINGLE_CHANGE_FACTOR,
            stale_half_life_seconds: DEFAULT_STALE_HALF_LIFE_SECONDS,
            minimum_density_per_second: DEFAULT_MINIMUM_DENSITY_PER_SECOND,
        }
    }
}

impl ScanSpanConfig {
    #[must_use]
    pub fn target_count(&self, effective_limit: u16) -> u16 {
        let denominator = self.target_limit_denominator.max(1) as u64;
        let raw =
            (u64::from(effective_limit) * u64::from(self.target_limit_numerator)) / denominator;
        raw.clamp(1, u64::from(u16::MAX)) as u16
    }

    #[must_use]
    pub fn bounded_span(&self, seconds: u64) -> u64 {
        seconds.clamp(self.min_span_seconds, self.max_span_seconds)
    }

    #[must_use]
    pub fn safe_change_factor(&self) -> f64 {
        if self.max_single_change_factor.is_finite() && self.max_single_change_factor >= 1.0 {
            self.max_single_change_factor
        } else {
            DEFAULT_MAX_SINGLE_CHANGE_FACTOR
        }
    }
}
