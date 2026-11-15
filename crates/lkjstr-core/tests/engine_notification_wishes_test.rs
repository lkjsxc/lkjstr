#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::Engine;

#[test]
fn notification_read_mark_remembers_timestamp_ties_across_reload() {
    let me = "aa".repeat(32);
    let mut e = Engine::new();
    let mut reaction = event(5, 7, "+", vec![vec!["p".into(), me.clone()]]);
    reaction.pubkey = "bb".repeat(32);
    e.store.insert(reaction, None);
    let (at, ties) = lkjstr_core::engine::wire::notification_watermark(&e, &me);
    e.seen.insert(me.clone(), at);
    e.notification_ties.insert(me.clone(), ties);
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 0);
    let mut later = event(
        5,
        7,
        "+",
        vec![
            vec!["p".into(), me.clone()],
            vec!["e".into(), "cc".repeat(32)],
        ],
    );
    later.pubkey = "dd".repeat(32);
    e.store.insert(later, None);
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 1);
    let accounts = lkjstr_core::engine::accounts::Accounts {
        seen: e.seen.clone(),
        notification_ties: e.notification_ties.clone(),
        ..Default::default()
    };
    let restored: lkjstr_core::engine::accounts::Accounts =
        serde_json::from_str(&serde_json::to_string(&accounts).expect("save")).expect("reload");
    e.seen = restored.seen;
    e.notification_ties = restored.notification_ties;
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 1);
}
