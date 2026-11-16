#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::engine::{Engine, network::Effect, protocol::Query};
use lkjstr_protocol::{NostrFilter, matches_filter, parse_filter_value};
use serde_json::{Value, json};
// Scheduler milliseconds are later than the fixture's signed event seconds.
const BASE_MS: u64 = 200_000;
const R: &str = "wss://resume.test/";
fn reqs(e: &mut Engine) -> Vec<Value> {
    e.network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(_, s) => {
                let v: Value = serde_json::from_str(&s).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
#[test]
fn exact_verified_duplicates_advance_resume_without_usefulness_credit() {
    let mut e = Engine::new();
    e.network.configure(vec![R.into()], BASE_MS);
    e.network.relays.get_mut(R).expect("relay").max_reqs = 1;
    let head = NostrFilter {
        kinds: Some(vec![1, 6]),
        limit: Some(200),
        ..Default::default()
    };
    let feed = ("feed".into(), head, Query::default());
    e.network.plan(vec![feed.clone()], &e.store, BASE_MS);
    e.network.connected(R, BASE_MS);
    let initial = reqs(&mut e).remove(0);
    let notes: Vec<_> = [1, 50, 100]
        .map(|at| event(at, 1, "already verified", vec![]))
        .into();
    for note in &notes {
        e.store.insert(note.clone(), Some("cache"));
        e.enqueue(R.into(), note.clone());
    }
    let mut forged = notes[2].clone();
    forged.created_at = 9000;
    forged.content = "altered".into();
    e.enqueue(R.into(), forged);
    assert_eq!(e.network.relays[R].useful, 0);
    e.network
        .message(R, &json!(["EOSE", initial[1]]).to_string(), BASE_MS + 1);
    let profile = NostrFilter {
        kinds: Some(vec![0]),
        authors: Some(vec!["a".repeat(64)]),
        limit: Some(1),
        ..Default::default()
    };
    e.network.plan(
        vec![feed, ("name".into(), profile, Query::default())],
        &e.store,
        BASE_MS + 100,
    );
    e.network.tick(BASE_MS + 175);
    let lookup = reqs(&mut e).remove(0);
    e.network
        .message(R, &json!(["EOSE", lookup[1]]).to_string(), BASE_MS + 176);
    e.network.tick(BASE_MS + 275);
    let resumed = reqs(&mut e).remove(0);
    let f = parse_filter_value(&resumed[2]).expect("filter");
    let duplicates = notes.iter().filter(|n| matches_filter(n, &f)).count();
    if std::env::var_os("LKJSTR_COVER_BASELINE").is_none() {
        assert_eq!(f.since, Some(98));
        assert_eq!(duplicates, 1);
    }
    assert_eq!(e.network.relays[R].useful, 0);
    assert_eq!(e.network.relays[R].duplicates, 4);
    println!(
        "verified-copy resume REQs=3 connections=1 verified_notes=3 duplicate_replay={duplicates} boundary_overlap_seconds=2"
    );
}
