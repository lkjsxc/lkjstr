//! Count bucket normalization must not discard an unchanged reader or watermark.
#![allow(clippy::expect_used)]
mod engine_count_route_support;
use engine_count_route_support::{
    A, B, C, Case, START, counts, frames, prefer_c, requests, targets,
};
use serde_json::json;

fn stable_under_quality(mut ids: Vec<String>, permute: bool) {
    let mut c = Case::new(ids.clone(), true);
    if permute {
        ids.rotate_left(1);
        c.filter.tags.insert("e".into(), ids);
    }
    prefer_c(&mut c.n);
    let effects = c.replan(START + 2_000);
    assert!(
        effects
            .iter()
            .all(|(_, frame)| frame[0] != "CLOSE" && !counts(frame)),
        "same target membership must retain healthy count acquisition"
    );
    assert!(
        !c.n.relays[C].connecting,
        "normalization must not acquire a third route"
    );
    assert_eq!(c.n.request_progress("feed"), (2, 2));
    let expected = c.expected_since();
    let replay = c.reconnect_a(START + 3_000);
    assert!(
        replay
            .iter()
            .any(|(relay, f)| relay == A && counts(f) && f[2]["since"] == json!(expected)),
        "the retained reader resumes verified traffic"
    );
}
#[test]
fn reversed_count_targets_keep_healthy_routes_and_watermark() {
    let mut ids = targets();
    ids.reverse();
    stable_under_quality(ids, false);
}
#[test]
fn permuted_unchanged_count_targets_keep_healthy_routes_and_watermark() {
    stable_under_quality(targets(), true);
}
#[test]
fn sorted_count_targets_are_a_stable_control() {
    stable_under_quality(targets(), false);
}
#[test]
fn changed_target_membership_acquires_new_targets_without_old_cursor() {
    let mut c = Case::new(targets(), true);
    let removed = c.filter.tags["e"][0].clone();
    let added = format!("{:064x}", 4);
    c.filter.tags.get_mut("e").expect("count targets")[0] = added.clone();
    let mut effects = c.replan(START + 2_000);
    for relay in [A, B, C] {
        if c.n.relays[relay].connecting {
            c.n.connected(relay, START + 2_001);
        }
    }
    c.n.tick(START + 2_100);
    effects.extend(frames(&mut c.n));
    let acquired: Vec<_> = requests(&effects)
        .into_iter()
        .filter(|(_, f)| counts(f))
        .collect();
    assert!(
        !acquired.is_empty(),
        "real target changes must create acquisition"
    );
    for (_, req) in acquired {
        let ids = req[2]["#e"].as_array().expect("target array");
        assert!(ids.contains(&json!(added)));
        assert!(!ids.contains(&json!(removed)));
        assert!(
            req[2].get("since").is_none(),
            "new target cannot inherit unrelated history"
        );
    }
}
#[test]
fn read_permission_and_view_release_still_revoke_count_routes() {
    let mut c = Case::new(targets(), true);
    c.n.known.get_mut(A).expect("configured reader").read = false;
    let mut effects = c.replan(START + 2_000);
    assert!(
        effects
            .iter()
            .any(|(relay, f)| relay == A && f[0] == "CLOSE")
    );
    assert!(
        c.n.relays[C].connecting,
        "permitted fallback replaces removed read permission"
    );
    c.n.connected(C, START + 2_001);
    c.n.tick(START + 2_100);
    effects.extend(frames(&mut c.n));
    assert!(
        requests(&effects)
            .iter()
            .any(|(relay, f)| relay == C && counts(f))
    );
    c.n.plan(vec![], &c.store, START + 3_000);
    assert_eq!(c.n.request_progress("feed"), (0, 0));
    assert!(
        frames(&mut c.n)
            .iter()
            .any(|(relay, f)| [B, C].contains(&relay.as_str()) && f[0] == "CLOSE")
    );
}
