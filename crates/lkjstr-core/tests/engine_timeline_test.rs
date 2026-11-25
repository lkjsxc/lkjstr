#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};
fn timeline(s: &mut Session, e: &Engine, now: u64) -> Value {
    let mut result = Value::Null;
    for i in 0..100 {
        for out in s.timeline_tick(e, now + i * 25) {
            result = serde_json::to_value(out).expect("timeline")["timeline"].clone();
        }
    }
    result
}
#[test]
fn counts_cover_the_retained_store_not_the_window_and_seek_uses_the_same_ties() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let owner = event(1700000000, 1, "new", vec![]);
    for (i, at) in [1700000000, 1700000000, 1600000000, 0, 2100000000]
        .into_iter()
        .enumerate()
    {
        let mut note = owner.clone();
        note.id = format!("{i:064x}");
        note.created_at = at;
        e.store.insert(note, None);
    }
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"s","query":{"source":"home","account":owner.pubkey}}),
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":"top","before":0,"after":1}),
        0,
    );
    output(&mut s, &mut e);
    let data = timeline(&mut s, &e, 1800000000000);
    assert_eq!(data["supported"], true);
    assert_eq!(data["months"].as_array().expect("months").len(), 4);
    assert_eq!(
        data["months"]
            .as_array()
            .expect("months")
            .iter()
            .map(|m| m["count"].as_u64().expect("count"))
            .sum::<u64>(),
        5
    );
    assert_eq!(data["positions"].as_array().expect("positions").len(), 1);
    assert_eq!(data["months"][3]["at"], 0);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":{"month":1698796800000u64,"offset":1},"before":0,"after":1}),
        0,
    );
    let out = output(&mut s, &mut e);
    let rows = out.iter().find(|r| r["t"] == "rows").expect("rows");
    assert_eq!(rows["rows"][0]["key"], format!("{:064x}", 0));
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":{"month":0,"offset":0},"before":0,"after":60}),
        0,
    );
    let out = output(&mut s, &mut e);
    assert_eq!(
        out.iter().find(|r| r["t"] == "rows").expect("rows")["rows"][0]["at"],
        0
    );
}
#[test]
fn invalidation_is_debounced_and_close_releases_counts() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let note = event(1700000000, 1, "hello", vec![]);
    e.store.insert(note.clone(), None);
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"s","query":{"source":"profile","pubkey":note.pubkey}}),
        0,
    );
    output(&mut s, &mut e);
    assert!(timeline(&mut s, &e, 1800000000000)["supported"] == true);
    assert!(s.timeline_tick(&e, 1800000003000).is_empty());
    let mut old = note;
    old.id = format!("{:064x}", 999);
    old.created_at = 0;
    e.store.insert(old, None);
    assert!(s.timeline_tick(&e, 1800000003100).is_empty());
    let data = timeline(&mut s, &e, 1800000003200);
    assert_eq!(data["months"].as_array().expect("months").len(), 2);
    accept(&mut s, &mut e, json!({"t":"close","sub":"s"}), 0);
    assert!(s.timeline_tick(&e, 1800000010000).is_empty());
}
#[test]
fn grouped_and_non_note_sources_keep_native_scrollbars() {
    let owner = event(1700000000, 1, "owner", vec![]);
    for query in [
        json!({"source":"notifications","account":owner.pubkey}),
        json!({"source":"home","account":owner.pubkey,"notifications":true}),
        json!({"source":"thread"}),
        json!({"source":"bookmarks"}),
        json!({"source":"list"}),
        json!({"source":"global"}),
    ] {
        let mut e = Engine::new();
        let mut s = Session::default();
        e.store.insert(owner.clone(), None);
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":"s","query":query}),
            0,
        );
        assert_eq!(timeline(&mut s, &e, 1800000000000)["supported"], false);
    }
}
#[test]
fn all_retained_rows_beyond_six_thousand_are_counted_and_seekable() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let base = event(1700000000, 1, "retained", vec![]);
    for i in 0..7000 {
        let mut n = base.clone();
        n.id = format!("{i:064x}");
        n.created_at = 1700000000 + i;
        e.store.insert(n, None);
    }
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"s","query":{"source":"home","account":base.pubkey}}),
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":"top","before":0,"after":1}),
        0,
    );
    output(&mut s, &mut e);
    let data = timeline(&mut s, &e, 1800000000000);
    assert_eq!(data["months"][0]["count"], 7000);
    let origin = format!("{:064x}", 6999);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":{"month":1698796800000u64,"offset":6999,"returnKey":origin},"before":0,"after":1}),
        0,
    );
    let out = output(&mut s, &mut e);
    assert_eq!(
        out.iter().find(|m| m["t"] == "rows").expect("rows")["rows"][0]["key"],
        format!("{:064x}", 0)
    );
    let mut newest = base;
    newest.id = format!("{:064x}", 8000);
    newest.created_at = 1700008000;
    e.store.insert(newest, None);
    assert!(s.timeline_tick(&e, 1800000004000).is_empty());
    // An ordinal from the last published counts remains usable while the next scan runs.
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":{"month":1698796800000u64,"offset":6999},"before":0,"after":1}),
        0,
    );
    output(&mut s, &mut e);
    let data = timeline(&mut s, &e, 1800000004100);
    assert_eq!(data["months"][0]["count"], 7001);
    assert!(
        data["positions"]
            .as_array()
            .expect("positions")
            .iter()
            .any(|p| p["key"] == origin && p["offset"] == 1)
    );
}
#[test]
fn incomplete_disk_history_and_hidden_clients_do_not_claim_a_full_rail() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let note = event(1700000000, 1, "cached", vec![]);
    e.store.insert(note.clone(), None);
    e.cached_history_complete = false;
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"s","query":{"source":"profile","pubkey":note.pubkey}}),
        0,
    );
    assert_eq!(timeline(&mut s, &e, 1800000000000)["supported"], false);
    accept(
        &mut s,
        &mut e,
        json!({"t":"hint","hint":{"visibleSubs":[],"pageHidden":true}}),
        0,
    );
    e.store.insert(event(0, 1, "old", vec![]), None);
    assert!(s.timeline_tick(&e, 1800000100000).is_empty());
}

#[test]
fn retention_loss_keeps_native_scrolling_instead_of_claiming_all_disk_notes() {
    let mut e = Engine::new();
    e.store = lkjstr_core::store::Store::with_caps(2, 2);
    let note = event(1700000000, 1, "cached", vec![]);
    for i in 0..3 {
        let mut n = note.clone();
        n.id = format!("{i:064x}");
        n.created_at += i;
        e.store.insert(n, None);
    }
    assert_eq!(e.store.evictions(), 1);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"s","query":{"source":"home","account":note.pubkey}}),
        0,
    );
    assert_eq!(timeline(&mut s, &e, 1800000000000)["supported"], false);
}
