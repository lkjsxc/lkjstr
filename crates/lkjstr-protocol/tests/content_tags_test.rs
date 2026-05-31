use lkjstr_protocol::{
    CustomEmoji, EventPointer, ProfilePointer, content_derived_tags, emoji_tags, encode_nevent,
    encode_nprofile, mention_tags,
};

#[test]
fn derives_mentions_and_used_custom_emoji_tags() -> Result<(), String> {
    let pubkey = "a".repeat(64);
    let event_id = "b".repeat(64);
    let nprofile = encode_nprofile(&ProfilePointer {
        pubkey: pubkey.to_owned(),
        relays: Some(vec!["wss://profiles.example".to_owned()]),
    })
    .map_err(|error| format!("{error:?}"))?;
    let nevent = encode_nevent(&EventPointer {
        id: event_id.to_owned(),
        relays: Some(vec!["wss://events.example".to_owned()]),
        author: None,
        kind: None,
    })
    .map_err(|error| format!("{error:?}"))?;
    assert_eq!(
        content_derived_tags(
            &format!("hi nostr:{nprofile} nostr:{nevent} :party:"),
            &[
                emoji("unused", "https://x/unused.png", None),
                emoji(
                    "party",
                    "https://x/party.png",
                    Some(&format!("30030:{pubkey}:set"))
                )
            ],
            &[vec!["p".to_owned(), pubkey.to_owned()]],
        ),
        vec![
            vec![
                "p".to_owned(),
                pubkey.to_owned(),
                "wss://profiles.example".to_owned()
            ],
            vec!["q".to_owned(), event_id, "wss://events.example".to_owned()],
            vec![
                "emoji".to_owned(),
                "party".to_owned(),
                "https://x/party.png".to_owned(),
                format!("30030:{pubkey}:set"),
            ],
        ]
    );
    Ok(())
}

#[test]
fn extracts_multiple_entities_and_dedupes_emoji_by_shortcode() -> Result<(), String> {
    let id = "c".repeat(64);
    let nevent = encode_nevent(&EventPointer {
        id: id.to_owned(),
        relays: None,
        author: None,
        kind: None,
    })
    .map_err(|error| format!("{error:?}"))?;
    assert_eq!(
        mention_tags(&format!("(nostr:{nevent}),nostr:{nevent}!")),
        vec![
            vec!["q".to_owned(), id.to_owned(), String::new()],
            vec!["q".to_owned(), id, String::new()],
        ]
    );
    assert_eq!(
        emoji_tags(
            ":party:",
            &[
                emoji("party", "https://x/old.png", None),
                emoji("party", "https://x/new.png", None)
            ],
        ),
        vec![vec![
            "emoji".to_owned(),
            "party".to_owned(),
            "https://x/new.png".to_owned(),
        ]]
    );
    Ok(())
}

fn emoji(shortcode: &str, url: &str, address: Option<&str>) -> CustomEmoji {
    CustomEmoji {
        shortcode: shortcode.to_owned(),
        url: url.to_owned(),
        address: address.map(ToOwned::to_owned),
    }
}
