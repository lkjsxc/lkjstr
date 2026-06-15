use super::*;

#[test]
fn custom_emoji_attrs_keep_real_url_and_safe_image_policy() {
    let attrs = custom_emoji_image_attrs(&FeedEventCustomEmoji {
        row_key: "event:event:shape:shape:kind:event-custom-emoji:index:0".to_owned(),
        item_index: 0,
        shortcode: "party".to_owned(),
        url: "https://emoji.example/party.png".to_owned(),
        address: Some(format!("30030:{}:set", "a".repeat(64))),
    });

    assert_eq!(
        attrs,
        CustomEmojiImageAttrs {
            row_key: "event:event:shape:shape:kind:event-custom-emoji:index:0".to_owned(),
            item_index: "0".to_owned(),
            class_name: "custom-emoji",
            src: "https://emoji.example/party.png".to_owned(),
            alt: ":party:".to_owned(),
            title: ":party:".to_owned(),
            address: format!("30030:{}:set", "a".repeat(64)),
            loading: "lazy",
            referrer_policy: "no-referrer",
        }
    );
}

#[test]
fn unavailable_preview_attrs_keep_fragment_identity() {
    let attrs = unavailable_preview_attrs(
        FeedEventUnavailablePreview {
            row_key: "event:shape:event-media-segment:2".to_owned(),
            segment_index: 2,
        },
        "Media preview unavailable",
    );

    assert_eq!(
        attrs,
        UnavailablePreviewAttrs {
            row_key: "event:shape:event-media-segment:2".to_owned(),
            segment_index: "2".to_owned(),
            label: "Media preview unavailable",
        }
    );
}
