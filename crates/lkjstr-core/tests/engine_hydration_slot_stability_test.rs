//! Reader-slot ownership must not change hydration bucket stability.
#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
const C: &str = "wss://c.test/";
fn plan(n: &mut Network, filter: NostrFilter, now: u64) {
    n.plan(
        vec![("profile".into(), filter, Query::default())],
        &Store::new(0),
        now,
    );
}
#[test]
fn normalized_hydration_bucket_keeps_its_existing_readers() {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], 0);
    let filter = NostrFilter {
        kinds: Some(vec![0]),
        authors: Some(vec!["a".repeat(64), "b".repeat(64)]),
        limit: Some(200),
        ..Default::default()
    };
    plan(&mut n, filter.clone(), 0);
    n.connected(A, 1);
    n.connected(B, 1);
    n.tick(100);
    n.drain_effects();
    // Hydration normalizes the physical filter limit to its two authors.
    let mut normalized = filter;
    normalized.limit = Some(2);
    // A latency update is not a failure and must not replay the in-flight bucket.
    n.relays.get_mut(A).expect("A").latency_ms = Some(100_000);
    n.relays.get_mut(B).expect("B").latency_ms = Some(100_000);
    plan(&mut n, normalized, 101);
    let effects = n.drain_effects();
    assert!(effects.iter().all(|effect| !matches!(effect, Effect::Send(url, text) if (url == A || url == B) && text.starts_with("[\"CLOSE\""))), "existing hydration was abandoned: {effects:?}");
    assert!(
        !n.relays[C].connecting,
        "hydration did not request a new route"
    );
}
