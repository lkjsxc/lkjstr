#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    wire::{Input, Output, Session},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
fn signed(kind: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: "fixture".into(),
            tags,
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
fn rows(e: &mut Engine, query: Value) -> Vec<Value> {
    let mut s = Session::default();
    for i in s
        .input(
            serde_json::from_value::<Input>(json!({"t":"open","sub":"test","query":query}))
                .expect("input"),
            e,
        )
        .expect("supported")
    {
        e.input(i, 100);
    }
    e.drain()
        .into_iter()
        .flat_map(|o| s.output(o, e))
        .filter_map(|o| match o {
            Output::Rows { rows, .. } => Some(rows),
            _ => None,
        })
        .flatten()
        .collect()
}
#[test]
fn unqueried_counts_are_unknown_and_observations_are_lower_bounds() {
    let mut e = Engine::new();
    let note = signed(1, vec![]);
    e.store.insert(note.clone(), None);
    let first = rows(&mut e, json!({"source":"global"}));
    for field in ["replies", "reposts", "reactions", "zaps"] {
        assert_eq!(first[0]["counts"][field], -1);
        assert_eq!(
            first[0]["counts"]["estimates"][field],
            json!({"state":"unknown"})
        );
    }
    for kind in [1, 6, 7] {
        e.store.insert(
            signed(
                kind,
                vec![vec!["e".into(), note.id.clone(), "".into(), "reply".into()]],
            ),
            None,
        );
    }
    let result = rows(&mut e, json!({"source":"global","authors":[note.pubkey]}));
    for field in ["replies", "reposts", "reactions"] {
        assert_eq!(
            result[0]["counts"]["estimates"][field],
            json!({"state":"at-least","value":1})
        );
    }
}
#[test]
fn profile_empty_follow_list_is_exact_zero_but_missing_list_is_unknown() {
    let mut e = Engine::new();
    let contact = signed(3, vec![]);
    let p = contact.pubkey.clone();
    let before = rows(&mut e, json!({"source":"profile","pubkey":p}));
    for field in ["following", "followers", "notes"] {
        assert_eq!(before[0][field], -1);
        assert_eq!(before[0]["countEstimates"][field]["state"], "unknown");
    }
    e.store.insert(contact, None);
    let after = rows(&mut e, json!({"source":"profile","pubkey":p}));
    assert_eq!(after[0]["following"], 0);
    assert_eq!(
        after[0]["countEstimates"]["following"],
        json!({"state":"exact","value":0})
    );
    assert_eq!(after[0]["followers"], -1);
}
