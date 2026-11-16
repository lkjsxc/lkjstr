use lkjstr_core::engine::{
    Engine,
    dm::{self, Draft, Emoji, Inbox, Query},
};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn key(n: u8) -> std::result::Result<SecretKey, lkjstr_nips::Error> {
    SecretKey::from_bytes([n; 32])
}
#[test]
fn empty_conversation_identity_is_canonical_and_account_bound() -> Result {
    let a = key(1)?.public_key();
    let b = key(2)?.public_key();
    let query = Query {
        account: a.clone(),
        participants: Some(vec![b.clone(), a.clone(), b.clone()]),
        ..Default::default()
    }
    .normalized()?;
    let other = Query {
        account: b.clone(),
        participants: Some(vec![a.clone()]),
        ..Default::default()
    }
    .normalized()?;
    assert_eq!(query.conversation, other.conversation);
    assert_eq!(query.participants.as_ref().map(Vec::len), Some(2));
    let mut wrong = query.clone();
    wrong.conversation = Some("0".repeat(64));
    assert!(wrong.normalized().is_err());
    let mut wrong = query.clone();
    wrong.participants = Some(vec!["bad".into()]);
    assert!(wrong.normalized().is_err());
    let inbox = Inbox::default();
    let mut snapshot = inbox.snapshot(&query, "live", None, false);
    Engine::new().decorate_dm_snapshot(&inbox, &query, &mut snapshot);
    assert_eq!(snapshot.conversation, query.conversation);
    assert_eq!(snapshot.people.as_ref().map(Vec::len), Some(2));
    assert_eq!(
        snapshot.blocked,
        Some(vec![]),
        "unknown inbox is not proven missing"
    );
    Ok(())
}
#[test]
fn frame_watch_returns_counts_without_private_text_or_people() -> Result {
    let a = key(1)?.public_key();
    let b = key(2)?.public_key();
    let mut inbox = Inbox::default();
    inbox.insert(
        &a,
        lkjstr_nips::dm::message(
            b.clone(),
            std::slice::from_ref(&a),
            "private frame sentinel",
            42,
            None,
            None,
        )?,
    )?;
    let query = Query {
        account: a,
        unread_only: true,
        ..Default::default()
    };
    let mut snapshot = inbox.snapshot(&query, "live", None, true);
    Engine::new().decorate_dm_snapshot(&inbox, &query, &mut snapshot);
    assert_eq!(snapshot.unread, Some(1));
    assert!(snapshot.conversations.is_empty() && snapshot.messages.is_empty());
    assert!(snapshot.people.is_none());
    assert!(!serde_json::to_string(&snapshot)?.contains("sentinel"));
    Ok(())
}
#[test]
fn private_text_has_inert_parts_and_same_conversation_reply_context() -> Result {
    let a = key(1)?.public_key();
    let b = key(2)?.public_key();
    let c = key(3)?.public_key();
    let parent = lkjstr_nips::dm::message(
        b.clone(),
        std::slice::from_ref(&a),
        "parent line\nprivate tail",
        40,
        None,
        None,
    )?;
    let reply = lkjstr_nips::dm::message(
        a.clone(),
        std::slice::from_ref(&b),
        "https://example.test/picture.png <script> :wave:",
        41,
        Some(&parent.id),
        None,
    )?;
    let mut event = reply.data;
    event.tags.push(vec![
        "emoji".into(),
        "wave".into(),
        "https://example.test/wave.png".into(),
    ]);
    let reply = event.rumor()?;
    let alien = lkjstr_nips::dm::message(
        c,
        std::slice::from_ref(&a),
        "different room",
        42,
        Some(&parent.id),
        None,
    )?;
    let mut inbox = Inbox::default();
    inbox.insert(&a, parent.clone())?;
    inbox.insert(&a, reply.clone())?;
    inbox.insert(&a, alien.clone())?;
    let query = Query {
        account: a.clone(),
        participants: Some(vec![b.clone()]),
        ..Default::default()
    }
    .normalized()?;
    let snapshot = inbox.snapshot(&query, "live", None, false);
    let row = snapshot
        .messages
        .iter()
        .find(|m| m.id == reply.id)
        .ok_or("reply absent")?;
    assert_eq!(
        row.reply.as_ref().map(|r| r.excerpt.as_str()),
        Some("parent line")
    );
    let segments = row.segments.as_ref().ok_or("segments absent")?;
    assert_eq!(segments[0]["k"], "link");
    assert!(segments.iter().any(|v| {
        v["k"] == "text"
            && v["text"]
                .as_str()
                .is_some_and(|text| text.contains("<script>"))
    }));
    assert!(segments.iter().any(|v| v["k"] == "emoji"));
    assert!(!segments.iter().any(|v| v["k"] == "media"));
    let alien_query = Query {
        account: a.clone(),
        conversation: Some(dm::conversation(&lkjstr_nips::dm::participants(&alien)?)),
        ..Default::default()
    };
    assert!(
        inbox.snapshot(&alien_query, "live", None, false).messages[0]
            .reply
            .is_none()
    );
    let another = Query {
        account: b,
        conversation: query.conversation,
        ..Default::default()
    };
    assert!(
        inbox
            .snapshot(&another, "live", None, false)
            .messages
            .is_empty()
    );
    Ok(())
}
#[test]
fn verified_empty_inbox_blocks_only_its_participant() -> Result {
    let a = key(1)?;
    let b = key(2)?.public_key();
    let withdrawal = dm::routing::advertisement(&a.public_key(), &[], 42)?;
    assert_eq!(withdrawal.kind, 10050);
    assert!(withdrawal.tags.is_empty());
    let event = UnsignedEvent::new(
        withdrawal.pubkey,
        withdrawal.created_at,
        withdrawal.kind.try_into()?,
        withdrawal.tags,
        withdrawal.content,
    )
    .sign(&a, &[9; 32])?;
    let mut engine = Engine::new();
    engine.enqueue(
        "fixture".into(),
        lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None).map_err(|_| "fixture")?,
    );
    engine.tick(1000);
    let query = Query {
        account: a.public_key(),
        participants: Some(vec![b]),
        ..Default::default()
    }
    .normalized()?;
    let inbox = Inbox::default();
    let mut snapshot = inbox.snapshot(&query, "live", None, false);
    engine.decorate_dm_snapshot(&inbox, &query, &mut snapshot);
    assert_eq!(snapshot.blocked, Some(vec![a.public_key()]));
    Ok(())
}
#[test]
fn custom_emoji_tags_are_bounded_validated_and_bound_to_the_rumor_id() -> Result {
    let a = key(1)?.public_key();
    let b = key(2)?.public_key();
    let mut draft = Draft {
        recipients: vec![b],
        text: ":wave: hello".into(),
        reply_to: None,
        subject: None,
        emoji: Some(vec![Emoji {
            code: "wave".into(),
            url: "https://example.test/wave.png".into(),
        }]),
    };
    let rumor = dm::draft(&a, &draft, 42)?;
    rumor.verify_id()?;
    assert!(
        rumor
            .data
            .tags
            .iter()
            .any(|tag| tag.first().is_some_and(|value| value == "emoji"))
    );
    draft.emoji = Some(vec![Emoji {
        code: "wave".into(),
        url: "javascript:alert(1)".into(),
    }]);
    assert!(dm::draft(&a, &draft, 42).is_err());
    Ok(())
}
