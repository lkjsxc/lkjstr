#![allow(clippy::expect_used)]
mod engine_read_union_support;
mod engine_review_support;
use engine_read_union_support::{NOW, R, event};
use engine_review_support::{accept, output};
use lkjstr_core::engine::{
    Engine,
    wire::{self, Session},
};
use serde_json::json;

#[test]
fn notification_queue_delivers_before_bulk_verification_without_eose_or_hydration() {
    let owner = event(1, 1, 1, vec![]).pubkey;
    let mut e = Engine::new();
    let mut session = Session::default();
    for source in ["notifications", "home", "global", "their-home"] {
        accept(
            &mut session,
            &mut e,
            json!({"t":"open","sub":source,"query":{
                "source":source,"account":owner,"target":owner,"notifications":true
            }}),
            NOW,
        );
    }
    output(&mut session, &mut e);
    for i in 0..1024 {
        e.enqueue("cache".into(), event(2, NOW / 1000 - i - 1, 1, vec![]));
    }
    let notification = event(
        3,
        NOW / 1000,
        7,
        vec![
            vec!["p".into(), owner.clone()],
            vec!["e".into(), "c".repeat(64)],
        ],
    );
    e.enqueue(R.into(), notification.clone());
    let mut first_verified = None;
    let mut first_rows = std::collections::BTreeMap::new();
    for turn in 1..=40 {
        e.tick(NOW + 25 + (turn - 1) * 4);
        if e.store.get(&notification.id).is_some() {
            first_verified.get_or_insert(turn);
        }
        for message in output(&mut session, &mut e) {
            if message["t"] == "rows"
                && message["rows"]
                    .as_array()
                    .is_some_and(|rows| rows.iter().any(|row| row["kind"] == "notification"))
            {
                first_rows
                    .entry(message["sub"].as_str().expect("sub").to_owned())
                    .or_insert(turn);
            }
            if message["t"] == "patch" && message.to_string().contains("notification:") {
                first_rows
                    .entry(message["sub"].as_str().expect("sub").to_owned())
                    .or_insert(turn);
            }
        }
        if first_verified.is_some() && first_rows.len() == 4 {
            break;
        }
    }
    eprintln!(
        "1024 bulk events: first verified notification slice={first_verified:?}; projected slices={first_rows:?}"
    );
    assert_eq!(first_verified, Some(1));
    assert_eq!(wire::unread_count(&e, &owner), 1);
    assert_eq!(first_rows.len(), 4);
    assert!(first_rows.values().all(|turn| *turn == 1));
    assert!(
        e.store.get(&"c".repeat(64)).is_none(),
        "subject hydration remains unresolved"
    );
}

#[test]
fn notification_queue_keeps_fifo_progress_and_rejects_forged_priority_candidates() {
    let owner = event(1, 1, 1, vec![]).pubkey;
    let mut e = Engine::new();
    e.discover_account(Some(owner.clone()), vec![], NOW);
    let bulk: Vec<_> = (0..64)
        .map(|i| event(2, NOW / 1000 - i - 1, 1, vec![]))
        .collect();
    for note in &bulk {
        e.enqueue("cache".into(), note.clone());
    }
    for i in 0..16 {
        let mut forged = event(3, NOW / 1000 - i, 7, vec![vec!["p".into(), owner.clone()]]);
        forged.sig = "0".repeat(128);
        e.enqueue(R.into(), forged);
    }
    for (turn, count) in [(1, 24), (2, 48)] {
        e.tick(NOW + turn * 25);
        assert_eq!(
            e.store.len(),
            count,
            "forged priority traffic cannot consume the FIFO share or enter the store"
        );
        assert!(
            bulk[..count]
                .iter()
                .all(|note| e.store.get(&note.id).is_some())
        );
        assert!(e.store.get(&bulk[count].id).is_none());
        assert_eq!(
            wire::unread_count(&e, &owner),
            0,
            "unverified tags cannot supply unread"
        );
    }
    e.tick(NOW + 75);
    assert!(bulk.iter().all(|note| e.store.get(&note.id).is_some()));
    assert_eq!(e.store.len(), 64);
}

#[test]
fn notification_queue_drops_priority_when_the_account_is_removed() {
    let owner = event(1, 1, 1, vec![]).pubkey;
    let mut e = Engine::new();
    e.discover_account(Some(owner.clone()), vec![], NOW);
    for i in 0..32 {
        e.enqueue("cache".into(), event(2, NOW / 1000 - i - 1, 1, vec![]));
    }
    let old = event(3, NOW / 1000, 7, vec![vec!["p".into(), owner]]);
    e.enqueue(R.into(), old.clone());
    e.discover_account(Some(event(4, 1, 1, vec![]).pubkey), vec![], NOW + 1);
    e.tick(NOW + 25);
    assert!(
        e.store.get(&old.id).is_none(),
        "an old account cannot retain queue priority"
    );
    e.tick(NOW + 50);
    assert!(
        e.store.get(&old.id).is_some(),
        "ordinary FIFO verification still completes"
    );
}
