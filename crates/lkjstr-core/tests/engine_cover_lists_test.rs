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
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
#[test]
fn merged_contact_lookup_proves_absence_per_author_only_after_verified_short_eose() {
    const R: &str = "wss://lists.test/";
    let present = event(1, 3, "{}", vec![]);
    let absent = event(2, 3, "{}", vec![]);
    let mut n = Network::default();
    let mut store = Store::new(20);
    n.configure(vec![R.into()], 0);
    let wants = [&present, &absent]
        .into_iter()
        .map(|e| {
            (
                e.pubkey.clone(),
                NostrFilter {
                    kinds: Some(vec![3]),
                    authors: Some(vec![e.pubkey.clone()]),
                    limit: Some(1),
                    ..Default::default()
                },
                Query::default(),
            )
        })
        .collect();
    n.plan(wants, &store, 0);
    n.connected(R, 0);
    n.tick(75);
    let frames: Vec<Value> = n
        .drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => serde_json::from_str(&s).ok(),
            _ => None,
        })
        .collect();
    let req = frames
        .iter()
        .find(|f| f[0] == "REQ")
        .expect("merged contact request");
    assert_eq!(req[2]["authors"].as_array().expect("authors").len(), 2);
    n.message(R, &json!(["EVENT", req[1], present]).to_string(), 76);
    n.message(R, &json!(["EOSE", req[1]]).to_string(), 77);
    assert!(
        !n.list_loaded(&store, &absent.pubkey, 3),
        "unverified reply is not evidence"
    );
    store.insert(present.clone(), None);
    assert!(n.list_loaded(&store, &absent.pubkey, 3));
    assert!(!n.list_loaded(&store, &present.pubkey, 3));
    n.verifying = true;
    assert!(!n.list_loaded(&store, &absent.pubkey, 3));
}
