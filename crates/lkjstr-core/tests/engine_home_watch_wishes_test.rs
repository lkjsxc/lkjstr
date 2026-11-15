#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::{Query, Source},
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| {
            if let Effect::Send(_, text) = e {
                Some(serde_json::from_str(&text).expect("frame"))
            } else {
                None
            }
        })
        .collect()
}
#[test]
fn an_owners_home_keeps_its_follow_watch_after_eose_and_releases_it_on_close() {
    let relay = "wss://fixture.local/";
    let mut n = Network::default();
    n.configure(vec![relay.into()], 0);
    n.relay_information(relay, "{}");
    let f = NostrFilter {
        kinds: Some(vec![3]),
        authors: Some(vec!["aa".repeat(32)]),
        limit: Some(1),
        ..Default::default()
    };
    let lookup = Query {
        source: Source::Profile,
        ..Default::default()
    };
    n.plan(vec![("lookup".into(), f.clone(), lookup.clone())], 0);
    n.connected(relay, 0);
    let first = frames(&mut n);
    let id = first.iter().find(|v| v[0] == "REQ").expect("request")[1].clone();
    n.message(relay, &json!(["EOSE", id]).to_string(), 1);
    assert!(frames(&mut n).iter().any(|v| v[0] == "CLOSE"));
    let home = Query {
        source: Source::TheirHome,
        ..Default::default()
    };
    n.plan(
        vec![
            ("lookup".into(), f.clone(), lookup.clone()),
            ("home".into(), f.clone(), home),
        ],
        200,
    );
    n.tick(200);
    let again = frames(&mut n);
    let id = again.iter().find(|v| v[0] == "REQ").expect("live request")[1].clone();
    n.message(relay, &json!(["EOSE", id]).to_string(), 201);
    assert!(!frames(&mut n).iter().any(|v| v[0] == "CLOSE"));
    n.plan(vec![("lookup".into(), f, lookup)], 202);
    assert!(frames(&mut n).iter().any(|v| v[0] == "CLOSE"));
}
