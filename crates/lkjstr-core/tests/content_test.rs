use lkjstr_core::content::{Segment, segments};
use lkjstr_protocol::encode_npub;

#[test]
fn splits_links_media_tags_and_mentions() {
    let pubkey = "f".repeat(64);
    let npub = encode_npub(&pubkey).unwrap_or_default();
    let text = format!(
        "gm #nostr see https://x.org/a.png, and (https://x.org/page). hi nostr:{npub}! :wave:"
    );
    let emoji = vec![("wave".to_owned(), "https://e/w.png".to_owned())];
    let got = segments(&text, &emoji);
    assert_eq!(
        got,
        vec![
            Segment::Text("gm ".into()),
            Segment::Hashtag("nostr".into()),
            Segment::Text(" see ".into()),
            Segment::Image("https://x.org/a.png".into()),
            Segment::Text(", and (".into()),
            Segment::Link("https://x.org/page".into()),
            Segment::Text("). hi ".into()),
            Segment::Mention(pubkey),
            Segment::Text("! ".into()),
            Segment::Emoji {
                code: "wave".into(),
                url: "https://e/w.png".into()
            },
        ]
    );
}

#[test]
fn plain_text_and_mid_word_hash_stay_text() {
    assert_eq!(segments("a#b c", &[]), vec![Segment::Text("a#b c".into())]);
    assert_eq!(segments("", &[]), vec![]);
    assert_eq!(
        segments("nostr:bogus", &[]),
        vec![Segment::Text("nostr:bogus".into())]
    );
}

#[test]
fn noise_detection_targets_encoded_blobs_only() {
    let blob = "QUJD".repeat(60);
    assert!(lkjstr_core::content::looks_like_noise(&blob));
    assert!(!lkjstr_core::content::looks_like_noise(
        "a normal sentence with words"
    ));
    assert!(!lkjstr_core::content::looks_like_noise(
        "https://example.com/short"
    ));
}

#[test]
fn image_links_and_references_alone_are_posts_not_noise() -> Result<(), lkjstr_protocol::Nip19Error>
{
    let hash = "a1b2c3d4e5f60718293a4b5c6d7e8f90".repeat(4);
    let image = format!("https://image.example.net/{hash}/{hash}.jpg?w=1920&sig={hash}");
    let pointer = lkjstr_protocol::encode_nevent(&lkjstr_protocol::EventPointer {
        id: "ab".repeat(32),
        relays: Some(vec!["wss://relay.example.com".into(); 2]),
        author: Some("cd".repeat(32)),
        kind: Some(1),
    })?;
    let quote = format!("nostr:{pointer}");
    for post in [
        image.clone(),
        format!("{image}{image}"),
        format!("{image}\n"),
        quote,
    ] {
        assert!(post.len() >= 120);
        assert!(!lkjstr_core::content::looks_like_noise(&post), "{post}");
    }
    let blob = "QUJD".repeat(60);
    assert!(lkjstr_core::content::looks_like_noise(&format!(
        "{blob}https://example.com/a.png"
    )));
    Ok(())
}

#[test]
fn large_plain_and_failed_markup_spans_render_in_linear_time() {
    let start = std::time::Instant::now();
    for text in [
        "a".repeat(262_144),
        "nostr:".repeat(43_690),
        format!("https://x{}", ")".repeat(262_144)),
        "界".repeat(87_380),
    ] {
        let result = segments(&text, &[]);
        assert!(!result.is_empty());
        if !text.starts_with("https://") {
            assert_eq!(result, vec![Segment::Text(text)]);
        }
    }
    assert!(
        start.elapsed() < std::time::Duration::from_secs(5),
        "large spans must not rescan suffixes"
    );
}
