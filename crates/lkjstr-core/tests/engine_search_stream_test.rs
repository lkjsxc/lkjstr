#![allow(clippy::unwrap_used)]
mod engine_search_support;
use engine_search_support::*;
use serde_json::json;

#[test]
fn an_empty_search_refills_its_note_quota_as_older_notes_and_metadata_arrive() {
    for profile_first in [false, true] {
        let mut f = Fixture::new(vec![]);
        f.open(1);
        f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":2}));
        f.input(json!({"t":"hint","hint":{"visibleSubs":["s"],"pageHidden":false,"idle":false,"saveData":false}}));
        let metadata = profile(2, 1_700_000_000, "alice", "blue", "");
        if profile_first {
            f.change(metadata.clone());
        }
        let newest = note(2, 1_700_000_002);
        let middle = note(2, 1_700_000_001);
        let oldest = note(2, 1_700_000_000);
        f.change(newest.clone());
        assert_eq!(f.notes(), vec![newest.id.as_str()]);
        f.change(middle.clone());
        assert_eq!(
            f.notes(),
            vec![newest.id.as_str(), middle.id.as_str()],
            "native outputs: {:?}",
            f.native_messages
        );
        if !profile_first {
            f.change(metadata);
        }
        f.change(oldest);
        assert_eq!(f.people().len(), 1);
        assert_eq!(f.notes(), vec![newest.id.as_str(), middle.id.as_str()]);
        assert_eq!(f.fresh(), 0);
        let timeline = f.timeline();
        assert_eq!(
            timeline["months"]
                .as_array()
                .unwrap()
                .iter()
                .map(|month| month["count"].as_u64().unwrap())
                .sum::<u64>(),
            3
        );
        assert_eq!(timeline["positions"].as_array().unwrap().len(), 2);
    }
}

#[test]
fn an_unavailable_repost_does_not_consume_the_ordinary_note_window() {
    for source in ["search", "global", "home"] {
        let newest = note(2, 1_700_000_002);
        let middle = note(2, 1_700_000_001);
        let orphan = event(
            2,
            6,
            1_700_000_003,
            "",
            vec![vec!["e".into(), "aa".repeat(32)]],
        );
        let mut f = Fixture::new(vec![
            profile(2, 100, "alice", "blue", ""),
            note(2, 1_700_000_000),
            middle.clone(),
            newest.clone(),
            orphan,
        ]);
        f.now = 1_700_000_004_000;
        f.input(json!({"t":"open","sub":"s","query":{
            "source":source,"account":pubkey(2),
            "text":if source == "search" { Some("alice blue") } else { None }
        }}));
        f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":2}));
        assert_eq!(
            f.notes(),
            vec![newest.id.as_str(), middle.id.as_str()],
            "{source} must refill past a wrapper with no displayable target; native: {:?}",
            f.native_messages
        );
        let timeline = f.timeline();
        assert_eq!(timeline["positions"].as_array().unwrap().len(), 2);
        assert_eq!(
            timeline["months"]
                .as_array()
                .unwrap()
                .iter()
                .map(|month| month["count"].as_u64().unwrap())
                .sum::<u64>(),
            3
        );
    }
}

#[test]
fn unavailable_reposts_neither_count_as_fresh_nor_hide_the_first_note_header() {
    let newest = note(2, 1_700_000_002);
    let middle = note(2, 1_700_000_001);
    let orphan = event(
        2,
        6,
        1_700_000_003,
        "",
        vec![vec!["e".into(), "aa".repeat(32)]],
    );
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        newest.clone(),
        middle.clone(),
        orphan,
    ]);
    f.open(1);
    f.input(json!({"t":"window","sub":"s","anchor":{"key":newest.id},"before":0,"after":1}));
    assert_eq!(
        f.fresh(),
        0,
        "an unavailable wrapper is not a new visible note"
    );
    assert_eq!(f.people().len(), 1);
    f.input(json!({"t":"window","sub":"s","anchor":{"key":middle.id},"before":0,"after":1}));
    assert_eq!(f.fresh(), 1);
    assert!(f.people().is_empty());
}

#[test]
fn retained_before_capacity_crosses_unavailable_wrappers_without_losing_notes() {
    let newest = note(2, 1_700_000_003);
    let middle = note(2, 1_700_000_001);
    let oldest = note(2, 1_700_000_000);
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        newest.clone(),
        middle.clone(),
        oldest.clone(),
        event(
            2,
            6,
            1_700_000_004,
            "",
            vec![vec!["e".into(), "aa".repeat(32)]],
        ),
        event(
            2,
            6,
            1_700_000_002,
            "",
            vec![vec!["e".into(), "bb".repeat(32)]],
        ),
    ]);
    f.open(1);
    f.input(json!({"t":"window","sub":"s","anchor":{"key":oldest.id},"before":2,"after":1}));
    assert_eq!(
        f.notes(),
        vec![newest.id.as_str(), middle.id.as_str(), oldest.id.as_str()]
    );
    assert_eq!(f.fresh(), 0);
    assert_eq!(f.people().len(), 1);
}

#[test]
fn unavailable_target_hydration_remains_owned_without_count_streams_for_the_wrapper() {
    use lkjstr_core::engine::{network::Effect, protocol::Input};
    use serde_json::Value;
    use std::collections::BTreeSet;
    let target = note(3, 1_700_000_003);
    let newest = note(2, 1_700_000_002);
    let wrapper = event(
        3,
        6,
        1_700_000_004,
        "",
        vec![vec!["e".into(), target.id.clone()]],
    );
    let muted_target = "bb".repeat(32);
    let muted = event(
        4,
        6,
        1_700_000_005,
        "",
        vec![vec!["e".into(), muted_target.clone()]],
    );
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        newest.clone(),
        note(2, 1_700_000_001),
        wrapper.clone(),
        muted,
        event(1, 10000, 100, "", vec![vec!["p".into(), pubkey(4)]]),
    ]);
    let relay = "wss://fixture.test/";
    f.engine.input(
        Input::Configure {
            relays: vec![relay.into()],
        },
        f.now,
    );
    f.open(1);
    f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":2}));
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
    let ids: BTreeSet<_> = filters
        .iter()
        .flat_map(|filter| {
            filter["ids"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
        })
        .collect();
    assert!(
        ids.contains(target.id.as_str()),
        "the missing target still needs hydration"
    );
    assert!(
        !ids.contains(muted_target.as_str()),
        "muted wrappers do not create wants"
    );
    assert!(
        !filters.iter().any(|filter| filter["#e"]
            .as_array()
            .is_some_and(|ids| ids.contains(&json!(wrapper.id)))),
        "a wrapper that cannot become a row must not acquire note-count streams"
    );
    f.change(target.clone());
    assert_eq!(f.notes(), vec![target.id.as_str(), newest.id.as_str()]);
    f.input(json!({"t":"close","sub":"s"}));
    assert_eq!(f.engine.network.request_stats(), json!([]));
}
