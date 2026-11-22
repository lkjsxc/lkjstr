//! Empty address identifiers include an absent d tag without loosening identity.
#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::{
    engine::{
        protocol::{Query, Source},
        query,
    },
    store::Store,
};
use lkjstr_protocol::generate_secret_key;

#[test]
fn empty_address_uses_first_d_or_absence_with_latest_and_lowest_id_selection() {
    let key = generate_secret_key();
    let absent = support::event(&key, 30311, 10, "absent d", vec![]);
    let query = Query {
        source: Source::Thread,
        target: Some(format!("30311:{}:", absent.pubkey)),
        ..Default::default()
    };
    let mut store = Store::new(100);
    store.insert(absent.clone(), None);
    let ids = |store: &Store| {
        query::events(store, &query)
            .into_iter()
            .map(|event| event.id.clone())
            .collect::<Vec<_>>()
    };
    assert_eq!(ids(&store), std::slice::from_ref(&absent.id));

    let explicit = support::event(
        &key,
        30311,
        10,
        "empty d",
        vec![vec!["d".into(), "".into()]],
    );
    let other = support::event(
        &key,
        30311,
        20,
        "another address",
        vec![
            vec!["d".into(), "other".into()],
            vec!["d".into(), "".into()],
        ],
    );
    store.insert(explicit.clone(), None);
    store.insert(other, None);
    assert_eq!(ids(&store), [absent.id.min(explicit.id)]);

    let latest = support::event(
        &key,
        30311,
        30,
        "newest empty address",
        vec![
            vec!["d".into(), "".into()],
            vec!["d".into(), "ignored second d".into()],
        ],
    );
    store.insert(latest.clone(), None);
    assert_eq!(ids(&store), [latest.id]);
}
