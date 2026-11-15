#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{
    NostrFilter, VerificationResult, filter_to_value, matches_filter, parse_filter_value,
    verify_event,
};
use serde_json::{Value, json};
use std::collections::BTreeSet;
const R: &str = "wss://hydrate.test/";
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => Some(serde_json::from_str(&s).expect("frame")),
            _ => None,
        })
        .collect()
}
fn filter(kind: u8, i: usize) -> NostrFilter {
    let mut f = NostrFilter {
        limit: Some(200),
        ..Default::default()
    };
    let key = format!("{i:064x}");
    match kind {
        0 | 3 => {
            f.authors = Some(vec![key]);
            f.kinds = Some(vec![u64::from(kind)]);
            f.limit = Some(1);
        }
        1 => f.ids = Some(vec![key]),
        _ => {
            f.kinds = Some(vec![1, 6, 7, 9735]);
            f.tags.insert("e".into(), vec![key]);
        }
    }
    f
}
#[test]
fn arrival_window_coalesces_each_family_without_replaying_owned_items() {
    for kind in [0, 1, 2, 3] {
        let mut n = Network::default();
        n.configure(vec![R.into()], 0);
        let data: Vec<_> = (0..3)
            .map(|i| {
                event(
                    10 + i,
                    if kind == 2 {
                        7
                    } else if kind == 1 {
                        1
                    } else {
                        u64::from(kind)
                    },
                    "{}",
                    if kind == 2 {
                        vec![vec!["e".into(), format!("{i:064x}")]]
                    } else {
                        vec![]
                    },
                )
            })
            .collect();
        let wanted = |j: usize| {
            let mut f = filter(kind, j);
            if kind == 0 || kind == 3 {
                f.authors = Some(vec![data[j].pubkey.clone()]);
            }
            if kind == 1 {
                f.ids = Some(vec![data[j].id.clone()]);
            }
            (format!("view{j}"), f, Query::default())
        };
        let mut sent = Vec::new();
        for i in 0..3 {
            let wants = (0..=i).map(&wanted).collect();
            n.plan(wants, &Store::new(0), i as u64 * 20);
            if i == 0 {
                n.connected(R, 0);
            }
            sent.extend(frames(&mut n).into_iter().filter(|f| f[0] == "REQ"));
        }
        n.tick(75);
        sent.extend(frames(&mut n).into_iter().filter(|f| f[0] == "REQ"));
        for now in [175, 275, 375, 475] {
            n.tick(now);
            sent.extend(frames(&mut n).into_iter().filter(|f| f[0] == "REQ"));
        }
        let mut received = BTreeSet::new();
        let mut duplicates = 0;
        let mut bytes_in = 0;
        for frame in &sent {
            let f = parse_filter_value(&frame[2]).expect("filter");
            for e in data.iter().filter(|e| matches_filter(e, &f)) {
                let wire = json!(["EVENT", frame[1], e]).to_string();
                bytes_in += wire.len();
                let accepted = n.message(R, &wire, 500).expect("matched event");
                assert!(matches!(verify_event(&accepted), VerificationResult::Ok(_)));
                if !received.insert(accepted.id) {
                    duplicates += 1;
                }
            }
            n.message(R, &json!(["EOSE", frame[1]]).to_string(), 501);
        }
        assert_eq!(received.len(), 3);
        if std::env::var_os("LKJSTR_COVER_BASELINE").is_none() {
            assert_eq!(sent.len(), 1, "family {kind}");
            let f = &sent[0][2];
            let values = if kind == 1 {
                &f["ids"]
            } else if kind == 2 {
                &f["#e"]
            } else {
                &f["authors"]
            };
            assert_eq!(values.as_array().expect("keys").len(), 3);
            n.plan((0..3).map(&wanted).collect(), &Store::new(0), 600);
            assert!(!frames(&mut n).iter().any(|f| f[0] == "REQ"));
            n.plan(vec![], &Store::new(0), 700);
            assert!(n.open_wires().is_empty());
        }
        println!(
            "coalesce family={kind} REQs={} connections=1 verified=3/3 duplicate_events={duplicates} bytes_in={bytes_in}",
            sent.len()
        );
    }
}
#[test]
fn relay_limit_one_keeps_every_author_and_cancellation_rejects_late_eose() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relay_information(R, r#"{"limitation":{"max_limit":1,"max_subscriptions":1}}"#);
    let wants: Vec<_> = (0..3)
        .map(|i| (format!("v{i}"), filter(0, i), Query::default()))
        .collect();
    n.plan(wants, &Store::new(0), 0);
    n.connected(R, 0);
    let mut people = BTreeSet::new();
    let mut old = Value::Null;
    for now in [75, 200, 400] {
        n.tick(now);
        for f in frames(&mut n).into_iter().filter(|f| f[0] == "REQ") {
            assert_eq!(f[2]["authors"].as_array().expect("authors").len(), 1);
            people.insert(f[2]["authors"][0].clone().to_string());
            n.message(R, &json!(["EOSE", f[1]]).to_string(), now + 1);
            old = f[1].clone();
        }
    }
    assert_eq!(people.len(), 3);
    n.plan(vec![], &Store::new(0), 500);
    n.plan(
        vec![("new".into(), filter(0, 0), Query::default())],
        &Store::new(0),
        600,
    );
    n.connected(R, 600);
    n.tick(675);
    n.message(R, &json!(["EOSE", old]).to_string(), 676);
    assert!(!n.profile_finished(&format!("{:064x}", 0), &[]));
}
#[test]
fn stable_live_count_buckets_keep_exactness_and_receive_new_reactions() {
    let note = event(1, 1, "note", vec![]);
    let reaction = event(2, 7, "+", vec![vec!["e".into(), note.id.clone()]]);
    let mut f = filter(2, 0);
    f.tags.insert("e".into(), vec![note.id]);
    let mut n = Network::default();
    let mut store = Store::new(100);
    n.configure(vec![R.into()], 0);
    let want = ("counts".into(), f.clone(), Query::default());
    n.plan(vec![want.clone()], &store, 0);
    n.connected(R, 0);
    n.tick(75);
    let req = frames(&mut n)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("counts");
    n.message(R, &json!(["EOSE", req[1]]).to_string(), 100);
    assert!(n.count_complete(&f, &store));
    assert!(matches_filter(&reaction, &f));
    assert!(
        n.message(R, &json!(["EVENT", req[1], reaction]).to_string(), 101)
            .is_some()
    );
    store.insert(reaction, None);
    n.plan(vec![want], &store, 200);
    assert!(!frames(&mut n).iter().any(|f| f[0] == "REQ"));
    assert!(n.count_complete(&f, &store));
    assert_eq!(filter_to_value(&f)["limit"], 200);
}
