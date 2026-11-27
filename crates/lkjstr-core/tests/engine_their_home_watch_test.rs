#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::{Query, Source},
};
use lkjstr_core::store::Store;
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn frames(network: &mut Network) -> Vec<Value> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .collect()
}

#[test]
fn follows_mutes_and_timeline_share_one_slot_and_release_with_the_view() {
    let relay = "wss://their-home-fixture.test/";
    for shared in [false, true] {
        let mut network = Network::default();
        network.configure(vec![relay.into()], 0);
        network.relay_information(relay, r#"{"limitation":{"max_subscriptions":1}}"#);
        let query = Query {
            source: Source::TheirHome,
            target: Some("aa".repeat(32)),
            ..Default::default()
        };
        let filter = |kind| NostrFilter {
            kinds: Some(vec![kind]),
            authors: Some(vec![if kind == 1 { "bb" } else { "aa" }.repeat(32)]),
            limit: Some(if kind == 1 { 200 } else { 1 }),
            ..Default::default()
        };
        let mut wants = [3, 10000, 1]
            .map(|kind| ("their".into(), filter(kind), query.clone()))
            .to_vec();
        if shared {
            wants.push(("~account-discovery".into(), filter(10000), Query::default()));
        }
        network.plan(wants, &Store::new(16), 0);
        network.connected(relay, 1);
        let mut active = None;
        let mut served = BTreeSet::new();
        let mut requests = 0;
        for now in (100..=10_000).step_by(100) {
            network.tick(now);
            for frame in frames(&mut network) {
                if frame[0] == "CLOSE" {
                    assert_eq!(active.take(), Some(frame[1].clone()));
                } else if frame[0] == "REQ" {
                    assert!(active.replace(frame[1].clone()).is_none(), "one relay slot");
                    served.insert(frame[2]["kinds"][0].as_u64().expect("kind"));
                    requests += 1;
                    network.message(relay, &json!(["EOSE", frame[1]]).to_string(), now);
                }
            }
        }
        assert_eq!(served, BTreeSet::from([1, 3, 10000]));
        assert!(requests <= 30, "bounded rotation");
        network.plan(vec![], &Store::new(16), 10_100);
        let closed = frames(&mut network);
        assert!(closed.iter().any(|frame| frame[0] == "CLOSE"));
        network.tick(11_000);
        assert!(!frames(&mut network).iter().any(|frame| frame[0] == "REQ"));
    }
}

#[test]
fn another_viewers_list_is_finite_even_when_their_home_needs_it() {
    let relay = "wss://their-home-fixture.test/";
    let mut network = Network::default();
    network.configure(vec![relay.into()], 0);
    network.relay_information(relay, "{}");
    let query = Query {
        source: Source::TheirHome,
        account: Some("bb".repeat(32)),
        target: Some("aa".repeat(32)),
        ..Default::default()
    };
    let filter = |author: &str| NostrFilter {
        kinds: Some(vec![10000]),
        authors: Some(vec![author.repeat(32)]),
        limit: Some(1),
        ..Default::default()
    };
    network.plan(
        vec![
            ("their".into(), filter("aa"), query.clone()),
            ("their".into(), filter("bb"), query),
        ],
        &Store::new(16),
        0,
    );
    network.connected(relay, 0);
    network.tick(100);
    let requests = frames(&mut network);
    let owner = requests
        .iter()
        .find(|frame| frame[0] == "REQ" && frame[2]["authors"][0] == "aa".repeat(32))
        .expect("owner request");
    let viewer = requests
        .iter()
        .find(|frame| frame[0] == "REQ" && frame[2]["authors"][0] == "bb".repeat(32))
        .expect("viewer request");
    network.message(relay, &json!(["EOSE", owner[1]]).to_string(), 101);
    network.message(relay, &json!(["EOSE", viewer[1]]).to_string(), 101);
    let closed = frames(&mut network);
    assert!(
        closed
            .iter()
            .any(|frame| frame[0] == "CLOSE" && frame[1] == viewer[1])
    );
    assert!(
        !closed
            .iter()
            .any(|frame| frame[0] == "CLOSE" && frame[1] == owner[1])
    );
}
