use lkjstr_core::{
    content::{Segment, segments},
    reading::{Part, group, language_matches, name_parts},
};
#[test]
fn galleries_join_url_lines_and_leave_prose_and_emoji_in_order() {
    let parts = group(segments(
        "before\nhttps://x/a.png\nhttps://x/b.jpg\nafter",
        &[],
    ));
    assert_eq!(
        parts,
        vec![
            Part::Text(vec![Segment::Text("before".into())]),
            Part::Images(vec!["https://x/a.png".into(), "https://x/b.jpg".into()]),
            Part::Text(vec![Segment::Text("after".into())])
        ]
    );
    assert_eq!(
        name_parts(
            "葵 :coffee: https://x",
            &[("coffee".into(), "https://x/emoji.png".into())]
        ),
        vec![
            Segment::Text("葵 ".into()),
            Segment::Emoji {
                code: "coffee".into(),
                url: "https://x/emoji.png".into()
            },
            Segment::Text(" https://x".into())
        ]
    );
    assert_eq!(
        name_parts(":unknown:", &[]),
        vec![Segment::Text(":unknown:".into())]
    );
}
#[test]
fn audio_detection_and_removable_language_heuristic_handle_mixed_notes() {
    assert_eq!(
        segments("https://x/audio.MP3?x=1", &[]),
        vec![Segment::Audio("https://x/audio.MP3?x=1".into())]
    );
    assert!(language_matches("日本語 and English", true));
    assert!(language_matches("日本語 and English", false));
    assert!(!language_matches("日本語", false));
    assert!(!language_matches("English", true));
}
