use lkjstr_core::appearance::{Language, avatar_hue, day_label, language};
use lkjstr_core::words::{WORDS, text};

#[test]
fn language_uses_first_supported_preference_and_explicit_table() {
    assert_eq!(
        language(&["fr".into(), "ja-JP".into(), "en".into()]),
        Language::Japanese
    );
    assert_eq!(language(&["en-GB".into(), "ja".into()]), Language::English);
    assert_eq!(text(Language::Japanese, "Search"), "検索");
    assert_eq!(text(Language::English, "Search"), "Search");
    let mut keys: Vec<_> = WORDS.iter().map(|(en, _)| *en).collect();
    keys.sort_unstable();
    keys.dedup();
    assert_eq!(keys.len(), WORDS.len());
}

#[test]
fn fallback_and_date_separators_are_stable() {
    assert_eq!(avatar_hue(&"a".repeat(64)), avatar_hue(&"a".repeat(64)));
    assert_ne!(avatar_hue(&"a".repeat(64)), avatar_hue(&"b".repeat(64)));
    assert_eq!(day_label(172_800, 172_801), "Today");
    assert_eq!(day_label(172_799, 172_801), "Yesterday");
    assert_eq!(day_label(1, 172_801), "");
}

#[test]
fn data_images_are_supported_without_allowing_executable_profile_urls() {
    use lkjstr_core::store::Profile;
    let p = Profile::parse(
        r#"{"picture":"data:image/svg+xml,<svg/>","website":"data:text/html,wrong"}"#,
    );
    assert!(p.picture.starts_with("data:image/svg+xml,"));
    assert!(p.website.is_empty());
    let p = Profile::parse(r#"{"picture":"javascript:wrong","banner":"data:text/html,wrong"}"#);
    assert!(p.picture.is_empty());
    assert!(p.banner.is_empty());
}

#[test]
fn reaction_chips_group_custom_images_and_keep_ownership() {
    use lkjstr_protocol::NostrEvent;
    use std::sync::Arc;
    let event = |id: &str, author: &str, content: &str, tags| {
        Arc::new(NostrEvent {
            id: id.into(),
            pubkey: author.into(),
            created_at: 1,
            kind: 7,
            tags,
            content: content.into(),
            sig: String::new(),
        })
    };
    let events = [
        event("one", "me", "+", vec![]),
        event("two", "other", "+", vec![]),
        event(
            "custom",
            "other",
            ":coffee:",
            vec![vec![
                "emoji".into(),
                "coffee".into(),
                "https://example.org/coffee.png".into(),
            ]],
        ),
    ];
    let chips = lkjstr_core::reactions::chips(&events, Some("me"));
    assert_eq!(chips.len(), 2);
    assert_eq!(
        chips
            .iter()
            .find(|c| c.label == "❤️")
            .map(|c| (c.count, c.own.as_deref())),
        Some((2, Some("one")))
    );
    assert_eq!(
        chips
            .iter()
            .find(|c| c.url.is_some())
            .map(|c| (c.url.as_deref(), c.own.as_deref())),
        Some((Some("https://example.org/coffee.png"), None))
    );
}
