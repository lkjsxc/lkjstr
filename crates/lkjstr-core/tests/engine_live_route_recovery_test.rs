//! A verified-data route must not recover into permanent empty-reader retirement.
#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, VerificationResult, finalize_event,
    generate_secret_key, verify_event,
};
use serde_json::{Value, json};
use std::collections::BTreeMap;

const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
const C: &str = "wss://c.test/";
const START: u64 = 1_000_000;

fn fixtures() -> [NostrEvent; 3] {
    let key = generate_secret_key();
    [990, 991, 1003].map(|at| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind: 1,
                content: format!("synthetic route continuity {at}"),
                tags: vec![],
            },
            &key,
        )
        .expect("signed fixture")
    })
}
fn frames(n: &mut Network) -> BTreeMap<String, Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|effect| {
            let Effect::Send(url, text) = effect else {
                return None;
            };
            let frame: Value = serde_json::from_str(&text).expect("wire frame");
            (frame[0] == "REQ").then_some((url, frame))
        })
        .collect()
}
fn plan(n: &mut Network, f: &NostrFilter, now: u64) {
    n.plan(
        vec![(
            "home".into(),
            f.clone(),
            Query {
                source: Source::Home,
                ..Default::default()
            },
        )],
        &Store::new(0),
        now,
    );
}
fn accept(n: &mut Network, relay: &str, req: &Value, e: &NostrEvent, now: u64, verified: bool) {
    assert!(
        n.message(relay, &json!(["EVENT", req[1], e]).to_string(), now)
            .is_some()
    );
    if verified {
        assert!(matches!(verify_event(e), VerificationResult::Ok(_)));
        n.observe_verified(relay, e, now);
    }
}
fn eose(n: &mut Network, relay: &str, req: &Value, now: u64) {
    n.message(relay, &json!(["EOSE", req[1]]).to_string(), now);
}
struct Recovery {
    network: Network,
    filter: NostrFilter,
    messages: [NostrEvent; 3],
    fallback: Value,
    recovered: Value,
}
fn recovery(prior_verified: bool, fallback_verified: bool, replay_verified: bool) -> Recovery {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], START);
    let messages = fixtures();
    let f = NostrFilter {
        kinds: Some(vec![1, 6]),
        authors: Some(vec![messages[0].pubkey.clone()]),
        limit: Some(200),
        ..Default::default()
    };
    plan(&mut n, &f, START);
    n.connected(A, START + 1);
    n.connected(B, START + 1);
    let first = frames(&mut n);
    assert_eq!(first.keys().map(String::as_str).collect::<Vec<_>>(), [A, B]);
    eose(&mut n, A, &first[A], START + 2);
    accept(
        &mut n,
        B,
        &first[B],
        &messages[0],
        START + 3,
        prior_verified,
    );
    eose(&mut n, B, &first[B], START + 4);
    plan(&mut n, &f, START + 5);
    frames(&mut n);

    n.disconnected(B, START + 20);
    plan(&mut n, &f, START + 21);
    n.connected(C, START + 22);
    let next = frames(&mut n);
    assert!(
        next.contains_key(C),
        "a permitted fallback takes the failed slot"
    );
    if fallback_verified {
        accept(&mut n, C, &next[C], &messages[1], START + 23, true);
    }
    eose(&mut n, C, &next[C], START + 24);
    plan(&mut n, &f, START + 25);
    frames(&mut n);

    n.connected(B, START + 3000);
    let replay = frames(&mut n);
    assert!(
        replay.contains_key(B),
        "the failed route retains its resumed gap"
    );
    if prior_verified {
        assert_eq!(replay[B][2]["since"], messages[0].created_at - 2);
    }
    accept(
        &mut n,
        B,
        &replay[B],
        &messages[0],
        START + 3001,
        replay_verified,
    );
    eose(&mut n, B, &replay[B], START + 3002);
    Recovery {
        network: n,
        filter: f,
        messages,
        fallback: next[C].clone(),
        recovered: replay[B].clone(),
    }
}
fn is_close(e: &Effect, relay: &str) -> bool {
    matches!(e, Effect::Send(url, text) if url == relay
        && serde_json::from_str::<Value>(text).is_ok_and(|v| v[0] == "CLOSE"))
}
#[test]
fn productive_recovery_keeps_a_slot_when_both_successors_only_answer_empty() {
    let mut s = recovery(true, false, true);
    plan(&mut s.network, &s.filter, START + 3003);
    let effects = s.network.drain_effects();
    let next = s.network.message(
        B,
        &json!(["EVENT", s.recovered[1], s.messages[2]]).to_string(),
        START + 3004,
    );
    assert!(
        next.is_some(),
        "a new unique note on the verified-data recovery was lost: {effects:?}"
    );
    assert_eq!(
        s.network.request_progress("home").0,
        2,
        "promotion does not add a third primary route"
    );
    assert!(!effects.iter().any(|e| is_close(e, B)));
}
#[test]
fn useful_fallback_and_productive_recovery_both_survive_in_two_slots() {
    let mut s = recovery(true, true, true);
    plan(&mut s.network, &s.filter, START + 3003);
    let effects = s.network.drain_effects();
    assert!(
        !effects.iter().any(|e| is_close(e, C)),
        "verified fallback data must retain authority"
    );
    assert!(
        s.network
            .message(
                C,
                &json!(["EVENT", s.fallback[1], s.messages[2]]).to_string(),
                START + 3004
            )
            .is_some()
    );
    assert!(
        s.network
            .message(
                B,
                &json!(["EVENT", s.recovered[1], s.messages[2]]).to_string(),
                START + 3004
            )
            .is_some(),
        "only the empty A route may yield"
    );
    assert_eq!(s.network.request_progress("home").0, 2);
}
#[test]
fn unverified_frames_do_not_promote_a_recovered_route() {
    let mut s = recovery(false, false, false);
    plan(&mut s.network, &s.filter, START + 3003);
    let effects = s.network.drain_effects();
    assert!(effects.iter().any(|e| is_close(e, B)));
    assert!(!effects.iter().any(|e| is_close(e, C)));
    assert_eq!(s.network.request_progress("home").0, 2);
}
#[test]
fn explicit_permission_removal_and_view_close_release_recovery() {
    let mut s = recovery(true, false, true);
    s.network.known.get_mut(B).expect("configured relay").read = false;
    plan(&mut s.network, &s.filter, START + 3003);
    assert!(s.network.drain_effects().iter().any(|e| is_close(e, B)));
    assert!(
        s.network
            .message(
                B,
                &json!(["EVENT", s.recovered[1], s.messages[2]]).to_string(),
                START + 3004
            )
            .is_none()
    );
    s.network.plan(vec![], &Store::new(0), START + 3005);
    assert_eq!(s.network.request_progress("home").0, 0);
    assert!(s.network.open_wires().is_empty());
}
