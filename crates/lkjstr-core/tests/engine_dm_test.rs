use lkjstr_core::engine::{
    Engine,
    dm::{self, Draft, Inbox, Query},
};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn key(n: u8) -> std::result::Result<SecretKey, lkjstr_nips::Error> {
    SecretKey::from_bytes([n; 32])
}
fn message(
    a: &SecretKey,
    b: &SecretKey,
    text: &str,
    at: u64,
) -> std::result::Result<lkjstr_nips::event::Rumor, lkjstr_nips::Error> {
    lkjstr_nips::dm::message(a.public_key(), &[b.public_key()], text, at, None, None)
}
#[test]
fn private_rows_are_account_isolated_and_duplicate_wraps_count_once() -> Result {
    let a = key(1)?;
    let b = key(2)?;
    let c = key(3)?;
    let rumor = message(&a, &b, "private", 42)?;
    let mut inbox = Inbox::default();
    assert!(inbox.insert(&b.public_key(), rumor.clone())?);
    assert!(!inbox.insert(&b.public_key(), rumor.clone())?);
    assert!(inbox.insert(&c.public_key(), rumor).is_err());
    let snapshot = inbox.snapshot(
        &Query {
            account: b.public_key(),
            ..Default::default()
        },
        "live",
        None,
        false,
    );
    assert_eq!(snapshot.conversations.len(), 1);
    assert_eq!(snapshot.conversations[0].unread, 1);
    assert!(
        inbox
            .snapshot(
                &Query {
                    account: a.public_key(),
                    ..Default::default()
                },
                "live",
                None,
                false
            )
            .conversations
            .is_empty()
    );
    Ok(())
}
#[test]
fn unread_timestamp_ties_survive_reload_and_own_messages_are_not_unread() -> Result {
    let a = key(1)?;
    let b = key(2)?;
    let first = message(&a, &b, "first", 42)?;
    let later = message(&a, &b, "late same second", 42)?;
    let own = message(&b, &a, "own", 43)?;
    let mut inbox = Inbox::default();
    inbox.insert(&b.public_key(), first.clone())?;
    let query = Query {
        account: b.public_key(),
        ..Default::default()
    };
    let room = inbox.snapshot(&query, "live", None, false).conversations[0]
        .key
        .clone();
    inbox.seen(&b.public_key(), &room)?;
    let marks = serde_json::to_string(&inbox.marks)?;
    let mut restored = Inbox::default();
    restored.restore_marks(&marks)?;
    restored.insert(&b.public_key(), first)?;
    restored.insert(&b.public_key(), later)?;
    restored.insert(&b.public_key(), own)?;
    let snapshot = restored.snapshot(&query, "live", None, false);
    assert_eq!(snapshot.conversations[0].unread, 1);
    assert_eq!(snapshot.conversations[0].last.text, "own");
    assert!(!snapshot.conversations[0].last.unread);
    assert!(!marks.contains("first"));
    Ok(())
}
#[test]
fn inbox_routes_require_authenticated_kind_10050_even_when_outboxes_exist() -> Result {
    let a = key(1)?;
    let mut engine = Engine::new();
    let outbox = UnsignedEvent::new(
        a.public_key(),
        10,
        10002,
        vec![vec!["r".into(), "wss://outbox.test".into()]],
        "",
    )
    .sign(&a, &[1; 32])?;
    engine.enqueue(
        "fixture".into(),
        lkjstr_protocol::parse_nostr_event_json(&outbox.to_json()?, None)
            .map_err(|_| "fixture invalid")?,
    );
    engine.tick(10);
    assert_eq!(
        dm::routing::inboxes(&engine.store, &a.public_key()).err(),
        Some("not-found")
    );
    let advertised = UnsignedEvent::new(
        a.public_key(),
        11,
        10050,
        vec![vec!["relay".into(), "wss://inbox.test".into()]],
        "",
    )
    .sign(&a, &[2; 32])?;
    engine.enqueue(
        "fixture".into(),
        lkjstr_protocol::parse_nostr_event_json(&advertised.to_json()?, None)
            .map_err(|_| "fixture invalid")?,
    );
    engine.tick(20);
    let routes = dm::routing::destinations(&engine.store, &a.public_key())?;
    assert_eq!(routes.len(), 1);
    assert_eq!(routes[0].url, "wss://inbox.test/");
    assert!(!routes.iter().any(|r| r.url.contains("outbox")));
    Ok(())
}
#[test]
fn a_draft_never_exposes_references_as_public_tags_or_accepts_an_empty_room() -> Result {
    let a = key(1)?;
    let b = key(2)?;
    let text = format!("nostr:npub-and-public-reference {}", "f".repeat(64));
    let input = Draft {
        recipients: vec![b.public_key()],
        text: text.clone(),
        reply_to: None,
        subject: None,
    };
    let rumor = dm::draft(&a.public_key(), &input, 1)?;
    assert_eq!(rumor.data.kind, 14);
    assert_eq!(rumor.data.tags, vec![vec!["p".to_owned(), b.public_key()]]);
    assert!(!format!("{input:?}").contains(&text));
    let bad = Draft {
        recipients: vec![],
        ..input
    };
    assert!(dm::draft(&a.public_key(), &bad, 1).is_err());
    Ok(())
}
#[test]
fn wire_debug_redacts_crypto_answers_and_direct_message_text() -> Result {
    let raw = serde_json::json!({"t":"crypted","req":"r","value":"private plaintext"});
    let input: lkjstr_core::engine::wire::Input = serde_json::from_value(raw)?;
    assert!(!format!("{input:?}").contains("plaintext"));
    Ok(())
}
#[test]
fn locked_session_drops_plaintext_without_losing_read_marks() -> Result {
    let a = key(1)?;
    let b = key(2)?;
    let mut inbox = Inbox::default();
    inbox.insert(&b.public_key(), message(&a, &b, "private", 42)?)?;
    let query = Query {
        account: b.public_key(),
        ..Default::default()
    };
    let room = inbox.snapshot(&query, "live", None, false).conversations[0]
        .key
        .clone();
    inbox.seen(&b.public_key(), &room)?;
    inbox.retain_messages(&Default::default());
    assert!(
        inbox
            .snapshot(&query, "cache", None, false)
            .conversations
            .is_empty()
    );
    assert_eq!(inbox.marks.len(), 1);
    Ok(())
}
