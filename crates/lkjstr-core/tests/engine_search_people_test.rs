#![allow(clippy::unwrap_used)]
mod engine_search_support;
use engine_search_support::*;
use serde_json::json;
use std::collections::BTreeSet;

fn base() -> Fixture {
    Fixture::new(vec![
        profile(2, 100, "Alice", "Blue", ""),
        profile(3, 100, "ALICE", "", "blue@cached.test"),
        profile(4, 100, "alice", "Green", ""),
        profile(5, 100, "Ａｌｉｃｅ", "Ｂｌｕｅ", ""),
        note(8, 1_700_000_000),
        note(9, 1_700_000_001),
        note(10, 1_700_000_002),
    ])
}
#[test]
fn matching_people_precede_the_note_quota_without_entering_time_counts() {
    let mut f = base();
    f.open(1);
    let people = f.people();
    assert_eq!(people.len(), 3);
    let keys: BTreeSet<_> = people
        .iter()
        .map(|p| p["author"]["pubkey"].as_str().unwrap())
        .collect();
    let expected = [pubkey(2), pubkey(3), pubkey(5)];
    assert_eq!(keys, expected.iter().map(String::as_str).collect());
    assert!(
        people
            .iter()
            .all(|p| p["key"]
                == format!("search-person:{}", p["author"]["pubkey"].as_str().unwrap()))
    );
    assert!(f.rows[..3].iter().all(|p| p["kind"] == "person"));
    assert_eq!(
        f.notes().len(),
        3,
        "people do not consume any of the note window"
    );
    assert_eq!(f.fresh(), 0);
    let timeline = f.timeline();
    assert_eq!(timeline["supported"], true);
    assert_eq!(
        timeline["months"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["count"].as_u64().unwrap())
            .sum::<u64>(),
        3
    );
    assert_eq!(timeline["positions"].as_array().unwrap().len(), 3);
    for after in [0, 1, 2] {
        f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":after}));
        assert_eq!(f.notes().len(), after.max(1));
        assert_eq!(f.people().len(), 3);
    }
}
#[test]
fn metadata_and_live_note_patches_preserve_the_person_prefix_and_note_indexes() {
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        note(8, 1_700_000_000),
        note(9, 1_700_000_001),
        note(10, 1_700_000_002),
    ]);
    f.open(1);
    let notes = f
        .notes()
        .iter()
        .map(|id| (*id).to_owned())
        .collect::<Vec<_>>();
    assert_eq!(f.people().len(), 1);
    f.change(profile(2, 101, "a different name", "", ""));
    assert!(f.people().is_empty());
    assert_eq!(
        f.notes(),
        notes.iter().map(String::as_str).collect::<Vec<_>>()
    );
    assert_eq!(f.fresh(), 0);
    f.change(profile(2, 102, "alice", "blue", ""));
    f.change(profile(3, 102, "alice blue", "", ""));
    assert_eq!(f.people().len(), 2);
    let newest = note(11, 1_700_000_003);
    f.change(newest.clone());
    assert!(f.rows[..2].iter().all(|p| p["kind"] == "person"));
    assert_eq!(
        f.notes(),
        vec![newest.id.as_str(), notes[0].as_str(), notes[1].as_str()]
    );
    assert_eq!(f.fresh(), 0);
    assert_eq!(
        f.rows
            .iter()
            .filter_map(|row| row["key"].as_str())
            .collect::<BTreeSet<_>>()
            .len(),
        f.rows.len()
    );
}
#[test]
fn older_reading_window_counts_only_new_notes_as_fresh() {
    let old = note(8, 1_700_000_000);
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        old.clone(),
        note(9, 1_700_000_001),
        note(10, 1_700_000_002),
        note(11, 1_700_000_003),
    ]);
    f.open(1);
    assert_eq!(f.people().len(), 1);
    f.input(json!({"t":"window","sub":"s","anchor":{"key":old.id},"before":0,"after":0}));
    assert!(f.people().is_empty());
    assert_eq!(f.notes(), vec![old.id.as_str()]);
    assert_eq!(f.fresh(), 3);
    f.change(profile(3, 101, "alice blue", "", ""));
    assert!(f.people().is_empty());
    assert_eq!(f.fresh(), 3, "a matching profile is not an arriving note");
    f.change(note(12, 1_700_000_004));
    assert_eq!(f.fresh(), 4);
    assert_eq!(f.notes(), vec![old.id.as_str()]);
}
#[test]
fn muted_people_are_removed_before_the_six_person_limit() {
    let mute = event(
        1,
        10000,
        100,
        "",
        vec![vec!["p".into(), pubkey(2)], vec!["p".into(), pubkey(3)]],
    );
    let mut events = vec![mute];
    events.extend(
        (2..10).map(|author| profile(author, 100, &format!("alice blue {author:02}"), "", "")),
    );
    let mut f = Fixture::new(events);
    f.open(1);
    assert_eq!(f.people().len(), 6);
    assert!(f.people().iter().all(|row| row["author"]["pubkey"] != pubkey(2) && row["author"]["pubkey"] != pubkey(3)));
}
#[test]
fn only_a_current_delivered_person_header_anchors_the_first_note() {
    let mut f = base();
    f.open(1);
    let header = f.people().first().unwrap()["key"]
        .as_str()
        .unwrap()
        .to_owned();
    let first = f.notes()[0].to_owned();
    assert_eq!(f.anchor(header.clone()), Some(first));
    let unknown = format!("search-person:{}", pubkey(42));
    assert_eq!(f.anchor(unknown.clone()), Some(unknown));
    f.input(json!({"t":"open","sub":"s","query":{"source":"search","account":pubkey(1),"text":"absent match"}}));
    assert_eq!(
        f.anchor(header.clone()),
        Some(header),
        "a replaced query cannot retain its old header identity"
    );
}

#[test]
fn an_anchor_with_retained_before_capacity_keeps_the_top_people_prefix() {
    let held = note(8, 1_700_000_000);
    let mut f = Fixture::new(vec![
        profile(2, 100, "alice", "blue", ""),
        held.clone(),
        note(9, 1_700_000_001),
        note(10, 1_700_000_002),
    ]);
    f.open(1);
    f.input(json!({"t":"window","sub":"s","anchor":{"key":held.id},"before":5,"after":1}));
    for i in 0..3 {
        f.change(note(11 + i, 1_700_000_003 + u64::from(i)));
        assert_eq!(f.people().len(), 1);
        assert_eq!(f.fresh(), 0);
    }
    f.change(note(14, 1_700_000_006));
    assert!(f.people().is_empty());
    assert_eq!(f.fresh(), 1);
    assert_eq!(f.notes().last(), Some(&held.id.as_str()));
}
