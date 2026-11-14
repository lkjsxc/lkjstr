//! Pure, bounded-memory relay estimates and scheduler decisions.
use crate::{Error, Result};

/// Exponentially decayed sufficient statistics (constant-size state).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct RelayStats {
    /// Last sample time, Unix seconds.
    pub updated_at: u64,
    /// Decayed number of samples.
    pub weight: f64,
    /// Decayed successful requests.
    pub successes: f64,
    /// Decayed latency sum, milliseconds (successful requests only).
    pub latency_sum: f64,
    /// Decayed event yield per request, each sample capped at 1000.
    pub yield_sum: f64,
    /// Last successful request time.
    pub last_success: Option<u64>,
}
/// A host observation; no runtime clock is read.
#[derive(Clone, Copy, Debug)]
pub struct Sample {
    /// Unix seconds.
    pub at: u64,
    /// Request completed successfully.
    pub success: bool,
    /// Finite, nonnegative latency in milliseconds.
    pub latency_ms: f64,
    /// Distinct relevant events returned, not raw wire event count.
    pub events: u32,
}
fn valid(stats: &RelayStats) -> bool {
    [
        stats.weight,
        stats.successes,
        stats.latency_sum,
        stats.yield_sum,
    ]
    .iter()
    .all(|v| v.is_finite() && *v >= 0.0)
        && stats.successes <= stats.weight
        && stats.last_success.is_none_or(|t| t <= stats.updated_at)
}
/// Decay by half-life in seconds. Backward clock samples are rejected.
pub fn observe(stats: RelayStats, sample: Sample, half_life: f64) -> Result<RelayStats> {
    if !valid(&stats)
        || sample.at < stats.updated_at
        || !half_life.is_finite()
        || half_life <= 0.0
        || !sample.latency_ms.is_finite()
        || sample.latency_ms < 0.0
    {
        return Err(Error::Invalid);
    }
    let decay = (-((sample.at - stats.updated_at) as f64) / half_life).exp2();
    let success = f64::from(sample.success);
    let result = RelayStats {
        updated_at: sample.at,
        weight: stats.weight * decay + 1.0,
        successes: stats.successes * decay + success,
        latency_sum: stats.latency_sum * decay + sample.latency_ms.min(3_600_000.0) * success,
        yield_sum: stats.yield_sum * decay + f64::from(sample.events.min(1000)) * success,
        last_success: if sample.success {
            Some(sample.at)
        } else {
            stats.last_success
        },
    };
    if !valid(&result) {
        return Err(Error::Invalid);
    }
    Ok(result)
}
/// Score in `[0,1]`, with neutral priors and exponential freshness decay.
/// Success (45%), latency (25%), useful yield (20%), freshness (10%).
pub fn score(stats: &RelayStats, now: u64, half_life: f64) -> Result<f64> {
    if !valid(stats) || now < stats.updated_at || !half_life.is_finite() || half_life <= 0.0 {
        return Err(Error::Invalid);
    }
    let decay = (-((now - stats.updated_at) as f64) / half_life).exp2();
    let weight = stats.weight * decay;
    let success = stats.successes * decay;
    let reliability = (success + 1.0) / (weight + 2.0);
    let latency = (success + 1.0) / (success + 1.0 + stats.latency_sum * decay / 500.0);
    let yields = stats.yield_sum * decay;
    let useful = (yields + 1.0) / (yields + weight + 2.0);
    let freshness = stats
        .last_success
        .map_or(0.0, |t| (-((now - t) as f64) / half_life).exp2());
    Ok((0.45 * reliability + 0.25 * latency + 0.20 * useful + 0.10 * freshness).clamp(0.0, 1.0))
}
/// Start a hedge only after a latency budget, within a concurrency cap, and
/// when a candidate has a useful finite score. Caller owns cancellation.
pub fn should_hedge(
    elapsed_ms: u64,
    expected_ms: f64,
    active: usize,
    max_active: usize,
    candidate_score: f64,
) -> bool {
    active > 0
        && active < max_active
        && expected_ms.is_finite()
        && expected_ms >= 0.0
        && candidate_score.is_finite()
        && candidate_score >= 0.25
        && elapsed_ms as f64 >= (expected_ms * 1.5).max(100.0)
}
/// Capped exponential backoff with caller-supplied deterministic full jitter.
/// `failures == 0` has no delay. `jitter` is clamped to `[0,1]` (NaN: 0.5).
pub fn backoff_ms(failures: u32, base_ms: u64, cap_ms: u64, jitter: f64) -> u64 {
    if failures == 0 {
        return 0;
    }
    let multiplier = 1u64 << failures.saturating_sub(1).min(63);
    let ceiling = base_ms.saturating_mul(multiplier).min(cap_ms);
    let fraction = if jitter.is_finite() {
        jitter.clamp(0.0, 1.0)
    } else {
        0.5
    };
    ((ceiling as f64 * fraction) as u64).min(ceiling)
}
