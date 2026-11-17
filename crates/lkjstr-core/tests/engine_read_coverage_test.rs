//! A large finite follower page is neither replayed on route churn nor mistaken for exhaustion.
#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::*;
use lkjstr_core::{
    engine::protocol::{Query, Source},
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::json;

fn follower_want() -> (Want, String) {
    let author = event(7, 12, 1, vec![]).pubkey;
    let f = NostrFilter {
        kinds: Some(vec![3]),
        tags: [("p".to_owned(), vec![author.clone()])].into(),
        limit: Some(1),
        ..Default::default()
    };
    (
        (
            "followers".into(),
            f,
            Query {
                source: Source::Followers,
                target: Some(author.clone()),
                ..Default::default()
            },
        ),
        author,
    )
}

#[test]
fn route_change_does_not_cancel_still_wanted_follower_page_before_eose() {
    let (want, author) = follower_want();
    let store = Store::new(20);
    let mut n = setup(1, 1);
    let requested = acquire(&mut n, vec![want.clone()], &store);
    assert_eq!(requested.len(), 1);
    let original_wire = requested[0][1].clone();

    // Same logical want, but the route becomes unavailable while its first
    // page is still streaming. It must not send CLOSE and replay that page.
    n.known.get_mut(R).expect("configured route").read = false;
    n.plan(vec![want.clone()], &store, NOW + 1500);
    assert!(
        frames(&mut n).is_empty(),
        "retained until an answer or timeout"
    );

    let first = event(9, 33, 3, vec![vec!["p".into(), author]]);
    assert!(
        n.message(
            R,
            &json!(["EVENT", original_wire, first]).to_string(),
            NOW + 1510
        )
        .is_some()
    );
    n.message(R, &json!(["EOSE", original_wire]).to_string(), NOW + 1520);
    n.plan(vec![want.clone()], &store, NOW + 1540);
    let finished = frames(&mut n);
    assert!(!finished.iter().any(|f| f[0] == "REQ"));
    assert!(
        !n.page_exhausted(&want.1),
        "a full first page proves no final end"
    );

    // Re-using the same relay after a route rotation needs no second 12 MB page.
    n.known.get_mut(R).expect("route").read = true;
    n.plan(vec![want], &store, NOW + 2000);
    assert!(!frames(&mut n).iter().any(|f| f[0] == "REQ"));
}

#[test]
fn actually_closed_follower_tab_does_not_hold_an_orphan_wire() {
    let (want, _) = follower_want();
    let store = Store::new(20);
    let mut n = setup(1, 1);
    let requested = acquire(&mut n, vec![want], &store);
    assert_eq!(requested.len(), 1);
    n.plan(vec![], &store, NOW + 1500);
    assert_eq!(frames(&mut n).iter().filter(|f| f[0] == "CLOSE").count(), 1);
}
