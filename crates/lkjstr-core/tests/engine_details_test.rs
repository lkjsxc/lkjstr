#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::{
    engine::{
        Engine,
        protocol::{Action, Input, Output},
        rows::{self, Segment},
    },
    store::Store,
};
use lkjstr_nips::identity::HttpResponse;
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::json;
fn event(kind: u64, content: String, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content,
            tags,
        },
        &generate_secret_key(),
    )
    .expect("public fixture")
}
#[test]
fn nip05_requires_exact_key_unredirected_evidence_and_invalidates_with_metadata() {
    let mut store = Store::new(10);
    let p = event(
        0,
        json!({"name":"alice","nip05":"alice@example.test"}).to_string(),
        vec![],
    );
    let key = p.pubkey.clone();
    store.insert(p.clone(), None);
    let response = |url: &str, key: &str| HttpResponse {
        status: 200,
        final_url: url.into(),
        body: json!({"names":{"alice":key}}).to_string(),
    };
    let url = "https://example.test/.well-known/nostr.json?name=alice";
    assert!(!store.verify_nip05(
        &key,
        "alice@example.test",
        response("https://other.test", &key)
    ));
    assert!(!store.verify_nip05(&key, "alice@example.test", response(url, &"a".repeat(64))));
    assert!(store.verify_nip05(&key, "alice@example.test", response(url, &key)));
    assert!(rows::author(&store, &key).nip05_verified);
    let mut changed = p;
    changed.id = "b".repeat(64);
    changed.created_at += 1;
    changed.content = json!({"nip05":"bob@example.test"}).to_string();
    store.insert(changed, None);
    assert!(!store.nip05_verified(&key));
}
#[test]
fn opaque_imeta_urls_and_custom_name_emoji_are_finished() {
    let mut store = Store::new(10);
    let profile = event(
        0,
        json!({"name":"name :cat:"}).to_string(),
        vec![vec![
            "emoji".into(),
            "cat".into(),
            "https://example.test/cat.png".into(),
        ]],
    );
    let key = profile.pubkey.clone();
    store.insert(profile, None);
    assert!(
        rows::author(&store, &key)
            .name_segments
            .iter()
            .any(|p| matches!(p,rows::NameSegment::Emoji{code,..} if code=="cat"))
    );
    let note = event(
        1,
        "https://example.test/opaque".into(),
        vec![vec![
            "imeta".into(),
            "url https://example.test/opaque".into(),
            "m image/png".into(),
            "dim 40x30".into(),
        ]],
    );
    let row = rows::row(&store, &note, None, 0);
    assert!(row.content.iter().any(|s| matches!(
        s,
        Segment::Media {
            width: Some(40),
            height: Some(30),
            ..
        }
    )));
    assert!(
        !row.content
            .iter()
            .any(|s| matches!(s,Segment::Link{url} if url.ends_with("opaque")))
    );
}
#[test]
fn list_edits_preserve_private_payload_and_unknown_tags_and_serialize_mutations() {
    let mut e = Engine::new();
    let list = event(
        10000,
        "opaque private ciphertext".into(),
        vec![
            vec!["unknown".into(), "kept".into()],
            vec!["word".into(), "old".into()],
        ],
    );
    let account = list.pubkey.clone();
    e.store.insert(list, None);
    let edit = |req: &str| Input::Action {
        req: req.into(),
        account: account.clone(),
        action: Action::Mute {
            kind: "word".into(),
            target: "new".into(),
            value: true,
        },
    };
    e.input(edit("a"), 100000);
    let out = e.drain();
    let Output::Sign { event, .. } = &out[0] else {
        panic!("sign")
    };
    assert_eq!(event.content, "opaque private ciphertext");
    assert!(event.tags.iter().any(|t| t == &vec!["unknown", "kept"]));
    e.input(edit("b"), 100001);
    assert!(matches!(&e.drain()[0],Output::Error{code,..} if code=="list-edit-pending"));
}
#[test]
fn large_payload_bounds_evict_indexes_and_invalid_first_copy_cannot_poison_valid_one() {
    let mut store = Store::new(100).with_byte_cap(1024);
    let large = event(1, "x".repeat(2048), vec![]);
    store.insert(large, None);
    assert!(store.is_empty());
    assert_eq!(store.payload_bytes(), 0);
    let mut e = Engine::new();
    let good = event(1, "good".into(), vec![]);
    let mut bad = good.clone();
    bad.content = "tampered".into();
    e.enqueue("bad".into(), bad);
    e.enqueue("good".into(), good.clone());
    e.tick(75);
    assert_eq!(e.rejected, 1);
    assert!(e.store.get(&good.id).is_some());
}
#[test]
fn own_reactions_and_several_reposters_are_grouped_by_target() {
    let mut store = Store::new(100);
    let note = event(1, "note".into(), vec![]);
    store.insert(note.clone(), None);
    for _ in 0..5 {
        store.insert(
            event(6, String::new(), vec![vec!["e".into(), note.id.clone()]]),
            None,
        );
    }
    let reaction = event(7, "👍".into(), vec![vec!["e".into(), note.id.clone()]]);
    let key = reaction.pubkey.clone();
    store.insert(reaction, None);
    let row = rows::row(&store, &note, Some(&key), 0);
    assert_eq!(row.reposts.len(), 5);
    assert!(row.reactions[0].mine);
    assert_eq!(row.reactions[0].count, 1);
}
