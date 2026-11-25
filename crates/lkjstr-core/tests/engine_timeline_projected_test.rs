#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};
const NOW: u64 = 1_800_000_000_000;
fn timeline(s: &mut Session, e: &Engine) -> Value {
    let mut result = Value::Null;
    for i in 0..100 {
        for out in s.timeline_tick(e, NOW + i * 25) {
            result = serde_json::to_value(out).expect("timeline")["timeline"].clone();
        }
    }
    result
}
fn counted(data: &Value) -> u64 {
    data["months"]
        .as_array()
        .expect("months")
        .iter()
        .map(|m| m["count"].as_u64().expect("count"))
        .sum()
}
fn rows(out: &[Value]) -> Vec<Value> {
    out.iter()
        .rev()
        .find(|r| r["t"] == "rows")
        .and_then(|r| r["rows"].as_array().cloned())
        .expect("rows")
}
/// Owner note at 1600000000; mentions at three months; two reactions to the same note group to one row.
fn notified() -> (Engine, String) {
    let mut e = Engine::new();
    let owner = event(1_600_000_000, 1, "owner", vec![]);
    let p = vec!["p".to_string(), owner.pubkey.clone()];
    e.store.insert(owner.clone(), None);
    for at in [1_700_000_000, 1_650_000_000, 1_620_000_000] {
        e.store.insert(event(at, 1, "hello", vec![p.clone()]), None);
    }
    let on = vec!["e".to_string(), owner.id.clone()];
    for at in [1_690_000_000, 1_691_000_000] {
        e.store
            .insert(event(at, 7, "+", vec![on.clone(), p.clone()]), None);
    }
    (e, owner.pubkey)
}
fn opened(e: &mut Engine, query: Value) -> (Session, Vec<Value>) {
    let mut s = Session::default();
    accept(&mut s, e, json!({"t":"open","sub":"s","query":query}), 0);
    accept(
        &mut s,
        e,
        json!({"t":"window","sub":"s","anchor":"top","before":0,"after":2}),
        0,
    );
    let out = output(&mut s, e);
    (s, out)
}
#[test]
fn grouped_notifications_index_their_rows_and_seek_to_a_group() {
    let (mut e, owner) = notified();
    let (mut s, out) = opened(&mut e, json!({"source":"notifications","account":owner}));
    let shown = rows(&out);
    let data = timeline(&mut s, &e);
    assert_eq!(data["supported"], true);
    // Three mentions plus one reaction group: what the full projection draws, not five events.
    assert_eq!(counted(&data), 4);
    for p in data["positions"].as_array().expect("positions") {
        assert!(shown.iter().any(|r| r["key"] == p["key"]), "{p}");
    }
    let oldest = data["months"]
        .as_array()
        .expect("months")
        .last()
        .expect("month")["at"]
        .clone();
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":{"month":oldest,"offset":0},"before":0,"after":1}),
        0,
    );
    let landed = rows(&output(&mut s, &mut e));
    assert_eq!(landed[0]["at"], 1_620_000_000_000u64);
}
#[test]
fn a_home_with_notifications_counts_notes_and_groups_once_in_window_order() {
    let (mut e, owner) = notified();
    let (mut s, out) = opened(
        &mut e,
        json!({"source":"home","account":owner,"notifications":true}),
    );
    let data = timeline(&mut s, &e);
    assert_eq!(data["supported"], true);
    // The owner's own note, three mentions and one reaction group.
    assert_eq!(counted(&data), 5);
    let shown = rows(&out);
    let first = data["positions"].as_array().expect("positions")[0].clone();
    assert_eq!(first["key"], shown[0]["key"]);
    assert_eq!(first["month"], data["months"][0]["at"]);
    assert_eq!(first["offset"], 0);
    assert_eq!(first["at"], 1_700_000_000_000u64);
}
fn month_of(at: u64, data: &Value) -> bool {
    data["months"][0]["at"]
        .as_u64()
        .is_some_and(|m| m <= at && at - m < 31 * 86_400_000)
}
#[test]
fn profile_reactions_and_reposts_take_the_rail_by_act_time() {
    let mut e = Engine::new();
    let note = event(1_600_000_000, 1, "liked", vec![]);
    e.store.insert(note.clone(), None);
    let on = vec!["e".to_string(), note.id.clone()];
    let reaction = event(1_700_000_000, 7, "+", vec![on.clone()]);
    e.store.insert(reaction.clone(), None);
    for show in ["reactions", "reposts"] {
        let (mut s, _) = opened(
            &mut e,
            json!({"source":"profile","pubkey":reaction.pubkey,"show":show}),
        );
        let data = timeline(&mut s, &e);
        assert_eq!(data["supported"], true, "{show}");
        if show == "reactions" {
            assert_eq!(counted(&data), 1);
            assert!(month_of(1_700_000_000_000, &data), "{data}");
        }
    }
}
#[test]
fn their_home_uses_the_note_rail_and_signed_out_global_stays_native() {
    let mut e = Engine::new();
    let note = event(1_700_000_000, 1, "hi", vec![]);
    let contacts = event(
        1_700_000_001,
        3,
        "",
        vec![vec!["p".into(), note.pubkey.clone()]],
    );
    e.store.insert(note.clone(), None);
    e.store.insert(contacts.clone(), None);
    let (mut s, _) = opened(
        &mut e,
        json!({"source":"their-home","pubkey":contacts.pubkey}),
    );
    let data = timeline(&mut s, &e);
    assert_eq!(data["supported"], true);
    assert_eq!(counted(&data), 1);
    let (mut s, _) = opened(&mut e, json!({"source":"global"}));
    assert_eq!(timeline(&mut s, &e)["supported"], false);
}
#[test]
fn profile_articles_lists_and_all_index_openable_events_by_authored_time() {
    let mut e = Engine::new();
    let note = event(1_600_000_000, 1, "note", vec![]);
    let mut article = event(
        1_650_000_000,
        30023,
        "long form",
        vec![vec!["d".into(), "a1".into()]],
    );
    article.pubkey = note.pubkey.clone();
    let mut list = event(
        1_700_000_000,
        30000,
        "",
        vec![vec!["d".into(), "friends".into()]],
    );
    list.pubkey = note.pubkey.clone();
    e.store.insert(note.clone(), None);
    e.store.insert(article, None);
    e.store.insert(list, None);
    for (show, expected) in [("articles", 1), ("lists", 1), ("all", 3)] {
        let (mut s, _) = opened(
            &mut e,
            json!({"source":"profile","pubkey":note.pubkey,"show":show}),
        );
        let data = timeline(&mut s, &e);
        assert_eq!(data["supported"], true, "{show}");
        assert_eq!(counted(&data), expected, "{show}");
    }
}
#[test]
fn search_indexes_matching_notes_without_counting_directory_people() {
    let mut e = Engine::new();
    let mut profile = event(1_700_000_000, 0, r#"{"name":"nostrdev"}"#, vec![]);
    let mut n1 = event(1_700_000_100, 1, "nostr rail new", vec![]);
    let mut n2 = event(1_620_000_100, 1, "nostr rail old", vec![]);
    profile.pubkey = n1.pubkey.clone();
    n2.pubkey = n1.pubkey.clone();
    n1.id = format!("{:064x}", 11);
    n2.id = format!("{:064x}", 12);
    e.store.insert(profile, None);
    e.store.insert(n1, None);
    e.store.insert(n2, None);
    let (mut s, out) = opened(&mut e, json!({"source":"search","text":"nostr"}));
    let shown = rows(&out);
    assert!(shown.iter().any(|r| r["kind"] == "person"));
    let data = timeline(&mut s, &e);
    assert_eq!(data["supported"], true);
    assert_eq!(counted(&data), 2);
    let oldest = data["months"]
        .as_array()
        .expect("months")
        .last()
        .expect("month")["at"]
        .clone();
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"s","anchor":{"month":oldest,"offset":0},"before":0,"after":1}),
        0,
    );
    let landed = rows(&output(&mut s, &mut e));
    assert_eq!(landed[0]["at"], 1_620_000_100_000u64);
}
