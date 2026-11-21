#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, accounts::Accounts, protocol::Query, wire::Session};
use lkjstr_protocol as p;
use serde_json::json;

#[test]
fn decrypted_mutes_hide_notes_and_mark_nested_quotes_without_mutating_events() {
    let mut a = Accounts::default();
    a.add("create", None).expect("create");
    let key = a.active.clone().expect("key");
    // Generate a separate NIP-44 owner and import it into the local signer.
    let owner = lkjstr_nips::keys::SecretKey::from_bytes(*p::generate_secret_key().as_bytes())
        .expect("owner");
    a.add(
        "key",
        Some(&p::encode_nsec(&p::bytes_to_hex(owner.as_bytes())).expect("nsec")),
    )
    .expect("import");
    let key2 = owner.public_key();
    let note = event(1, 1, "secretly muted", vec![]);
    let tags = vec![
        vec!["p".into(), note.pubkey.clone()],
        vec!["word".into(), "blocked".into()],
        vec!["t".into(), "private".into()],
        vec!["e".into(), "c".repeat(64)],
    ];
    let cipher =
        lkjstr_nips::list_crypto::encrypt(&tags, &owner, p::generate_secret_key().as_bytes())
            .expect("encrypt");
    let mute = a
        .sign(&p::UnsignedNostrEvent {
            pubkey: key2.clone(),
            created_at: 2,
            kind: 10000,
            tags: vec![],
            content: cipher,
        })
        .expect("sign")
        .expect("local");
    let mut e = Engine::new();
    e.store.insert(note.clone(), None);
    e.store.insert(mute.clone(), None);
    e.private_lists
        .insert(mute.id.clone(), a.private_entries(&mute).expect("decrypt"));
    let quote = event(3, 1, "quote", vec![vec!["q".into(), note.id.clone()]]);
    e.store.insert(quote.clone(), None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"g","query":{"source":"global","account":key2}}),
        0,
    );
    let out = output(&mut s, &mut e);
    let rows = &out.iter().find(|o| o["t"] == "rows").expect("rows")["rows"];
    let covered = rows
        .as_array()
        .expect("array")
        .iter()
        .find(|r| r["key"] == note.id)
        .expect("covered slot");
    assert_eq!(covered["hidden"]["reason"], "muted-person");
    assert_eq!(covered["segments"], json!([]));
    assert_eq!(rows[0]["quotes"][0]["state"], "muted");
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"p","query":{"source":"profile","account":key2,"pubkey":note.pubkey}}),
        1,
    );
    let profile = output(&mut s, &mut e);
    assert_eq!(
        profile.iter().find(|o| o["t"] == "rows").expect("profile")["rows"][0]["muted"],
        true
    );
    let mut mention = note.clone();
    mention.id = "d".repeat(64);
    mention.tags.push(vec!["p".into(), key2.clone()]);
    e.store.insert(mention, None);
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"n","query":{"source":"notifications","account":key2}}),
        2,
    );
    let notifications = output(&mut s, &mut e);
    assert_eq!(
        notifications
            .iter()
            .find(|o| o["t"] == "rows")
            .expect("notifications")["rows"],
        json!([])
    );
    let q = Query {
        account: Some(key2),
        ..Default::default()
    };
    for (text, tags, reason) in [
        ("BLOCKED", vec![], "muted-word"),
        (
            "tag",
            vec![vec!["t".into(), "PRIVATE".into()]],
            "muted-hashtag",
        ),
        (
            "reply",
            vec![vec!["e".into(), "c".repeat(64), "".into(), "reply".into()]],
            "muted-thread",
        ),
    ] {
        let note = event(4, 1, text, tags);
        assert_eq!(
            lkjstr_core::engine::query::hidden_with_lists(&e.store, &q, &note, &e.private_lists)
                .as_deref(),
            Some(reason)
        );
    }
    let other = Query {
        account: Some(key),
        ..Default::default()
    };
    assert!(
        lkjstr_core::engine::query::hidden_with_lists(&e.store, &other, &note, &e.private_lists)
            .is_none()
    );
    assert_eq!(*e.store.get(&mute.id).expect("original"), mute);
    let replacement = a
        .sign(&p::UnsignedNostrEvent {
            pubkey: owner.public_key(),
            created_at: 5,
            kind: 10000,
            tags: vec![],
            content: String::new(),
        })
        .expect("sign")
        .expect("local");
    e.store.insert(replacement, None);
    assert!(
        lkjstr_core::engine::query::hidden_with_lists(&e.store, &q, &note, &e.private_lists)
            .is_none()
    );
}
