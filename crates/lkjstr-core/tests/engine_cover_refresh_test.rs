#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
fn reqs(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => {
                let v: Value = serde_json::from_str(&s).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
#[test]
fn cached_hydration_stays_deduplicated_but_a_new_explicit_people_request_refreshes() {
    const R: &str = "wss://refresh.test/";
    let old = event(100, 0, r#"{"name":"old"}"#, vec![]);
    let mut store = Store::new(10);
    store.insert(old.clone(), None);
    let f = NostrFilter {
        authors: Some(vec![old.pubkey.clone()]),
        kinds: Some(vec![0]),
        limit: Some(1),
        ..Default::default()
    };
    let a = ("existing".into(), f.clone(), Query::default());
    let b = ("shared".into(), f.clone(), Query::default());
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.plan(vec![a.clone()], &store, 0);
    n.connected(R, 75);
    let first = reqs(&mut n).remove(0);
    n.message(R, &json!(["EOSE", first[1]]).to_string(), 76);
    n.plan(vec![a.clone(), b.clone()], &store, 200);
    assert!(
        reqs(&mut n).is_empty(),
        "another hydration owner must not replay metadata"
    );
    n.plan(
        vec![
            a,
            b,
            (
                "refresh".into(),
                f,
                Query {
                    source: Source::People,
                    ..Default::default()
                },
            ),
        ],
        &store,
        300,
    );
    n.connected(R, 300);
    let refreshed = reqs(&mut n);
    assert_eq!(
        refreshed.len(),
        1,
        "explicit lookup cannot settle from stale cached evidence"
    );
    assert_ne!(refreshed[0][1], first[1]);
}
#[test]
fn normalizing_people_limit_cannot_remove_the_owner_refresh_watch() {
    const R: &str = "wss://owner-profile.test/";
    let metadata = event(100, 0, r#"{"name":"updated"}"#, vec![]);
    let owner = NostrFilter {
        authors: Some(vec![metadata.pubkey]),
        kinds: Some(vec![0]),
        limit: Some(1),
        ..Default::default()
    };
    let mut people = owner.clone();
    people.limit = Some(32);
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.plan(
        vec![
            ("~account-discovery".into(), owner.clone(), Query::default()),
            (
                "people".into(),
                people,
                Query {
                    source: Source::People,
                    ..Default::default()
                },
            ),
        ],
        &Store::new(0),
        0,
    );
    n.connected(R, 0);
    let frame = reqs(&mut n).remove(0);
    n.message(R, &json!(["EOSE", frame[1]]).to_string(), 1);
    assert_eq!(
        n.open_wires().get(R),
        Some(&1),
        "owner kind-0 refresh must stay live after EOSE"
    );
    assert_eq!(n.request_stats()[0]["members"], 2);
    n.plan(
        vec![("~account-discovery".into(), owner, Query::default())],
        &Store::new(0),
        200,
    );
    assert_eq!(n.open_wires().get(R), Some(&1));
}
#[test]
fn explicit_people_refresh_reactivates_a_parked_owner_record() {
    const R: &str = "wss://parked-owner.test/";
    let authors = Some(vec!["a".repeat(64)]);
    let profile = NostrFilter {
        authors: authors.clone(),
        kinds: Some(vec![0]),
        limit: Some(1),
        ..Default::default()
    };
    let owner = (
        "~account-discovery".into(),
        profile.clone(),
        Query::default(),
    );
    let other = (
        "~account-discovery".into(),
        NostrFilter {
            authors,
            kinds: Some(vec![10002]),
            limit: Some(1),
            ..Default::default()
        },
        Query::default(),
    );
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relays.get_mut(R).expect("relay").max_reqs = 1;
    n.plan(vec![owner.clone()], &Store::new(0), 0);
    n.connected(R, 0);
    let first = reqs(&mut n).remove(0);
    n.message(R, &json!(["EOSE", first[1]]).to_string(), 1);
    n.plan(vec![owner.clone(), other.clone()], &Store::new(0), 100);
    let relay_list = reqs(&mut n).remove(0);
    assert_eq!(relay_list[2]["kinds"], json!([10002]));
    n.message(R, &json!(["EOSE", relay_list[1]]).to_string(), 101);
    let mut explicit = profile;
    explicit.limit = Some(32);
    n.plan(
        vec![
            owner,
            other,
            (
                "refresh".into(),
                explicit,
                Query {
                    source: Source::People,
                    ..Default::default()
                },
            ),
        ],
        &Store::new(0),
        201,
    );
    let sent = reqs(&mut n);
    assert!(
        sent.iter().any(|f| f[2]["kinds"] == json!([0])),
        "a new explicit owner lookup must reopen its parked wire"
    );
}
