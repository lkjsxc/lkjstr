use lkjstr_protocol::{
    KIND_EMOJI_LIST, KIND_EMOJI_SET, NostrEvent, account_emoji_source, custom_emojis_from_event,
    emoji_addresses_from_lists,
};

#[test]
fn loads_newest_account_list_and_newest_referenced_sets() {
    let pubkey = "a".repeat(64);
    let address = format!("30030:{pubkey}:set");
    let emojis = account_emoji_source(
        &[
            event(
                "1",
                &pubkey,
                KIND_EMOJI_LIST,
                1,
                vec![tag(&["emoji", "old", "https://emoji.example/old.png"])],
            ),
            event(
                "2",
                &pubkey,
                KIND_EMOJI_LIST,
                2,
                vec![
                    tag(&["emoji", "party", "https://emoji.example/list.png"]),
                    tag(&["a", &address]),
                ],
            ),
        ],
        &[
            event(
                "3",
                &pubkey,
                KIND_EMOJI_SET,
                3,
                vec![
                    tag(&["d", "set"]),
                    tag(&["emoji", "blob-cat", "https://emoji.example/old-set.png"]),
                ],
            ),
            event(
                "4",
                &pubkey,
                KIND_EMOJI_SET,
                4,
                vec![
                    tag(&["d", "set"]),
                    tag(&["emoji", "blob-cat", "https://emoji.example/new-set.png"]),
                ],
            ),
        ],
    );
    assert_eq!(emojis.len(), 2);
    assert_eq!(emojis[0].shortcode, "blob-cat");
    assert_eq!(emojis[0].address, Some(address));
    assert_eq!(emojis[1].shortcode, "party");
}

#[test]
fn dedupes_choices_by_shortcode_with_later_sources_taking_precedence() {
    let pubkey = "b".repeat(64);
    let address = format!("30030:{pubkey}:set");
    let emojis = account_emoji_source(
        &[event(
            "5",
            &pubkey,
            KIND_EMOJI_LIST,
            5,
            vec![
                tag(&["emoji", "party", "https://emoji.example/list.png"]),
                tag(&["a", &address]),
            ],
        )],
        &[event(
            "6",
            &pubkey,
            KIND_EMOJI_SET,
            6,
            vec![
                tag(&["d", "set"]),
                tag(&["emoji", "party", "https://emoji.example/set.png"]),
            ],
        )],
    );
    assert_eq!(emojis.len(), 1);
    assert_eq!(emojis[0].url, "https://emoji.example/set.png");
    assert_eq!(emojis[0].address, Some(address));
}

#[test]
fn parses_addresses_and_synthesizes_set_addresses() {
    let pubkey = "c".repeat(64);
    let address = format!("30030:{pubkey}:set");
    let list = event(
        "7",
        &pubkey,
        KIND_EMOJI_LIST,
        7,
        vec![tag(&["a", &address])],
    );
    assert_eq!(emoji_addresses_from_lists(&[list])[0].identifier, "set");
    let set = event(
        "8",
        &pubkey,
        KIND_EMOJI_SET,
        8,
        vec![
            tag(&["d", "set"]),
            tag(&["emoji", "party", "https://emoji.example/set.png"]),
        ],
    );
    assert_eq!(custom_emojis_from_event(&set)[0].address, Some(address));
}

fn event(
    seed: &str,
    pubkey: &str,
    kind: u64,
    created_at: u64,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    NostrEvent {
        id: seed.repeat(64),
        pubkey: pubkey.to_owned(),
        created_at,
        kind,
        tags,
        content: String::new(),
        sig: seed.repeat(128),
    }
}

fn tag(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
