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

fn luminance(hex: &str) -> f64 {
    let rgb: Vec<_> = (1..7)
        .step_by(2)
        .map(|i| {
            let n = u8::from_str_radix(&hex[i..i + 2], 16).unwrap_or(0);
            let c = f64::from(n) / 255.0;
            if c <= 0.04045 {
                c / 12.92
            } else {
                ((c + 0.055) / 1.055).powf(2.4)
            }
        })
        .collect();
    rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

#[test]
fn exact_design_tokens_and_all_readable_pairs_have_aa_contrast() {
    let css = include_str!("../../../static/styles/base.css");
    let palettes = [
        [
            "#f4f3ee", "#fdfcf9", "#ffffff", "#1c1c1a", "#55544f", "#27598c", "#9c3a23", "#3d7350",
        ],
        [
            "#14161a", "#1a1d21", "#21252a", "#e7e5df", "#a9a8a2", "#8fb4e3", "#e08a6d", "#86c097",
        ],
    ];
    for palette in palettes {
        for token in palette {
            assert!(css.contains(token), "missing {token}");
        }
        for background in &palette[..3] {
            for foreground in &palette[3..] {
                let a = luminance(background);
                let b = luminance(foreground);
                let ratio = (a.max(b) + 0.05) / (a.min(b) + 0.05);
                assert!(ratio >= 4.5, "{foreground} on {background}: {ratio}");
            }
        }
    }
    // ink-3 is deliberately preserved as a token, not used for readable text.
    assert!(css.contains("--ink-3: #85847d;"));
    assert!(css.contains("--ink-3: #7d7c77;"));
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
