use lkjstr_protocol::{
    EventPointer, EventReferenceKind, EventReferenceSource, KIND_REACTION, KIND_REPOST,
    KIND_TEXT_NOTE, NostrEvent, encode_nevent, event_references,
};

#[test]
fn repost_and_reaction_use_last_event_tag_target() {
    let first = "a".repeat(64);
    let second = "b".repeat(64);
    let repost_refs = event_references(&event(
        KIND_REPOST,
        "",
        vec![
            vec!["e".to_owned(), first],
            vec![
                "e".to_owned(),
                second.clone(),
                "wss://relay.example".to_owned(),
            ],
        ],
    ));
    let reaction_refs = event_references(&event(KIND_REACTION, "+", vec![e_tag(&second)]));

    assert_eq!(repost_refs[0].kind, EventReferenceKind::Repost);
    assert_eq!(repost_refs[0].id, second);
    assert_eq!(repost_refs[0].relays, vec!["wss://relay.example"]);
    assert_eq!(reaction_refs[0].kind, EventReferenceKind::Reaction);
}

#[test]
fn reply_and_quote_references_preserve_identity() {
    let root = "c".repeat(64);
    let parent = "d".repeat(64);
    let quote = "e".repeat(64);
    let refs = event_references(&event(
        KIND_TEXT_NOTE,
        "quoted",
        vec![
            vec![
                "e".to_owned(),
                root.clone(),
                String::new(),
                "root".to_owned(),
            ],
            vec![
                "e".to_owned(),
                parent.clone(),
                String::new(),
                "reply".to_owned(),
            ],
            vec![
                "q".to_owned(),
                quote.clone(),
                "wss://quote.example".to_owned(),
            ],
        ],
    ));

    assert_eq!(refs[0].kind, EventReferenceKind::ReplyRoot);
    assert_eq!(refs[0].id, root);
    assert_eq!(refs[1].kind, EventReferenceKind::ReplyParent);
    assert_eq!(refs[1].id, parent);
    assert_eq!(refs[2].kind, EventReferenceKind::Quote);
    assert_eq!(refs[2].id, quote);
    assert_eq!(refs[2].source, EventReferenceSource::Q);
}

#[test]
fn content_nevent_references_keep_relays_and_author() -> Result<(), String> {
    let id = "f".repeat(64);
    let author = "1".repeat(64);
    let nevent = encode_nevent(&EventPointer {
        id: id.clone(),
        relays: Some(vec!["wss://relay.example".to_owned()]),
        author: Some(author.clone()),
        kind: None,
    })
    .map_err(|error| format!("{error:?}"))?;
    let refs = event_references(&event(
        KIND_TEXT_NOTE,
        &format!("see nostr:{nevent}"),
        vec![],
    ));

    assert_eq!(refs[0].kind, EventReferenceKind::NostrEvent);
    assert_eq!(refs[0].id, id);
    assert_eq!(refs[0].relays, vec!["wss://relay.example"]);
    assert_eq!(refs[0].author_pubkey, Some(author));
    Ok(())
}

fn e_tag(id: &str) -> Vec<String> {
    vec!["e".to_owned(), id.to_owned()]
}

fn event(kind: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "9".repeat(64),
        pubkey: "8".repeat(64),
        created_at: 1,
        kind,
        tags,
        content: content.to_owned(),
        sig: "7".repeat(128),
    }
}
