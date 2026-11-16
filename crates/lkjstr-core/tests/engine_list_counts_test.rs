#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{Engine, rows},
    store::Store,
};
#[test]
fn reaction_count_matches_the_reaction_rows_target_set() {
    let a = event(1, 1, "a", vec![]);
    let b = event(2, 1, "b", vec![]);
    let reaction = event(
        3,
        7,
        "+",
        vec![
            vec!["e".into(), a.id.clone()],
            vec!["e".into(), b.id.clone()],
        ],
    );
    let mut store = Store::new(20);
    for e in [&a, &b, &reaction] {
        store.insert(e.clone(), None);
    }
    assert_eq!(store.counts(&a.id).2, store.reactions(&a.id).len());
    assert_eq!(store.counts(&b.id).2, store.reactions(&b.id).len());
}
#[test]
fn reply_count_uses_the_visible_descendants_of_the_thread() {
    let root = event(1, 1, "root", vec![]);
    let child = event(
        2,
        1,
        "child",
        vec![vec!["e".into(), root.id.clone(), "".into(), "reply".into()]],
    );
    let grandchild = event(
        3,
        1,
        "grandchild",
        vec![vec![
            "e".into(),
            child.id.clone(),
            "".into(),
            "reply".into(),
        ]],
    );
    let mut e = Engine::new();
    for row in [&root, &child, &grandchild] {
        e.store.insert(row.clone(), None);
    }
    assert_eq!(rows::row(&e.store, &root, None, 0).counts.replies, 2);
    let mute = event(
        4,
        10000,
        "",
        vec![vec!["p".into(), grandchild.pubkey.clone()]],
    );
    let account = mute.pubkey.clone();
    e.store.insert(mute, None);
    assert_eq!(
        rows::row(&e.store, &root, Some(&account), 0).counts.replies,
        1
    );
}
#[test]
fn bare_receipt_amount_claims_never_supply_trusted_zap_totals() {
    use engine_review_support::{accept, output};
    use lkjstr_core::engine::wire::Session;
    use serde_json::json;
    let root = event(1, 1, "root", vec![]);
    let mut e = Engine::new();
    e.store.insert(root.clone(), None);
    for amount in [21000, 34000] {
        e.store.insert(
            event(
                amount,
                9735,
                "",
                vec![
                    vec!["e".into(), root.id.clone()],
                    vec!["amount".into(), amount.to_string()],
                ],
            ),
            None,
        );
    }
    e.store.insert(
        event(
            3,
            9735,
            "",
            vec![
                vec!["e".into(), root.id.clone()],
                vec!["e".into(), "f".repeat(64)],
                vec!["amount".into(), "99000".into()],
            ],
        ),
        None,
    );
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global"}}),
        0,
    );
    let out = output(&mut s, &mut e);
    let note = out
        .iter()
        .filter_map(|o| o["rows"].as_array())
        .flatten()
        .find(|r| r["id"] == root.id)
        .expect("note");
    assert_eq!(note["counts"]["zaps"], 0);
}
