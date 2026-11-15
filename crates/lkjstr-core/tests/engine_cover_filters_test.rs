#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const R: &str = "wss://filters.test/";
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
fn wants() -> Vec<(String, NostrFilter, Query)> {
    (0..4)
        .map(|i| {
            (
                format!("v{i}"),
                NostrFilter {
                    ids: Some(vec![format!("{i:064x}")]),
                    kinds: Some(vec![40]),
                    limit: Some(1),
                    ..Default::default()
                },
                Query::default(),
            )
        })
        .collect()
}
#[test]
fn nip01_advertisement_enables_two_but_explicit_limits_and_unknown_relays_win() {
    for (info, expected) in [
        ("{}", 4),
        (r#"{"supported_nips":[1]}"#, 2),
        (
            r#"{"supported_nips":[1],"limitation":{"max_filters":1}}"#,
            4,
        ),
    ] {
        let mut n = Network::default();
        n.configure(vec![R.into()], 0);
        n.relay_information(R, info);
        n.plan(wants(), &Store::new(0), 0);
        n.connected(R, 0);
        let mut sent = reqs(&mut n);
        for at in [100, 200, 300] {
            n.tick(at);
            sent.extend(reqs(&mut n));
        }
        let filters: usize = sent
            .iter()
            .map(|f| f.as_array().expect("frame").len() - 2)
            .sum();
        assert_eq!(filters, 4);
        assert_eq!(sent.len(), expected);
        println!(
            "max_filters document={info} REQs={} filters=4 connections=1",
            sent.len()
        );
    }
}
#[test]
fn rejected_envelope_splits_once_with_fresh_ids_and_preserves_members() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relay_information(R, r#"{"supported_nips":[1]}"#);
    n.relays.get_mut(R).expect("relay").max_reqs = 1;
    n.plan(wants(), &Store::new(0), 0);
    n.connected(R, 0);
    let initial = reqs(&mut n).remove(0);
    assert_eq!(initial.as_array().expect("frame").len(), 4);
    n.message(
        R,
        &json!(["CLOSED", initial[1], "error: too many filters"]).to_string(),
        1,
    );
    n.relay_information(R, r#"{"supported_nips":[1]}"#);
    assert_eq!(n.relays[R].max_filters, 1);
    let mut seen = std::collections::BTreeSet::new();
    for at in [100, 200, 300, 400] {
        n.tick(at);
        for f in reqs(&mut n) {
            assert_ne!(f[1], initial[1]);
            assert_eq!(f.as_array().expect("frame").len(), 3);
            seen.insert(f[2]["ids"][0].clone().to_string());
            n.message(R, &json!(["EOSE", initial[1]]).to_string(), at + 1);
            assert!(!n.lookup_complete(f[2]["ids"][0].as_str().expect("id")));
            n.message(R, &json!(["EOSE", f[1]]).to_string(), at + 2);
        }
    }
    assert_eq!(seen.len(), 4);
    assert!(n.open_wires().is_empty());
}
