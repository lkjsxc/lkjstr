//! Cross-view count buckets must not lose healthy readers when partitioned at 120.
#![allow(clippy::expect_used)]
mod engine_count_route_support;
use engine_count_route_support::{
    A, B, C, Frame, START, counts, eose, filter, prefer_c, requests, verified,
};
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{EventTemplate, finalize_event, parse_secret_key_hex};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

type Active = BTreeMap<(String, String), Value>;
fn capture(n: &mut Network, active: &mut Active) -> Vec<Frame> {
    let mut frames = Vec::new();
    for effect in n.drain_effects() {
        match effect {
            Effect::Send(relay, raw) => {
                let frame: Value = serde_json::from_str(&raw).expect("synthetic frame");
                if frame[0] == "REQ" || frame[0] == "CLOSE" {
                    let id = frame[1].as_str().expect("wire id").to_owned();
                    let key = (relay.clone(), id);
                    if frame[0] == "REQ" {
                        active.insert(key, frame.clone());
                    } else {
                        active.remove(&key);
                    }
                }
                frames.push((relay, frame));
            }
            Effect::Disconnect(relay) => active.retain(|(url, _), _| url != &relay),
            _ => {}
        }
    }
    frames
}

#[derive(Debug)]
struct Outcome {
    targets: usize,
    stable_readers: bool,
    one_view_release_exact: bool,
    reopened_requests: usize,
    replayed_events: usize,
    replayed_bytes: usize,
}
fn exercise(size: usize) -> Outcome {
    let ids: Vec<_> = (1..=size).map(|i| format!("{i:064x}")).collect();
    let left = filter(ids.iter().step_by(2).cloned().collect());
    let right = filter(ids.iter().skip(1).step_by(2).cloned().collect());
    assert!(left.tags["e"].len() <= 120 && right.tags["e"].len() <= 120);
    let wants = vec![
        ("left".into(), left, Query::default()),
        ("right".into(), right.clone(), Query::default()),
    ];
    let mut n = Network::default();
    let mut active = Active::new();
    let mut store = Store::new(1000);
    n.configure(vec![A.into(), B.into(), C.into()], START);
    n.plan(wants.clone(), &store, START);
    n.connected(A, START + 1);
    n.connected(B, START + 1);
    n.tick(START + 100);
    n.tick(START + 200);
    let initial = requests(&capture(&mut n, &mut active));
    assert_eq!(
        initial.len(),
        4,
        "two readers each acquire two bounded buckets"
    );
    let expected: Vec<Vec<String>> = ids.chunks(120).map(|chunk| chunk.to_vec()).collect();
    for relay in [A, B] {
        let mut actual: Vec<Vec<String>> = initial
            .iter()
            .filter(|(url, _)| url == relay)
            .map(|(_, req)| {
                req[2]["#e"]
                    .as_array()
                    .expect("physical target bucket")
                    .iter()
                    .map(|id| id.as_str().expect("target id").to_owned())
                    .collect()
            })
            .collect();
        actual.sort();
        assert_eq!(actual, expected, "{relay} must coalesce the view targets");
    }
    let mut retained_events = BTreeMap::new();
    let key = parse_secret_key_hex(&"08".repeat(32)).expect("synthetic fixture key");
    for (relay, req) in initial {
        assert!(counts(&req));
        let targets = req[2]["#e"].as_array().expect("physical target bucket");
        assert!(targets.len() <= 120);
        let target = targets[0].as_str().expect("target id").to_owned();
        let event = finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: START / 1000 - 10,
                kind: 7,
                content: "+".into(),
                tags: vec![vec!["e".into(), target]],
            },
            &key,
        )
        .expect("signed fixture");
        assert!(
            n.message(
                &relay,
                &json!(["EVENT", req[1], event]).to_string(),
                START + 250
            )
            .is_some()
        );
        retained_events.insert(event.id.clone(), event.clone());
        verified(&mut n, &mut store, &relay, &event, START + 251);
        eose(&mut n, &relay, &req, START + 300);
    }
    assert!(
        capture(&mut n, &mut active).is_empty(),
        "live count EOSE does not close"
    );
    let original_wires = active.clone();
    prefer_c(&mut n);
    n.plan(wants, &store, START + 2_000);
    let mut effects = capture(&mut n, &mut active);
    for relay in [A, B, C] {
        if n.relays[relay].connecting {
            n.connected(relay, START + 2_001);
        }
    }
    n.tick(START + 2_100);
    n.tick(START + 2_200);
    effects.extend(capture(&mut n, &mut active));
    let acquired = requests(&effects);
    let (mut replayed_events, mut replayed_bytes) = (0, 0);
    for (relay, req) in acquired.iter().filter(|(_, req)| counts(req)) {
        let targets = req[2]["#e"].as_array().expect("physical targets");
        for event in retained_events.values().filter(|event| {
            event.tags.iter().any(|tag| {
                tag.first().is_some_and(|key| key == "e")
                    && tag.get(1).is_some_and(|id| targets.contains(&json!(id)))
            })
        }) {
            let frame = json!(["EVENT", req[1], event]).to_string();
            replayed_events += 1;
            replayed_bytes += frame.len();
            assert!(n.message(relay, &frame, START + 2_250).is_some());
            verified(&mut n, &mut store, relay, event, START + 2_251);
        }
        eose(&mut n, relay, req, START + 2_300);
    }
    capture(&mut n, &mut active);
    let stable_readers = !n.relays[C].connecting
        && active == original_wires
        && effects
            .iter()
            .all(|(_, frame)| frame[0] != "CLOSE" && !counts(frame));

    // Repartition after removing just one view: its exclusive targets must go away.
    n.plan(
        vec![("right".into(), right.clone(), Query::default())],
        &store,
        START + 3_000,
    );
    for relay in [A, B, C] {
        if n.relays[relay].connecting {
            n.connected(relay, START + 3_001);
        }
    }
    n.tick(START + 3_100);
    capture(&mut n, &mut active);
    let remaining: Vec<_> = active.values().filter(|frame| counts(frame)).collect();
    let wanted: BTreeSet<_> = right.tags["e"].iter().cloned().collect();
    let remaining_targets: BTreeSet<_> = remaining
        .iter()
        .flat_map(|frame| {
            frame[2]["#e"]
                .as_array()
                .expect("physical targets")
                .iter()
                .map(|id| id.as_str().expect("id").to_owned())
        })
        .collect();
    let one_view_release_exact = !remaining.is_empty()
        && remaining_targets == wanted
        && n.request_progress("left") == (0, 0)
        && remaining
            .iter()
            .all(|f| f[2]["#e"].as_array().expect("targets").len() <= 120);
    n.plan(vec![], &store, START + 4_000);
    capture(&mut n, &mut active);
    assert!(active.is_empty(), "last view closes every physical request");
    assert_eq!(
        n.request_progress("right"),
        (0, 0),
        "last view releases all ownership"
    );
    Outcome {
        targets: size,
        stable_readers,
        one_view_release_exact,
        reopened_requests: acquired.iter().filter(|(_, req)| counts(req)).count(),
        replayed_events,
        replayed_bytes,
    }
}
#[test]
fn coalesced_121_and_240_targets_keep_routes_without_retaining_closed_view_targets() {
    // Complete both sizes before asserting, so a red baseline retains both outcomes.
    let outcomes = [121, 240].map(exercise);
    for row in &outcomes {
        println!(
            "count-route targets={} reopened_requests={} replayed_events={} replayed_bytes={}",
            row.targets, row.reopened_requests, row.replayed_events, row.replayed_bytes
        );
    }
    assert!(
        outcomes.iter().all(|o| o.one_view_release_exact),
        "per-view release control: {outcomes:?}"
    );
    assert!(
        outcomes.iter().all(|o| o.stable_readers
            && o.reopened_requests == 0
            && o.replayed_events == 0
            && o.replayed_bytes == 0),
        "stable coalesced membership: {outcomes:?}"
    );
    assert_eq!(outcomes.map(|o| o.targets), [121, 240]);
}
