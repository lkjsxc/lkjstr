//! Raw EOSE does not identify an empty reader while matching events await verification.
#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
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
struct Case {
    n: Network,
    f: NostrFilter,
    first: BTreeMap<String, Value>,
    replay: Value,
    events: [NostrEvent; 3],
}
fn frames(n: &mut Network) -> BTreeMap<String, Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| {
            let Effect::Send(url, raw) = e else {
                return None;
            };
            let v: Value = serde_json::from_str(&raw).expect("frame");
            (v[0] == "REQ").then_some((url, v))
        })
        .collect()
}
fn plan(n: &mut Network, f: &NostrFilter, at: u64) {
    n.plan(
        vec![("feed".into(), f.clone(), Query::default())],
        &Store::new(0),
        at,
    );
}
fn raw(n: &mut Network, relay: &str, req: &Value, e: &NostrEvent, at: u64) {
    assert!(
        n.message(relay, &json!(["EVENT", req[1], e]).to_string(), at)
            .is_some()
    );
}
fn verified(n: &mut Network, relay: &str, e: &NostrEvent, at: u64) {
    assert!(matches!(verify_event(e), VerificationResult::Ok(_)));
    n.observe_verified(relay, e, at);
}
fn eose(n: &mut Network, relay: &str, req: &Value, at: u64) {
    n.message(relay, &json!(["EOSE", req[1]]).to_string(), at);
}
fn setup(known_data: bool) -> Case {
    let key = generate_secret_key();
    let events = [990, 1002, 1003].map(|at| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind: 1,
                content: format!("synthetic pending route {at}"),
                tags: vec![],
            },
            &key,
        )
        .expect("signed fixture")
    });
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], START);
    let f = NostrFilter {
        authors: Some(vec![events[0].pubkey.clone()]),
        kinds: Some(vec![1, 6]),
        limit: Some(200),
        ..Default::default()
    };
    plan(&mut n, &f, START);
    n.connected(A, START + 1);
    n.connected(B, START + 1);
    let first = frames(&mut n);
    eose(&mut n, A, &first[A], START + 2);
    if known_data {
        raw(&mut n, B, &first[B], &events[0], START + 3);
        verified(&mut n, B, &events[0], START + 3);
    }
    eose(&mut n, B, &first[B], START + 4);
    n.disconnected(B, START + 20);
    plan(&mut n, &f, START + 21);
    n.connected(C, START + 22);
    let fallback = frames(&mut n);
    eose(&mut n, C, &fallback[C], START + 23);
    plan(&mut n, &f, START + 24);
    frames(&mut n);
    n.connected(B, START + 3000);
    let replay = frames(&mut n)[B].clone();
    if known_data {
        raw(&mut n, B, &replay, &events[0], START + 3001);
        verified(&mut n, B, &events[0], START + 3001);
    }
    Case {
        n,
        f,
        first,
        replay,
        events,
    }
}
fn closed(e: &Effect, relay: &str) -> bool {
    matches!(e, Effect::Send(url, raw) if url == relay
        && serde_json::from_str::<Value>(raw).is_ok_and(|v| v[0] == "CLOSE"))
}
#[test]
fn queued_primary_data_is_not_replaced_as_an_empty_answer() {
    let mut c = setup(true);
    raw(&mut c.n, A, &c.first[A], &c.events[1], START + 3002);
    c.n.verifying = true;
    eose(&mut c.n, B, &c.replay, START + 3002);
    plan(&mut c.n, &c.f, START + 3003);
    let effects = c.n.drain_effects();
    assert!(
        !effects.iter().any(|e| closed(e, A)),
        "A's raw live event is not yet an empty verified answer: {effects:?}"
    );
    assert!(
        !effects.iter().any(|e| closed(e, B)),
        "recovery debt must survive the verification barrier"
    );
    assert_eq!(c.n.request_progress("feed").0, 3);
    verified(&mut c.n, A, &c.events[1], START + 3004);
    c.n.verifying = false;
    plan(&mut c.n, &c.f, START + 3005);
    assert_eq!(c.n.request_progress("feed").0, 2);
    assert!(
        c.n.drain_effects().iter().any(|e| closed(e, C)),
        "only the truly empty C route yields"
    );
    raw(&mut c.n, A, &c.first[A], &c.events[2], START + 3006);
    raw(&mut c.n, B, &c.replay, &c.events[2], START + 3006);
}
#[test]
fn first_recovery_data_waits_for_verification_before_retirement() {
    let mut c = setup(false);
    raw(&mut c.n, B, &c.replay, &c.events[1], START + 3001);
    c.n.verifying = true;
    eose(&mut c.n, B, &c.replay, START + 3002);
    plan(&mut c.n, &c.f, START + 3003);
    assert!(
        !c.n.drain_effects().iter().any(|e| closed(e, B)),
        "pending recovered data must not lose its route before verification"
    );
    verified(&mut c.n, B, &c.events[1], START + 3004);
    c.n.verifying = false;
    plan(&mut c.n, &c.f, START + 3005);
    assert_eq!(c.n.request_progress("feed").0, 2);
    raw(&mut c.n, B, &c.replay, &c.events[2], START + 3006);
}
#[test]
fn a_pending_recovery_still_releases_on_permission_or_view_revocation() {
    for remove in [false, true] {
        let mut c = setup(false);
        raw(&mut c.n, B, &c.replay, &c.events[1], START + 3001);
        c.n.verifying = true;
        eose(&mut c.n, B, &c.replay, START + 3002);
        if remove {
            c.n.known.get_mut(B).expect("configured").read = false;
            plan(&mut c.n, &c.f, START + 3003);
        } else {
            c.n.plan(vec![], &Store::new(0), START + 3003);
        }
        assert!(c.n.drain_effects().iter().any(|e| closed(e, B)));
        assert!(
            c.n.message(
                B,
                &json!(["EVENT", c.replay[1], c.events[2]]).to_string(),
                START + 3004
            )
            .is_none()
        );
        if !remove {
            assert!(c.n.open_wires().is_empty());
        }
    }
}
