#![allow(clippy::expect_used)]
#[path = "engine_pins/support.rs"]
mod support;
use lkjstr_core::engine::Engine;
use support::*;

#[test]
fn pin_merges_the_latest_list_preserving_opaque_content_and_every_unrelated_tag() {
    let mut engine = Engine::new();
    let note = event(1, 1, 10, "pin me", vec![]);
    let other = event(1, 1, 11, "already pinned", vec![]);
    let old = event(1, 10001, 70, "old content", vec![pin_tag(&other.id)]);
    let tags = vec![
        vec!["x-extension".into(), "kept".into(), "opaque".into()],
        vec![
            "e".into(),
            other.id.clone(),
            RELAY.into(),
            "author hint".into(),
        ],
        vec!["a".into(), "30023:opaque:article".into(), OTHER.into()],
        vec!["e".into(), "not-an-id".into(), "unrecognized".into()],
        vec!["alt".into(), "Pins".into()],
    ];
    let latest = event(1, 10001, 200, "opaque encrypted extension", tags.clone());
    for item in [note.clone(), other, latest, old] {
        engine.store.insert(item, None);
    }
    let draft = unsigned(request(&mut engine, "pin", &note.pubkey, &note.id, true));
    let mut expected = tags;
    expected.push(pin_tag(&note.id));
    assert_eq!(draft.kind, 10001);
    assert_eq!(draft.pubkey, note.pubkey);
    assert_eq!(draft.created_at, 201);
    assert_eq!(draft.content, "opaque encrypted extension");
    assert_eq!(draft.tags, expected);
}

#[test]
fn idempotent_pin_keeps_existing_order_and_extended_tags() {
    let mut engine = Engine::new();
    let note = event(1, 1, 10, "existing pin", vec![]);
    let tags = vec![
        vec!["x".into(), "first".into()],
        vec![
            "e".into(),
            note.id.clone(),
            RELAY.into(),
            note.pubkey.clone(),
        ],
        vec!["x".into(), "last".into()],
    ];
    engine.store.insert(note.clone(), None);
    engine
        .store
        .insert(event(1, 10001, 20, "opaque", tags.clone()), None);
    let draft = unsigned(request(&mut engine, "same", &note.pubkey, &note.id, true));
    assert_eq!(draft.tags, tags);
    assert_eq!(draft.content, "opaque");
}

#[test]
fn pin_unpin_and_inverse_undo_merge_intervening_device_edits() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    let a = event(1, 1, 1, "A", vec![]);
    let b = event(1, 1, 2, "B", vec![]);
    let c = event(1, 1, 3, "C", vec![]);
    for note in [&a, &b, &c] {
        engine.store.insert(note.clone(), None);
    }
    engine
        .store
        .insert(event(1, 10001, 10, "", vec![pin_tag(&b.id)]), None);
    let pinned = unsigned(request(&mut engine, "pin", &a.pubkey, &a.id, true));
    assert_eq!(pinned.tags, vec![pin_tag(&b.id), pin_tag(&a.id)]);
    finish(&mut engine, "pin", 1, pinned);
    let extension = vec!["device".into(), "remote".into()];
    let updated = event(
        1,
        10001,
        200,
        "remote content",
        vec![
            pin_tag(&c.id),
            pin_tag(&b.id),
            pin_tag(&a.id),
            extension.clone(),
        ],
    );
    engine.store.insert(updated, Some(OTHER));
    let unpinned = unsigned(request(&mut engine, "unpin", &a.pubkey, &a.id, false));
    assert_eq!(
        unpinned.tags,
        vec![pin_tag(&c.id), pin_tag(&b.id), extension.clone()]
    );
    assert_eq!(unpinned.content, "remote content");
    assert_eq!(unpinned.created_at, 201);
    finish(&mut engine, "unpin", 1, unpinned);
    let next = vec![pin_tag(&c.id), vec!["future".into(), "preserve".into()]];
    engine.store.insert(
        event(1, 10001, 300, "latest content", next.clone()),
        Some(OTHER),
    );
    let undo = unsigned(request(&mut engine, "undo", &a.pubkey, &a.id, true));
    assert_eq!(undo.created_at, 301);
    assert_eq!(undo.content, "latest content");
    let mut expected = next;
    expected.push(pin_tag(&a.id));
    assert_eq!(undo.tags, expected);
    finish(&mut engine, "undo", 1, undo);
    assert_eq!(
        engine
            .store
            .replaceable(&a.pubkey, 10001)
            .expect("current list")
            .tags,
        expected
    );
}

#[test]
fn unpin_removes_all_matching_tags_without_needing_the_target_body() {
    let mut engine = Engine::new();
    let note = event(1, 1, 1, "evicted target", vec![]);
    let unknown = vec!["vendor".into(), "retained".into()];
    engine.store.insert(
        event(
            1,
            10001,
            20,
            "opaque",
            vec![
                pin_tag(&note.id),
                vec!["e".into(), note.id.clone(), RELAY.into()],
                unknown.clone(),
            ],
        ),
        None,
    );
    assert!(engine.store.get(&note.id).is_none());
    let draft = unsigned(request(&mut engine, "unpin", &note.pubkey, &note.id, false));
    assert_eq!(draft.tags, vec![unknown]);
    assert_eq!(draft.content, "opaque");
}

#[test]
fn pin_rejects_other_authors_non_notes_and_unavailable_targets() {
    let mut engine = Engine::new();
    let owner = event(1, 1, 1, "owner", vec![]);
    let foreign = event(2, 1, 2, "someone else", vec![]);
    let channel = event(1, 42, 3, "channel message", vec![]);
    for item in [&owner, &foreign, &channel] {
        engine.store.insert(item.clone(), None);
    }
    engine.store.insert(event(1, 10001, 5, "", vec![]), None);
    for (id, expected) in [
        (foreign.id.as_str(), "not-author"),
        (channel.id.as_str(), "rejected"),
        ("not-hex", "rejected"),
        (&"aa".repeat(32), "target-unavailable"),
    ] {
        error(
            request(&mut engine, "bad", &owner.pubkey, id, true),
            expected,
        );
    }
    assert_eq!(
        engine
            .store
            .replaceable(&owner.pubkey, 10001)
            .expect("untouched list")
            .tags
            .len(),
        0
    );
}

#[test]
fn exhausted_replaceable_timestamp_never_reaches_the_signer() {
    let mut engine = Engine::new();
    let note = event(1, 1, 1, "own", vec![]);
    engine.store.insert(note.clone(), None);
    let latest = event(1, 10001, u64::MAX, "", vec![pin_tag(&note.id)]);
    engine.store.insert(latest.clone(), None);
    for on in [true, false] {
        error(
            request(&mut engine, "overflow", &note.pubkey, &note.id, on),
            "rejected",
        );
    }
    assert_eq!(
        engine
            .store
            .replaceable(&note.pubkey, 10001)
            .expect("list")
            .id,
        latest.id
    );
}
