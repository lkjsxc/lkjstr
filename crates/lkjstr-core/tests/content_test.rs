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
