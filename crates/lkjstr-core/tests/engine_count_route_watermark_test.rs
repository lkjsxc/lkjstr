//! Slot pressure may rotate counts without replaying verified history.
#![allow(clippy::expect_used)]
mod engine_count_route_support;
use engine_count_route_support::{Case, START, targets, verified};
use serde_json::json;

#[test]
fn profile_slot_preemption_keeps_verified_count_watermark() {
    let mut c = Case::new(targets(), true);
    let expected = c.expected_since();
    let replay = c.profile_rotation(9, START + 2_000);
    assert!(
        !replay.is_empty(),
        "counts resume after finite profile hydration"
    );
    assert!(replay.iter().all(|(_, f)| f[2]["since"] == json!(expected)));
}
#[test]
fn raw_eose_never_grants_a_count_watermark_before_verification() {
    let mut c = Case::new(targets(), false);
    let unknown = c.profile_rotation(9, START + 2_000);
    assert!(
        !unknown.is_empty(),
        "unverified count stream may retry its original span"
    );
    assert!(unknown.iter().all(|(_, f)| f[2].get("since").is_none()));
    for relay in [engine_count_route_support::A, engine_count_route_support::B] {
        for event in &c.events {
            verified(&mut c.n, &mut c.store, relay, event, START + 4_000);
        }
    }
    c.n.verifying = false;
    // An EOSE for the resumed request restores its active observation before rotation.
    for (relay, req) in unknown {
        engine_count_route_support::eose(&mut c.n, &relay, &req, START + 4_001);
    }
    let expected = c.expected_since();
    let replay = c.profile_rotation(10, START + 5_000);
    assert!(
        !replay.is_empty(),
        "validated count stream resumes after the next finite profile"
    );
    assert!(replay.iter().all(|(_, f)| f[2]["since"] == json!(expected)));
}
