use super::config::ScanSpanConfig;
use super::cursor::ScanDirection;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanModelScope {
    Exact,
    RouteGroup,
    RelayFilter,
    SurfaceFilter,
    Surface,
    Global,
    Neutral,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanModelKey {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirection,
    pub route_fingerprint: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ScanDensityModel {
    pub key: ScanModelKey,
    pub scope: ScanModelScope,
    pub density_events_per_second: f64,
    pub log_density_mean: f64,
    pub log_density_variance: f64,
    pub sample_weight: f64,
    pub complete_window_count: u64,
    pub dense_window_count: u64,
    pub sparse_window_count: u64,
    pub incomplete_window_count: u64,
    pub failure_window_count: u64,
    pub limit_hit_rate: f64,
    pub incomplete_rate: f64,
    pub last_good_span_seconds: u64,
    pub last_proposed_span_seconds: u64,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn decayed_sample_weight(
    model: &ScanDensityModel,
    now_ms: u64,
    config: &ScanSpanConfig,
) -> f64 {
    if config.stale_half_life_seconds == 0 || now_ms <= model.updated_at_ms {
        return model.sample_weight.max(0.0);
    }
    let age_seconds = now_ms.saturating_sub(model.updated_at_ms) as f64 / 1000.0;
    let half_lives = age_seconds / config.stale_half_life_seconds as f64;
    model.sample_weight.max(0.0) * 0.5_f64.powf(half_lives)
}

#[must_use]
pub fn empty_scan_density_model(key: ScanModelKey, scope: ScanModelScope) -> ScanDensityModel {
    ScanDensityModel {
        key,
        scope,
        density_events_per_second: 0.0,
        log_density_mean: 0.0,
        log_density_variance: 0.0,
        sample_weight: 0.0,
        complete_window_count: 0,
        dense_window_count: 0,
        sparse_window_count: 0,
        incomplete_window_count: 0,
        failure_window_count: 0,
        limit_hit_rate: 0.0,
        incomplete_rate: 0.0,
        last_good_span_seconds: 0,
        last_proposed_span_seconds: 0,
        updated_at_ms: 0,
    }
}
