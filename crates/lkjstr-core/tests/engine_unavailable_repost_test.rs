#![allow(clippy::unwrap_used)]
mod engine_search_support;
use engine_search_support::*;
use lkjstr_core::engine::{global, network::Effect, protocol::Input};
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn requests(f: &mut Fixture) -> Vec<Value> {
    let relay = "wss://fixture.test/";
    f.engine.input(
        Input::Configure {
            relays: vec![relay.into()],
        },
        f.now,
    );
    f.engine.network.connected(relay, f.now);
    let mut filters = Vec::new();
    for _ in 0..20 {
        f.now += 100;
        f.engine.tick(f.now);
        f.draw();
        for effect in f.engine.network.drain_effects() {
            if let Effect::Send(_, text) = effect {
                let frame: Value = serde_json::from_str(&text).unwrap();
                if frame[0] == "REQ" {
                    filters.extend(frame.as_array().unwrap().iter().skip(2).cloned());
                    f.engine.network.message(
                        relay,
                        &json!(["EOSE", frame[1]]).to_string(),
                        f.now + 1,
                    );
                }
            }
        }
    }
    filters
}
fn ids(filters: &[Value]) -> BTreeSet<&str> {
    filters
        .iter()
        .flat_map(|filter| {
            filter["ids"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
        })
        .collect()
}

#[test]
fn unavailable_global_wrappers_do_not_consume_author_slots() {
    let mut f = Fixture::new(vec![profile(2, 100, "alice", "blue", "")]);
    let mut ordered = Vec::new();
    for at in (4..=6).rev() {
        ordered.push(event(
            2,
            6,
            at,
            "",
            vec![vec!["e".into(), format!("{at:064x}")]],
        ));
    }
    for at in (1..=3).rev() {
        ordered.push(event(
            2,
            1,
            at,
            &format!("distinct short note {at}"),
            vec![],
        ));
    }
    for event in ordered {
        f.engine.store.insert(event, None);
    }
    let events = f.engine.store.feed(&lkjstr_core::store::Query {
        kinds: vec![1, 6],
        limit: 10,
        ..Default::default()
    });
    let held = global::classify(&f.engine.store, &events, |_| false);
    assert_eq!(held.iter().filter(|value| value.is_none()).count(), 3);
    assert!(held[..3].iter().all(Option::is_some));
}

#[test]
fn unavailable_targets_have_a_distinct_bound_without_displacing_visible_quotes() {
    let quote = "cf".repeat(32);
    let visible = event(
        2,
        1,
        1_700_000_000,
        "alice blue note",
        vec![vec!["q".into(), quote.clone()]],
    );
    let mut events = vec![visible.clone(), profile(2, 100, "alice", "blue", "")];
    for index in 1..=125_u64 {
        events.push(event(
            3,
            6,
            1_700_000_000 + index,
            "",
            vec![vec!["e".into(), format!("{index:064x}")]],
        ));
    }
    for index in 126..=135_u64 {
        events.push(event(
            3,
            6,
            1_700_000_000 + index,
            "",
            vec![vec!["e".into(), format!("{:064x}", 125_u64)]],
        ));
    }
    events.push(event(3, 6, 1_700_000_140, "", vec![]));
    events.push(event(
        3,
        6,
        1_700_000_141,
        "",
        vec![vec!["e".into(), "invalid".into()]],
    ));
    let mut f = Fixture::new(events);
    f.open(1);
    f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":1}));
    let filters = requests(&mut f);
    let fetched = ids(&filters);
    assert_eq!(f.notes(), vec![visible.id.as_str()]);
    assert!(fetched.contains(quote.as_str()));
    assert_eq!(
        fetched.len(),
        121,
        "120 distinct missing repost targets plus the visible quote"
    );
    assert!(
        !filters.iter().any(|filter| filter["kinds"]
            .as_array()
            .is_some_and(|kinds| kinds.contains(&json!(0)))
            && filter["authors"]
                .as_array()
                .is_some_and(|authors| authors.contains(&json!(pubkey(3))))),
        "unavailable wrapper authors wait until a target can become visible"
    );
    f.input(json!({"t":"close","sub":"s"}));
    assert_eq!(f.engine.network.request_stats(), json!([]));
}

#[test]
fn anchoring_the_first_note_keeps_adjacent_unavailable_target_demand() {
    let target = note(3, 1_700_000_003);
    let first = note(2, 1_700_000_002);
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        first.clone(),
        note(2, 1_700_000_001),
        event(
            3,
            6,
            1_700_000_004,
            "",
            vec![vec!["e".into(), target.id.clone()]],
        ),
    ]);
    f.open(1);
    f.input(json!({"t":"window","sub":"s","anchor":{"key":first.id},"before":0,"after":1}));
    let filters = requests(&mut f);
    assert!(ids(&filters).contains(target.id.as_str()));
    assert_eq!(f.fresh(), 0);
    f.change(target.clone());
    assert_eq!(
        f.notes(),
        vec![first.id.as_str()],
        "target arrival preserves the held note"
    );
    assert_eq!(f.fresh(), 1);
    f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":1}));
    assert_eq!(f.notes(), vec![target.id.as_str()]);
}
