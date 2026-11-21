//! Signed Nostr frames through the production relay scheduler and wire session.
#![allow(clippy::expect_used, clippy::unwrap_used)]
mod engine_review_support;
mod engine_time_older_support;
use engine_time_older_support::{A, AT, B, RelayFixture, fixtures, sign};
use lkjstr_protocol::generate_secret_key;
use serde_json::json;

#[test]
fn inclusive_older_pages_grow_and_a_stalled_route_does_not_claim_end() {
    let (_, list, [a, b, overlap, deep, newer, _]) = fixtures();
    let mut f = RelayFixture::new(&[A, B]);
    f.engine.store.insert(newer.clone(), None);
    f.open("feed", &list);
    f.seek("feed", AT, 0, 3);
    f.hint(&["feed"]);
    f.tick(150);
    assert_eq!(f.report("feed")["followList"]["state"], "unknown");
    assert!(f.requests(A, 1).is_empty());
    let watch = f.request(A, 3);
    f.page(A, &watch[1], &[&list]);
    f.tick(150);
    let first = f.request(A, 1);
    let stalled = f.request(B, 1);
    assert_eq!(
        first[2],
        json!({"authors":[a.pubkey],"kinds":[1,6],"since":81,"until":100,"limit":3})
    );
    assert_eq!(first[2], stalled[2]);
    assert_eq!(f.report("feed")["older"], "loading");
    f.receive(A, json!(["EVENT", first[1], newer]));
    f.page(A, &first[1], &[&a, &b, &overlap]);
    f.tick(150);
    assert_eq!(
        f.requests(A, 1).len(),
        1,
        "full visible window waits for growth"
    );
    f.seek("feed", AT, 0, 4);
    f.tick(150);
    let continued = f.request(A, 1);
    assert_ne!(continued[1], first[1]);
    assert_eq!(continued[2]["until"], overlap.created_at);
    assert_eq!(
        f.requests(B, 1).len(),
        1,
        "the other route keeps its original cursor"
    );
    f.page(A, &continued[1], &[&overlap, &deep]);
    f.tick(150);
    assert_eq!(f.report("feed")["older"], "loading");
    f.tick(6_000);
    assert_eq!(f.report("feed")["older"], "stalled");
    assert!(f.closed(B, &stalled));
    f.seek("feed", AT, 1, 5);
    let mut ties = [&a.id, &b.id];
    ties.sort_by(|a, b| b.cmp(a));
    assert_eq!(
        f.rows("feed"),
        [&newer.id, ties[0], ties[1], &overlap.id, &deep.id].map(|id| id.clone())
    );
    assert_eq!(f.report("feed")["at"], AT);
    assert_eq!(
        f.report("feed")["followList"],
        json!({"state":"latest-verified","at":110000,"id":list.id})
    );
    assert!(
        f.requests(A, 1)
            .iter()
            .chain(&f.requests(B, 1))
            .all(|req| req[2]["until"].is_u64())
    );
}

#[test]
fn identical_wire_filters_cannot_share_eose_across_owner_pivot_or_list() {
    let (owner, list, [a, _, _, _, _, stale]) = fixtures();
    let mut f = RelayFixture::new(&[A]);
    f.engine.network.relays.get_mut(A).unwrap().max_reqs = 8;
    f.open("feed", &list);
    f.seek("feed", AT, 0, 1);
    f.hint(&["feed"]);
    f.tick(150);
    let watch = f.request(A, 3);
    f.page(A, &watch[1], &[&list]);
    f.tick(150);
    let first = f.request(A, 1);
    f.page(A, &first[1], &[&a]);
    f.tick(150);
    assert_eq!(f.report("feed")["older"], "end");

    f.open("peer", &list);
    f.seek("peer", AT, 0, 1);
    f.hint(&["feed", "peer"]);
    f.tick(150);
    let peer = f.request(A, 1);
    assert_ne!(first[1], peer[1]);
    assert_eq!(first[2], peer[2]);
    assert_eq!(f.report("peer")["older"], "loading");

    let later_at = AT - 1;
    f.seek("feed", later_at, 0, 1);
    f.tick(150);
    let moved = f.request(A, 1);
    assert_ne!(peer[1], moved[1]);
    assert_eq!(first[2], moved[2]);
    f.page(A, &first[1], &[&stale]);
    f.tick(150);
    assert_eq!(f.report("feed")["older"], "loading");
    assert_eq!(f.report("feed")["at"], later_at);
    assert!(f.engine.store.get(&stale.id).is_none());

    f.page(A, &moved[1], &[&a]);
    f.tick(150);
    assert_eq!(f.report("feed")["older"], "end");
    assert_eq!(f.report("peer")["older"], "loading");
    let latest = sign(&owner, 3, 111, "", list.tags.clone());
    f.receive(A, json!(["EVENT", watch[1], latest]));
    f.tick(150);
    assert!(f.closed(A, &moved));
    assert!(f.closed(A, &peer));
    assert_eq!(f.report("feed")["followList"]["id"], latest.id);
    assert_eq!(f.report("feed")["older"], "loading");
    f.page(A, &moved[1], &[&stale]);
    f.tick(150);
    assert!(f.engine.store.get(&stale.id).is_none());
    assert_eq!(f.report("feed")["older"], "loading");

    let requests = f.requests(A, 1);
    let current = requests[requests.len() - 2..]
        .iter()
        .map(|req| (*req).clone())
        .collect::<Vec<_>>();
    assert!(current.iter().all(|req| req[2] == first[2]));
    f.hint(&[]);
    assert!(current.iter().all(|req| f.closed(A, req)));
    f.hint(&["feed"]);
    f.engine.network.connected(A, f.now);
    f.tick(150);
    let resumed = f.request(A, 1);
    assert!(!current.iter().any(|req| resumed[1] == req[1]));
    f.input(json!({"t":"close","sub":"feed"}));
    assert!(f.closed(A, &resumed));
}

#[test]
fn a_full_boundary_second_stays_partial_and_invalid_events_cannot_settle_coverage() {
    let (_, list, [a, b, mut tie, _, _, _]) = fixtures();
    let actor = generate_secret_key();
    let owner = generate_secret_key();
    let events = ["a", "b", "c"].map(|text| sign(&actor, 1, 100, text, vec![]));
    let own_list = sign(
        &owner,
        3,
        110,
        "",
        vec![vec!["p".into(), events[0].pubkey.clone()]],
    );
    let mut f = RelayFixture::new(&[A]);
    f.engine.store.insert(own_list.clone(), None);
    f.open("tie", &own_list);
    f.seek("tie", AT, 0, 4);
    f.hint(&["tie"]);
    f.tick(150);
    let page = f.request(A, 1);
    f.page(A, &page[1], &events.each_ref());
    f.tick(150);
    assert_eq!(f.report("tie")["older"], "partial");
    f.seek("tie", AT, 0, 8);
    f.tick(150);
    assert_eq!(f.requests(A, 1).len(), 1);

    f.engine.store.insert(list.clone(), None);
    f.open("invalid", &list);
    f.seek("invalid", AT, 0, 5);
    f.hint(&["invalid"]);
    f.tick(150);
    let page = f.request(A, 1);
    tie.sig = "0".repeat(128);
    f.page(A, &page[1], &[&a, &b, &tie]);
    f.tick(150);
    assert_eq!(f.report("invalid")["older"], "stalled");
    assert_eq!(f.report("invalid")["newer"], "cache-only");
    assert!(f.engine.store.get(&tie.id).is_none());
    assert_eq!(f.requests(A, 1).len(), 2);
}
