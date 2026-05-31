use lkjstr_protocol::{
    CustomEmoji, KIND_GENERIC_REPOST, KIND_METADATA, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent,
    ZapRequestInput, parent_event_id, reaction_tags, reply_tags, repost_kind, repost_tags,
    zap_request_tags,
};

#[test]
fn builds_reply_tags_with_root_reply_and_pubkeys() {
    let event = nostr_event(vec![vec![
        "e".to_owned(),
        "1".repeat(64),
        String::new(),
        "root".to_owned(),
    ]]);
    assert_eq!(
        reply_tags(&event),
        vec![
            vec![
                "e".to_owned(),
                "1".repeat(64),
                String::new(),
                "root".to_owned()
            ],
            vec![
                "e".to_owned(),
                event.id.to_owned(),
                String::new(),
                "reply".to_owned()
            ],
            vec!["p".to_owned(), event.pubkey.to_owned()],
        ]
    );
}

#[test]
fn builds_reaction_and_custom_emoji_tags() {
    let event = nostr_event(Vec::new());
    assert_eq!(
        reaction_tags(&event, None),
        vec![
            vec!["e".to_owned(), event.id.to_owned()],
            vec!["p".to_owned(), event.pubkey.to_owned()],
            vec!["k".to_owned(), "1".to_owned()],
        ]
    );
    let emoji = CustomEmoji {
        shortcode: "party".to_owned(),
        url: "https://x/party.png".to_owned(),
        address: Some(format!("30030:{}:set", event.pubkey)),
    };
    assert!(reaction_tags(&event, Some(&emoji)).contains(&vec![
        "emoji".to_owned(),
        "party".to_owned(),
        "https://x/party.png".to_owned(),
        format!("30030:{}:set", event.pubkey),
    ]));
}

#[test]
fn builds_repost_kind_and_tags() {
    let note = NostrEvent {
        kind: KIND_TEXT_NOTE,
        ..nostr_event(Vec::new())
    };
    let metadata = NostrEvent {
        kind: KIND_METADATA,
        ..nostr_event(Vec::new())
    };
    assert_eq!(repost_kind(&note), KIND_REPOST);
    assert_eq!(repost_kind(&metadata), KIND_GENERIC_REPOST);
    assert!(repost_tags(&metadata).contains(&vec!["k".to_owned(), "0".to_owned()]));
}

#[test]
fn builds_zap_request_tags() {
    let event = nostr_event(Vec::new());
    let relays = vec!["wss://relay.example".to_owned()];
    assert_eq!(
        zap_request_tags(&ZapRequestInput {
            event: Some(&event),
            profile_pubkey: None,
            recipient_pubkey: None,
            amount_msats: 21_000,
            lnurl: "lnurl1value",
            relays: &relays,
        }),
        vec![
            vec!["relays".to_owned(), "wss://relay.example".to_owned()],
            vec!["amount".to_owned(), "21000".to_owned()],
            vec!["lnurl".to_owned(), "lnurl1value".to_owned()],
            vec!["e".to_owned(), event.id.to_owned()],
            vec!["p".to_owned(), event.pubkey.to_owned()],
            vec!["k".to_owned(), "1".to_owned()],
        ]
    );
    assert_eq!(parent_event_id(&event), event.id);
}

fn nostr_event(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "0".repeat(64),
        pubkey: "f".repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content: String::new(),
        sig: "a".repeat(128),
    }
}
