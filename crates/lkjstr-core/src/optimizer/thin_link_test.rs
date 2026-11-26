#![allow(clippy::expect_used)]
use super::{
    features::Features,
    link::{DEFAULT_BPS, Hint, Link},
    plan_policy::decide,
};

#[test]
fn thin_hint_is_a_bounded_prior_without_fabricated_samples() {
    let mut link = Link::default();
    assert!(!link.ready());
    for value in [None, Some("4g"), Some("unknown")] {
        link.set_hint(Hint::from_effective_type(value));
        assert!(!link.ready());
        assert_eq!(link.state().throughput_bps, DEFAULT_BPS);
    }
    for value in ["2g", "slow-2g"] {
        link.set_hint(Hint::from_effective_type(Some(value)));
        assert!(link.ready());
        assert_eq!(link.state().samples, 0);
        assert_eq!(link.state().throughput_bps, 6_250);
        assert_eq!(link.state().rtt_ms, 1_500);
        let plan = decide(Features::default(), link.state(), &[], link.ready());
        assert_eq!(plan.limit, 8);
        assert_eq!(plan.fanout, 2);
        assert_eq!(plan.hedge_delay_ms, 3_000);
        assert_eq!(plan.author_chunk, 400);
        assert_eq!(plan.prefetch_depth, 0);
    }
    // Sparse verified delivery need not leave a verification backlog.
    for second in 0..8 {
        link.observe_bucket(second, 6_250, false);
    }
    assert_eq!(link.state().samples, 0);
    assert_eq!(link.state().throughput_bps, 6_250);
    link.set_hint(None);
    assert!(!link.ready());
    assert_eq!(link.state().throughput_bps, DEFAULT_BPS);
}

#[test]
fn third_generation_hint_yields_to_real_capacity_and_can_be_cleared() {
    let mut link = Link::default();
    link.set_hint(Hint::from_effective_type(Some("3g")));
    assert_eq!(link.state().throughput_bps, 75_000);
    assert_eq!(link.state().rtt_ms, 500);
    let plan = decide(Features::default(), link.state(), &[], link.ready());
    assert_eq!(plan.limit, 20);
    assert_eq!(plan.author_chunk, 400);
    assert_eq!(plan.prefetch_depth, 0);
    for second in 0..4 {
        link.observe_bucket(second, 100_000, true);
    }
    assert_eq!(link.state().throughput_bps, 100_000);
    link.set_hint(Hint::from_effective_type(Some("4g")));
    assert!(link.ready());
    assert_eq!(link.state().samples, 4);
    assert_eq!(link.state().throughput_bps, 100_000);
}

#[test]
fn real_low_capacity_samples_are_not_rounded_up_to_128_kbit() {
    let mut link = Link::default();
    for second in 0..4 {
        link.observe_bucket(second, 6_250, true);
        link.observe_bucket(second, 90_000, true);
    }
    assert!(link.ready());
    assert_eq!(link.state().samples, 4);
    assert_eq!(link.state().throughput_bps, 6_250);
    assert_eq!(
        decide(Features::default(), link.state(), &[], link.ready()).limit,
        8
    );
}
