//! One failed physical count bucket must not be hidden by another answered bucket.
#![allow(clippy::expect_used)]
mod engine_count_route_support;
use engine_count_route_support::{A, B, C, START, counts, eose, filter, frames, requests};
use lkjstr_core::{
    engine::{network::Network, protocol::Query},
    store::Store,
};
use serde_json::json;
use std::collections::BTreeSet;

#[test]
fn failed_required_bucket_releases_an_ordinary_slot_without_discarding_healthy_counts() {
    let ids: Vec<_> = (1..=121).map(|index| format!("{index:064x}")).collect();
    let affected: BTreeSet<_> = ids.iter().step_by(2).cloned().collect();
    let wants = vec![
        (
            "left".into(),
            filter(ids.iter().step_by(2).cloned().collect()),
            Query::default(),
        ),
        (
            "right".into(),
            filter(ids.iter().skip(1).step_by(2).cloned().collect()),
            Query::default(),
        ),
    ];
    let mut network = Network::default();
    let store = Store::new(1000);
    network.configure(vec![A.into(), B.into(), C.into()], START);
    network.plan(wants.clone(), &store, START);
    network.connected(A, START + 1);
    network.connected(B, START + 1);
    network.tick(START + 100);
    network.tick(START + 200);
    let initial = requests(&frames(&mut network));
    assert_eq!(initial.len(), 4);
    let mut failed = None;
    for (relay, request) in &initial {
        if relay == B && request[2]["#e"].as_array().expect("targets").len() == 1 {
            network.message(
                relay,
                &json!(["CLOSED", request[1], "error: failed bounded page"]).to_string(),
                START + 250,
            );
            failed = Some(request.clone());
        } else {
            eose(&mut network, relay, request, START + 250);
        }
    }
    assert!(
        failed.is_some(),
        "the second physical bucket is the deliberate failure"
    );
    frames(&mut network);
    network.plan(wants, &store, START + 2_000);
    let mut effects = frames(&mut network);
    let replacing = network.relays[C].connecting;
    if replacing {
        network.connected(C, START + 2_001);
    }
    network.tick(START + 2_100);
    network.tick(START + 2_200);
    effects.extend(frames(&mut network));
    let replacement: Vec<_> = requests(&effects)
        .into_iter()
        .filter(|(relay, request)| relay == C && counts(request))
        .collect();
    let replacement_requests = replacement.len();
    let requested: BTreeSet<_> = replacement
        .iter()
        .flat_map(|(_, request)| {
            request[2]["#e"]
                .as_array()
                .expect("replacement targets")
                .iter()
                .map(|id| id.as_str().expect("target id").to_owned())
        })
        .collect();
    println!(
        "count-route failed_required_bucket replacement_requested={replacing} replacement_requests={replacement_requests}"
    );
    assert!(
        replacing,
        "a failed bucket must not borrow another bucket's successful completion"
    );
    assert_eq!(
        replacement_requests, 1,
        "only the affected logical subset needs a replacement reader"
    );
    assert_eq!(
        requested, affected,
        "the replacement covers its affected subset"
    );
    assert!(
        !effects
            .iter()
            .any(|(relay, frame)| relay == A && (frame[0] == "CLOSE" || counts(frame))),
        "the healthy ordinary reader keeps its physical count requests"
    );
}
