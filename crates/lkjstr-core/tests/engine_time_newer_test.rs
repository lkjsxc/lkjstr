//! Signed newest-first relay pages through the production engine and wire session.
#![allow(clippy::expect_used, clippy::unwrap_used)]
mod engine_review_support;
mod engine_time_older_support;
use engine_time_older_support::{A, AT, B, RelayFixture, fixtures, sign};
use lkjstr_protocol::{NostrEvent, generate_secret_key};
use serde_json::{Value, json};

fn requests(f: &RelayFixture, relay: &str, since: u64) -> Vec<Value> {
    f.requests(relay, 1)
        .into_iter()
        .filter(|req| req[2]["since"] == since)
        .cloned()
        .collect()
}

fn latest(f: &RelayFixture, relay: &str) -> Value {
    requests(f, relay, 101).pop().unwrap()
}

fn start(f: &mut RelayFixture, list: &NostrEvent, before: usize, after: usize) {
    f.engine.store.insert(list.clone(), None);
    for relay in f.engine.network.relays.values_mut() {
        relay.max_reqs = 8;
    }
    f.open("feed", list);
    f.seek("feed", AT, before, after);
    f.hint(&["feed"]);
    for _ in 0..3 {
        f.tick(150);
    }
}

#[test]
fn newer_narrows_despite_a_full_window_then_grows_with_sorted_deduped_ties() {
    let actor = generate_secret_key();
    let owner = generate_secret_key();
    let cached = sign(&actor, 1, 120, "cached", vec![]);
    let list = sign(
        &owner,
        3,
        150,
        "",
        vec![vec!["p".into(), cached.pubkey.clone()]],
    );
    let [far, overlap, near_a, near_b, outside, older] = [
        (173, "far"),
        (160, "overlap"),
        (101, "tie-a"),
        (101, "tie-b"),
        (201, "future"),
        (100, "pivot"),
    ]
    .map(|(at, text)| sign(&actor, 1, at, text, vec![]));
    let mut f = RelayFixture::new(&[A, B]);
    f.engine.store.insert(cached.clone(), None);
    start(&mut f, &list, 1, 1);
    let first = latest(&f, A);
    assert_eq!(
        first[2],
        json!({"authors":[cached.pubkey],"kinds":[1,6],"since":101,"until":200,"limit":3})
    );
    assert!(f.report("feed").get("key").is_none());
    f.receive(A, json!(["EVENT", first[1], outside]));
    f.receive(A, json!(["EVENT", first[1], older]));
    f.page(A, &first[1], &[&far, &overlap, &cached, &cached]);
    f.tick(150);
    assert_eq!(f.report("feed")["newer"], "loading");
    assert!(f.report("feed").get("key").is_none());
    assert!(f.engine.store.get(&outside.id).is_none());
    assert!(f.engine.store.get(&older.id).is_none());
    f.tick(150);
    let next = latest(&f, A);
    assert_ne!(next[1], first[1]);
    assert_eq!(next[2]["until"], cached.created_at);
    f.page(A, &next[1], &[&cached, &near_a, &near_b]);
    f.tick(150);
    f.tick(150);
    let boundary = latest(&f, A);
    assert_eq!(boundary[2]["until"], 101);
    assert_eq!(boundary[2]["since"], 101);
    f.page(A, &boundary[1], &[&near_a, &near_b]);
    let peer = latest(&f, B);
    f.page(B, &peer[1], &[&near_a]);
    f.tick(150);
    assert_eq!(f.report("feed")["newer"], "end");
    assert_eq!(
        f.report("feed")["key"],
        near_a.id.as_str().min(near_b.id.as_str())
    );

    f.tick(6_000);
    assert_eq!(f.report("feed")["older"], "stalled");
    assert_eq!(f.report("feed")["newer"], "end");
    f.seek("feed", AT, 5, 1);
    let mut ties = [&near_a.id, &near_b.id];
    ties.sort_unstable_by(|a, b| b.cmp(a));
    assert_eq!(
        f.rows("feed"),
        [&far.id, &overlap.id, &cached.id, ties[0], ties[1]].map(|id| id.clone())
    );
    assert_eq!(f.report("feed")["key"], *ties[1]);
    assert_eq!(requests(&f, A, 101).len(), 3);
    assert_eq!(requests(&f, B, 101).len(), 1);
}

#[test]
fn stale_newer_envelopes_cannot_settle_exact_pivot_or_list_replacements() {
    let (owner, list, [older, _, _, _, newer, _]) = fixtures();
    let mut f = RelayFixture::new(&[A, B]);
    start(&mut f, &list, 2, 1);
    let previous = latest(&f, A);
    let moved_at = AT - 1;
    f.seek("feed", moved_at, 2, 1);
    for _ in 0..3 {
        f.tick(150);
    }
    let moved = latest(&f, A);
    assert_eq!(moved[2], previous[2]);
    assert_ne!(moved[1], previous[1]);
    assert!(f.closed(A, &previous));
    f.page(A, &previous[1], &[&newer]);
    f.tick(150);
    assert!(f.engine.store.get(&newer.id).is_none());
    assert_eq!(f.report("feed")["at"], moved_at);
    assert_eq!(f.report("feed")["newer"], "loading");

    let watch = f.request(A, 3);
    let replacement = sign(&owner, 3, 151, "", list.tags.clone());
    f.receive(A, json!(["EVENT", watch[1], replacement]));
    for _ in 0..3 {
        f.tick(150);
    }
    let current = latest(&f, A);
    assert!(f.closed(A, &moved));
    assert_eq!(f.report("feed")["followList"]["id"], replacement.id);
    assert_ne!(current[1], moved[1]);
    assert_eq!(current[2]["until"], 200);
    f.page(A, &moved[1], &[&newer]);
    f.tick(150);
    assert_eq!(f.report("feed")["newer"], "loading");
    assert!(f.engine.store.get(&newer.id).is_none());
    for relay in [A, B] {
        let old_edge = requests(&f, relay, 81).pop().unwrap();
        f.page(relay, &old_edge[1], &[&older]);
    }
    f.page(A, &current[1], &[&newer]);
    let failed = latest(&f, B);
    f.receive(
        B,
        json!(["CLOSED", failed[1], "error: fixture refused newer"]),
    );
    f.tick(150);
    assert_eq!(f.report("feed")["older"], "end");
    assert_eq!(f.report("feed")["newer"], "stalled");
    f.seek("feed", moved_at, 2, 1);
    assert_eq!(f.rows("feed"), [newer.id, older.id]);
}

#[test]
fn newer_seeks_under_a_saturated_second_but_keeps_partial_evidence() {
    let actor = generate_secret_key();
    let owner = generate_secret_key();
    let ties = ["a", "b", "c"].map(|label| sign(&actor, 1, 200, label, vec![]));
    let near = sign(&actor, 1, 101, "nearest", vec![]);
    let list = sign(
        &owner,
        3,
        151,
        "",
        vec![vec!["p".into(), near.pubkey.clone()]],
    );
    let mut f = RelayFixture::new(&[A]);
    start(&mut f, &list, 1, 0);
    let first = latest(&f, A);
    f.page(A, &first[1], &ties.each_ref());
    f.tick(150);
    f.tick(150);
    let next = latest(&f, A);
    assert_eq!(next[2]["until"], 199);
    f.page(A, &next[1], &[&near]);
    f.tick(150);
    assert_eq!(f.report("feed")["newer"], "partial");
    assert!(f.report("feed").get("key").is_none());
    f.seek("feed", AT, 1, 0);
    assert_eq!(f.rows("feed"), [near.id]);
}

#[path = "engine_time_newer_cap/case.rs"]
mod cap;
