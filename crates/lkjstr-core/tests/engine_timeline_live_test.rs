#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event};
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};

const NOW: u64 = 1800000000000;
fn setup() -> (Engine, Session, lkjstr_protocol::NostrEvent) {
    let mut e = Engine::new();
    let mut s = Session::default();
    let base = event(1700000000, 1, "cached", vec![]);
    for i in 0..7000 {
        let mut note = base.clone();
        note.id = format!("{i:064x}");
        note.created_at += i;
        e.store.insert(note, None);
    }
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"s","query":{"source":"home","account":base.pubkey}}),
        0,
    );
    (e, s, base)
}
fn counts(s: &mut Session, e: &Engine, now: u64) -> Vec<u64> {
    s.timeline_tick(e, now)
        .into_iter()
        .map(|out| {
            let data = serde_json::to_value(out).expect("timeline");
            assert_eq!(data["timeline"]["supported"], true);
            data["timeline"]["months"]
                .as_array()
                .expect("months")
                .iter()
                .map(|m| m["count"].as_u64().expect("count"))
                .sum()
        })
        .collect()
}
#[test]
fn live_and_backfilled_notes_do_not_starve_initial_counts_or_rebuilds() {
    let (mut e, mut s, base) = setup();
    let mut published = vec![];
    for turn in 0..160 {
        if turn > 0 && turn % 20 == 0 {
            let mut note = base.clone();
            note.id = format!("{:064x}", 8000 + turn);
            // Exercise both sides of the scan cursor, including equal-time ties.
            note.created_at = if turn % 40 == 0 {
                1700010000
            } else {
                1700000000
            };
            e.store.insert(note, None);
        }
        published.extend(counts(&mut s, &e, NOW + turn * 25));
    }
    assert_eq!(
        published.first(),
        Some(&7000),
        "initial snapshot must finish"
    );
    assert!(
        published.len() >= 4,
        "rebuilds must publish during ingestion"
    );
    assert!(published.windows(2).all(|p| p[0] < p[1]));
    let mut settled = Value::Null;
    for turn in 160..260 {
        for count in counts(&mut s, &e, NOW + turn * 25) {
            settled = json!(count);
        }
    }
    assert_eq!(
        settled, 7007,
        "all arrivals join the next consistent snapshot"
    );
}
#[test]
fn deletion_changes_rail_membership_and_mutes_keep_slots() {
    for mute in [false, true] {
        let (mut e, mut s, base) = setup();
        for turn in 0..10 {
            assert!(counts(&mut s, &e, NOW + turn * 25).is_empty());
        }
        let mut change = if mute {
            event(
                1700020000,
                10000,
                "",
                vec![vec!["p".into(), base.pubkey.clone()]],
            )
        } else {
            event(
                1700020000,
                5,
                "",
                vec![vec!["e".into(), format!("{:064x}", 6999)]],
            )
        };
        change.pubkey = base.pubkey.clone();
        e.store.insert(change, None);
        let mut published = vec![];
        for turn in 10..60 {
            published.extend(counts(&mut s, &e, NOW + turn * 25));
        }
        assert_eq!(published, vec![if mute { 7000 } else { 6999 }]);
    }
}

#[test]
fn resolving_a_repost_target_invalidates_an_already_scanned_wrapper() {
    let (mut e, mut s, base) = setup();
    let mut wrapper = base.clone();
    wrapper.id = format!("{:064x}", 9000);
    wrapper.created_at = 1700020000;
    wrapper.kind = 6;
    let mut target = base;
    target.id = format!("{:064x}", 9001);
    wrapper.tags = vec![vec!["e".into(), target.id.clone()]];
    e.store.insert(wrapper, None);
    for turn in 0..10 {
        assert!(s.timeline_tick(&e, NOW + turn * 25).is_empty());
    }
    e.store.insert(target, None);
    let mut published = vec![];
    for turn in 10..60 {
        published.extend(s.timeline_tick(&e, NOW + turn * 25));
    }
    assert_eq!(published.len(), 1);
    let data = serde_json::to_value(&published[0]).expect("timeline");
    assert_eq!(data["timeline"]["supported"], false);
}
