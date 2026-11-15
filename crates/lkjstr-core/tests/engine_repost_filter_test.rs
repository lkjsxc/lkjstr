#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{
        protocol::{Query, Source},
        query,
    },
    store::Store,
};

#[test]
fn hide_reposts_checks_wrappers_before_resolving_content() {
    let mut store = Store::new(100);
    let target = event(10, 1, "matching image https://local.test/a.png", vec![]);
    let wrapper = event(20, 6, "", vec![vec!["e".into(), target.id.clone()]]);
    let ordinary = event(30, 1, "matching image https://local.test/b.png", vec![]);
    let missing = event(40, 6, "", vec![vec!["e".into(), "f".repeat(64)]]);
    for e in [&target, &wrapper, &ordinary, &missing] {
        store.insert(e.clone(), None);
    }
    // Home selects the reposter, so the target can only arrive through its wrapper.
    let mut q = Query {
        source: Source::Home,
        account: Some(wrapper.pubkey.clone()),
        ..Default::default()
    };
    assert_eq!(
        query::events(&store, &q)
            .iter()
            .map(|e| &e.id)
            .collect::<Vec<_>>(),
        vec![&target.id]
    );
    q.filters.reposts = Some(false);
    assert!(query::events(&store, &q).is_empty());
    // Search keeps direct notes, while both resolved and unresolved wrappers are hidden.
    q.source = Source::Search;
    q.account = None;
    assert_eq!(
        query::events(&store, &q)
            .iter()
            .map(|e| &e.id)
            .collect::<Vec<_>>(),
        vec![&ordinary.id, &target.id]
    );
    q.filters.reposts = None;
    q.source = Source::Home;
    q.account = Some(wrapper.pubkey.clone());
    q.filters.text = Some("matching".into());
    q.filters.has = Some(vec!["image".into()]);
    assert_eq!(
        query::events(&store, &q)
            .iter()
            .map(|e| &e.id)
            .collect::<Vec<_>>(),
        vec![&target.id]
    );
}
