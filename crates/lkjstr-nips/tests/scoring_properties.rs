#![allow(clippy::unwrap_used)]
use lkjstr_nips::scoring::{self, RelayStats, Sample};

fn sample(at: u64, success: bool, latency_ms: f64, events: u32) -> Sample {
    Sample {
        at,
        success,
        latency_ms,
        events,
    }
}
#[test]
fn generated_histories_keep_finite_scores_and_bounded_scheduler_decisions() {
    for seed in 0u64..64 {
        let mut state = seed + 1;
        let mut stats = RelayStats::default();
        for step in 1..100 {
            state = state
                .wrapping_mul(2862933555777941757)
                .wrapping_add(3037000493);
            stats = scoring::observe(
                stats,
                sample(
                    step * 30,
                    state & 1 == 0,
                    (state % 5000) as f64,
                    (state % 10000) as u32,
                ),
                3600.0,
            )
            .unwrap();
            for age in [0, 1, 3600, 100000] {
                let score = scoring::score(&stats, step * 30 + age, 3600.0).unwrap();
                assert!(score.is_finite() && (0.0..=1.0).contains(&score));
            }
            assert!(stats.successes <= stats.weight);
            for failures in [0, 1, 2, 32, 64, u32::MAX] {
                let delay =
                    scoring::backoff_ms(failures, 100, 30000, (state % 1000) as f64 / 1000.0);
                assert!(delay <= 30000);
            }
        }
    }
}
#[test]
fn latency_reliability_yield_and_freshness_have_expected_ordering() {
    let empty = RelayStats::default();
    let good = scoring::observe(empty, sample(100, true, 50.0, 10), 100.0).unwrap();
    let slow = scoring::observe(empty, sample(100, true, 1000.0, 10), 100.0).unwrap();
    let failure = scoring::observe(empty, sample(100, false, 50.0, 0), 100.0).unwrap();
    let low_yield = scoring::observe(empty, sample(100, true, 50.0, 1), 100.0).unwrap();
    let score = |s| scoring::score(&s, 100, 100.0).unwrap();
    assert!(score(good) > score(slow));
    assert!(score(good) > score(failure));
    assert!(score(good) > score(low_yield));
    assert!(score(good) > scoring::score(&good, 200, 100.0).unwrap());
    let newer = scoring::observe(good, sample(200, false, 10.0, 0), 100.0).unwrap();
    assert!((newer.weight - 1.5).abs() < 1e-12);
    assert!((newer.successes - 0.5).abs() < 1e-12);
    assert!((newer.latency_sum - 25.0).abs() < 1e-12);
}
#[test]
fn reject_nan_invalid_clocks_and_invalid_stats() {
    for invalid in [0.0, -1.0, f64::NAN, f64::INFINITY] {
        assert!(scoring::observe(RelayStats::default(), sample(1, true, 1.0, 1), invalid).is_err());
        assert!(scoring::score(&RelayStats::default(), 1, invalid).is_err());
    }
    for latency in [-1.0, f64::NAN, f64::INFINITY] {
        assert!(scoring::observe(RelayStats::default(), sample(1, true, latency, 1), 1.0).is_err());
    }
    let s = scoring::observe(RelayStats::default(), sample(10, true, 1.0, 1), 1.0).unwrap();
    assert!(scoring::observe(s, sample(9, true, 1.0, 1), 1.0).is_err());
    assert!(scoring::score(&s, 9, 1.0).is_err());
    let invalid = RelayStats {
        weight: f64::NAN,
        ..s
    };
    assert!(scoring::score(&invalid, 10, 1.0).is_err());
}
#[test]
fn backoff_saturates_and_hedging_respects_capacity_and_latency() {
    let mut previous = 0;
    for failures in 0..100 {
        let delay = scoring::backoff_ms(failures, 100, 30000, 1.0);
        assert!(delay >= previous && delay <= 30000);
        previous = delay;
    }
    assert_eq!(scoring::backoff_ms(u32::MAX, u64::MAX, 42, 1.0), 42);
    assert_eq!(scoring::backoff_ms(1, 100, 1000, 0.0), 0);
    assert_eq!(scoring::backoff_ms(1, 100, 1000, f64::NAN), 50);
    assert!(!scoring::should_hedge(149, 100.0, 1, 2, 0.9));
    assert!(scoring::should_hedge(150, 100.0, 1, 2, 0.9));
    assert!(!scoring::should_hedge(1000, 100.0, 2, 2, 0.9));
    assert!(!scoring::should_hedge(1000, 100.0, 0, 2, 0.9));
    assert!(!scoring::should_hedge(1000, 100.0, 1, 2, 0.1));
    assert!(!scoring::should_hedge(1000, f64::NAN, 1, 2, 0.9));
}
