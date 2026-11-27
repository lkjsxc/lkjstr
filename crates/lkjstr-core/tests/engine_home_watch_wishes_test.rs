#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::{Query, Source},
};
use lkjstr_core::store::Store;
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
    n.plan(
        vec![("lookup".into(), f.clone(), lookup.clone())],
        &Store::new(16),
        0,
    );
    n.connected(relay, 0);
    n.tick(75);
    let first = frames(&mut n);
    let id = first.iter().find(|v| v[0] == "REQ").expect("request")[1].clone();
    n.message(relay, &json!(["EOSE", id]).to_string(), 76);
    assert!(frames(&mut n).iter().any(|v| v[0] == "CLOSE"));
    let home = Query {
        source: Source::TheirHome,
        target: Some("aa".repeat(32)),
        ..Default::default()
    };
    n.plan(
        vec![
            ("lookup".into(), f.clone(), lookup.clone()),
            ("home".into(), f.clone(), home),
        ],
        &Store::new(16),
        200,
    );
    n.tick(200);
    let again = frames(&mut n);
    let id = again.iter().find(|v| v[0] == "REQ").expect("live request")[1].clone();
    n.message(relay, &json!(["EOSE", id]).to_string(), 201);
    assert!(!frames(&mut n).iter().any(|v| v[0] == "CLOSE"));
    n.plan(vec![("lookup".into(), f, lookup)], &Store::new(16), 202);
    assert!(frames(&mut n).iter().any(|v| v[0] == "CLOSE"));
}

#[test]
fn live_follow_watch_and_timeline_share_one_slot_in_either_arrival_order() {
    let relay = "wss://fixture.local/";
    for watch_first in [false, true] {
        for shared_discovery in [false, true] {
            for finite_feed in [false, true] {
                let mut n = Network::default();
                n.configure(vec![relay.into()], 0);
                n.relay_information(relay, r#"{"limitation":{"max_subscriptions":1}}"#);
                let home = Query {
                    source: Source::TheirHome,
                    target: Some("aa".repeat(32)),
                    ..Default::default()
                };
                let watch = (
                    "home".into(),
                    NostrFilter {
                        kinds: Some(vec![3]),
                        authors: Some(vec!["aa".repeat(32)]),
                        limit: Some(1),
                        ..Default::default()
                    },
                    home.clone(),
                );
                let feed = (
                    "home".into(),
                    NostrFilter {
                        kinds: Some(vec![1, 6]),
                        until: finite_feed.then_some(1000),
                        authors: Some(vec!["bb".repeat(32)]),
                        limit: Some(200),
                        ..Default::default()
                    },
                    home,
                );
                let mut wants = vec![if watch_first {
                    watch.clone()
                } else {
                    feed.clone()
                }];
                n.plan(wants.clone(), &Store::new(16), 0);
                n.connected(relay, 1);
                let first = frames(&mut n);
                let initial = first.iter().find(|f| f[0] == "REQ").expect("initial");
                n.message(relay, &json!(["EOSE", initial[1]]).to_string(), 2);
                wants.push(if watch_first {
                    feed.clone()
                } else {
                    watch.clone()
                });
                if shared_discovery {
                    wants.push((
                        "~account-discovery".into(),
                        watch.1.clone(),
                        Query::default(),
                    ));
                }
                n.plan(wants, &Store::new(16), 100);
                let mut active = Some(initial[1].clone());
                let mut served = std::collections::BTreeMap::<u64, usize>::new();
                served.insert(if watch_first { 3 } else { 1 }, 1);
                for now in (100..=4000).step_by(100) {
                    n.tick(now);
                    for frame in frames(&mut n) {
                        if frame[0] == "CLOSE" {
                            assert_eq!(active.take(), Some(frame[1].clone()));
                        } else if frame[0] == "REQ" {
                            assert!(active.replace(frame[1].clone()).is_none(), "one relay slot");
                            *served
                                .entry(frame[2]["kinds"][0].as_u64().expect("kind"))
                                .or_default() += 1;
                            n.message(relay, &json!(["EOSE", frame[1]]).to_string(), now);
                        }
                    }
                }
                assert!(
                    served.get(&3).copied().unwrap_or(0)
                        >= if watch_first || !finite_feed { 2 } else { 1 },
                    "watch resumes"
                );
                assert!(
                    served.get(&1).copied().unwrap_or(0) >= if finite_feed { 1 } else { 2 },
                    "timeline resumes"
                );
                assert!(served.values().sum::<usize>() <= 11, "bounded rotation");
                n.plan(vec![], &Store::new(16), 4100);
                let closed = frames(&mut n);
                assert!(closed.iter().any(|f| f[0] == "CLOSE"));
                n.tick(5000);
                assert!(!frames(&mut n).iter().any(|f| f[0] == "REQ"));
            }
        }
    }
}
