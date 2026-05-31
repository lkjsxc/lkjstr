use lkjstr_protocol::{
    CustomEmoji, custom_emoji_tag, custom_emoji_tag_parts, custom_emoji_token_text, custom_emojis,
    parse_custom_emoji_input, valid_custom_emoji_address, valid_custom_emoji_shortcode,
    valid_custom_emoji_url, valid_incoming_custom_emoji_shortcode,
};

#[test]
fn parses_https_custom_emoji_input() {
    assert_eq!(
        parse_custom_emoji_input(":party:https://x/party.png"),
        Some(CustomEmoji {
            shortcode: "party".to_owned(),
            url: "https://x/party.png".to_owned(),
            address: None,
        })
    );
    assert_eq!(parse_custom_emoji_input(":party:http://x/party.png"), None);
    assert_eq!(parse_custom_emoji_input(":bad code:https://x/p.png"), None);
}

#[test]
fn validates_shortcode_and_url_fields() {
    assert!(valid_custom_emoji_shortcode("party_1"));
    assert!(!valid_custom_emoji_shortcode("party-1"));
    assert!(valid_incoming_custom_emoji_shortcode("party-1"));
    assert!(!valid_custom_emoji_shortcode("party:1"));
    assert!(valid_custom_emoji_url("https://x/p.png"));
    assert!(!valid_custom_emoji_url("http://x/p.png"));
    assert!(!valid_custom_emoji_url("data:image/png;base64,a"));
    assert!(!valid_custom_emoji_url("javascript:alert(1)"));
    assert_eq!(custom_emoji_token_text("party"), ":party:");
}

#[test]
fn parses_and_preserves_optional_emoji_set_addresses() {
    let pubkey = "a".repeat(64);
    let address = format!("30030:{pubkey}:blobcats");
    assert!(valid_custom_emoji_address(&address));
    assert_eq!(
        custom_emoji_tag(&emoji_tag("party", "https://x/party.png", Some(&address))),
        Some(CustomEmoji {
            shortcode: "party".to_owned(),
            url: "https://x/party.png".to_owned(),
            address: Some(address),
        })
    );
    assert_eq!(
        custom_emoji_tag(&emoji_tag("party", "https://x/party.png", Some("bad"))),
        Some(CustomEmoji {
            shortcode: "party".to_owned(),
            url: "https://x/party.png".to_owned(),
            address: None,
        })
    );
    assert_eq!(
        custom_emoji_tag(&emoji_tag("party-1", "https://x/p.png", None)),
        Some(CustomEmoji {
            shortcode: "party-1".to_owned(),
            url: "https://x/p.png".to_owned(),
            address: None,
        })
    );
    assert!(custom_emoji_tag(&emoji_tag("bad code", "https://x/p.png", None)).is_none());
}

#[test]
fn parses_manual_input_with_valid_address() {
    let pubkey = "b".repeat(64);
    let address = format!("30030:{pubkey}:set");
    assert_eq!(
        parse_custom_emoji_input(&format!(" :party:https://x/p.png:{address} ")),
        Some(CustomEmoji {
            shortcode: "party".to_owned(),
            url: "https://x/p.png".to_owned(),
            address: Some(address),
        })
    );
    assert_eq!(parse_custom_emoji_input(":party-1:https://x/p.png"), None);
}

#[test]
fn extracts_unique_emojis_and_emits_tag_parts() {
    let event = lkjstr_protocol::NostrEvent {
        id: "0".repeat(64),
        pubkey: "1".repeat(64),
        created_at: 1,
        kind: 1,
        tags: vec![
            emoji_tag("party", "https://x/old.png", None),
            emoji_tag("party", "https://x/new.png", None),
            emoji_tag("blob-cat", "https://x/blob.png", None),
        ],
        content: String::new(),
        sig: "2".repeat(128),
    };
    assert_eq!(
        custom_emojis(&event),
        vec![
            CustomEmoji {
                shortcode: "party".to_owned(),
                url: "https://x/new.png".to_owned(),
                address: None,
            },
            CustomEmoji {
                shortcode: "blob-cat".to_owned(),
                url: "https://x/blob.png".to_owned(),
                address: None,
            },
        ]
    );
    assert_eq!(
        custom_emoji_tag_parts(&CustomEmoji {
            shortcode: "party".to_owned(),
            url: "https://x/new.png".to_owned(),
            address: None,
        }),
        emoji_tag("party", "https://x/new.png", None)
    );
}

fn emoji_tag(shortcode: &str, url: &str, address: Option<&str>) -> Vec<String> {
    let mut tag = vec!["emoji".to_owned(), shortcode.to_owned(), url.to_owned()];
    if let Some(value) = address {
        tag.push(value.to_owned());
    }
    tag
}
