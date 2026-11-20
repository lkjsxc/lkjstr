#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

fn reply(at: u64, parent: &NostrEvent, root: &NostrEvent) -> NostrEvent {
    event(
        at,
        1,
        "reply",
        vec![
            vec!["e".into(), root.id.clone(), "".into(), "root".into()],
            vec!["e".into(), parent.id.clone(), "".into(), "reply".into()],
        ],
    )
}

fn rows(e: &mut Engine, query: Value, window: Option<Value>) -> Vec<Value> {
    let mut s = Session::default();
    accept(
        &mut s,
        e,
        json!({"t":"open","sub":"thread","query":query}),
        0,
    );
    if let Some(window) = window {
        accept(&mut s, e, window, 1);
    }
    output(&mut s, e)
        .into_iter()
        .rev()
        .find(|m| m["t"] == "rows")
        .expect("rows")["rows"]
        .as_array()
        .expect("array")
        .clone()
}

#[test]
fn ancestors_and_nested_replies_use_relationships_not_timestamps_or_root_tags() {
    let root = event(10, 1, "root", vec![]);
    let parent = reply(20, &root, &root);
    let focus = reply(30, &parent, &root);
    let child = reply(5, &focus, &root);
    let grandchild = reply(4, &child, &root);
    let sibling = reply(40, &parent, &root);
    let mut e = Engine::new();
    for note in [&root, &parent, &focus, &child, &grandchild, &sibling] {
        e.store.insert(note.clone(), None);
    }
    for target in [
        json!({"id":focus.id}),
        json!({"ref":lkjstr_protocol::encode_note(&focus.id).expect("note")}),
    ] {
        let mut query = json!({"source":"thread"});
        query
            .as_object_mut()
            .expect("query")
            .extend(target.as_object().expect("target").clone());
        let rows = rows(&mut e, query, None);
        assert_eq!(
            rows.len(),
            5,
            "sibling branches are not replies to the focus"
        );
        for (note, role, depth, answers) in [
            (&root, "ancestor", 0, None),
            (&parent, "ancestor", 0, Some(&root)),
            (&focus, "focus", 0, Some(&parent)),
            (&child, "reply", 1, Some(&focus)),
            (&grandchild, "reply", 2, Some(&child)),
        ] {
            let row = rows.iter().find(|r| r["id"] == note.id).expect("note row");
            let mut want = json!({"role":role,"depth":depth});
            if let Some(up) = answers {
                want["parent"] = json!(up.id);
            }
            assert_eq!(row["thread"], want);
        }
    }
    // The child is filtered out, but its edge must still count toward depth.
    let filtered = rows(
        &mut e,
        json!({"source":"thread","id":focus.id,"until":4000}),
        None,
    );
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0]["thread"]["depth"], 2);
    let windowed = rows(
        &mut e,
        json!({"source":"thread","id":focus.id}),
        Some(
            json!({"t":"window","sub":"thread","anchor":{"key":grandchild.id},"before":0,"after":1}),
        ),
    );
    assert_eq!(windowed.len(), 1);
    assert_eq!(windowed[0]["thread"]["depth"], 2);
}

#[test]
fn root_only_replies_and_cached_roots_across_missing_parents_are_classified() {
    let root = event(1, 1, "root", vec![]);
    let missing = reply(2, &root, &root);
    let focus = reply(3, &missing, &root);
    let child = event(
        4,
        1,
        "root-only reply",
        vec![vec!["e".into(), focus.id.clone(), "".into(), "root".into()]],
    );
    let mut e = Engine::new();
    for note in [&root, &focus, &child] {
        e.store.insert(note.clone(), None);
    }
    let rows = rows(&mut e, json!({"source":"thread","id":focus.id}), None);
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0]["thread"], json!({"role":"ancestor","depth":0}));
    // The focus names its missing parent; the root-only reply names the focus through its root tag.
    assert_eq!(
        rows[1]["thread"],
        json!({"role":"focus","depth":0,"parent":missing.id})
    );
    assert_eq!(
        rows[2]["thread"],
        json!({"role":"reply","depth":1,"parent":focus.id})
    );
}
