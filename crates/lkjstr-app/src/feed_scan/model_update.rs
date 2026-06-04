use super::config::ScanSpanConfig;
use super::hierarchy::{ScanModelContext, scan_model_key_for_scope};
use super::model::{ScanDensityModel, ScanModelKey, ScanModelScope, empty_scan_density_model};
use super::observation::ScanSegmentObservation;

#[must_use]
pub fn update_scan_density_model(
    previous: Option<&ScanDensityModel>,
    observation: &ScanSegmentObservation,
    scope: ScanModelScope,
    config: &ScanSpanConfig,
) -> ScanDensityModel {
    let density = observation.observed_density_events_per_second();
    let weight = observation_weight(observation);
    let key = key_from_observation(observation, &scope);
    let prior = previous
        .cloned()
        .unwrap_or_else(|| empty_scan_density_model(key, scope.clone()));
    let next_density = blended_density(&prior, density, weight, config);
    let counts = next_counts(&prior, observation, config);
    ScanDensityModel {
        key: prior.key.clone(),
        scope,
        density_events_per_second: next_density,
        log_density_mean: safe_log(next_density, config),
        log_density_variance: log_variance(&prior, next_density, density, weight, config),
        sample_weight: prior.sample_weight + weight,
        complete_window_count: counts.complete,
        dense_window_count: counts.dense,
        sparse_window_count: counts.sparse,
        incomplete_window_count: counts.incomplete,
        failure_window_count: counts.failure,
        limit_hit_rate: rate(counts.dense, counts.total()),
        incomplete_rate: rate(counts.incomplete, counts.total()),
        last_good_span_seconds: last_good_span(&prior, observation),
        last_proposed_span_seconds: observation.span_seconds(),
        updated_at_ms: observation.completed_at_ms,
    }
}

#[must_use]
pub fn scan_model_from_observation(
    observation: &ScanSegmentObservation,
    scope: ScanModelScope,
    config: &ScanSpanConfig,
) -> ScanDensityModel {
    update_scan_density_model(None, observation, scope, config)
}

fn key_from_observation(
    observation: &ScanSegmentObservation,
    scope: &ScanModelScope,
) -> ScanModelKey {
    scan_model_key_for_scope(
        &ScanModelContext {
            semantic_feed_key: observation.semantic_feed_key.clone(),
            route_group_key: observation.route_group_key.clone(),
            relay_url: observation.relay_url.clone(),
            semantic_filter_key: observation.semantic_filter_key.clone(),
            direction: observation.direction.clone(),
            route_fingerprint: observation.route_fingerprint.clone(),
        },
        scope,
    )
}

fn blended_density(
    prior: &ScanDensityModel,
    density: Option<f64>,
    weight: f64,
    config: &ScanSpanConfig,
) -> f64 {
    let Some(observed) = density else {
        return prior.density_events_per_second;
    };
    let total = prior.sample_weight + weight;
    let blended = if total <= 0.0 {
        observed.max(0.0)
    } else {
        ((prior.density_events_per_second * prior.sample_weight) + (observed.max(0.0) * weight))
            / total
    };
    blended.max(config.minimum_density_per_second)
}

fn observation_weight(observation: &ScanSegmentObservation) -> f64 {
    if observation.event_limit_reached || observation.is_complete() {
        1.0
    } else if observation.observed_density_events_per_second().is_some() {
        0.25
    } else {
        0.0
    }
}

struct WindowCounts {
    complete: u64,
    dense: u64,
    sparse: u64,
    incomplete: u64,
    failure: u64,
}

impl WindowCounts {
    fn total(&self) -> u64 {
        self.complete + self.dense + self.incomplete
    }
}

fn next_counts(
    prior: &ScanDensityModel,
    observation: &ScanSegmentObservation,
    config: &ScanSpanConfig,
) -> WindowCounts {
    let target = config.target_count(observation.effective_limit);
    WindowCounts {
        complete: prior.complete_window_count + count_if(observation.is_complete()),
        dense: prior.dense_window_count + count_if(observation.event_limit_reached),
        sparse: prior.sparse_window_count + sparse_increment(observation, target),
        incomplete: prior.incomplete_window_count + count_if(observation.is_incomplete()),
        failure: prior.failure_window_count + count_if(observation.is_failure()),
    }
}

fn sparse_increment(observation: &ScanSegmentObservation, target_count: u16) -> u64 {
    count_if(observation.is_complete() && observation.final_visible_count < target_count)
}

fn count_if(value: bool) -> u64 {
    if value { 1 } else { 0 }
}

fn last_good_span(prior: &ScanDensityModel, observation: &ScanSegmentObservation) -> u64 {
    if observation.is_complete() {
        observation.span_seconds()
    } else {
        prior.last_good_span_seconds
    }
}

fn log_variance(
    prior: &ScanDensityModel,
    next_density: f64,
    density: Option<f64>,
    weight: f64,
    config: &ScanSpanConfig,
) -> f64 {
    let Some(observed) = density else {
        return prior.log_density_variance;
    };
    let delta = safe_log(observed, config) - safe_log(next_density, config);
    ((prior.log_density_variance * prior.sample_weight) + (delta * delta * weight))
        / (prior.sample_weight + weight).max(1.0)
}

fn safe_log(density: f64, config: &ScanSpanConfig) -> f64 {
    density.max(config.minimum_density_per_second).ln()
}

fn rate(count: u64, total: u64) -> f64 {
    if total == 0 {
        0.0
    } else {
        count as f64 / total as f64
    }
}
