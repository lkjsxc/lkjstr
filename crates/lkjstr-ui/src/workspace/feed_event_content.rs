use leptos::prelude::*;
use lkjstr_app::feed::{
    FeedEventContent, FeedEventContentRow, FeedEventCustomEmoji, FeedEventUnavailablePreview,
};

use super::feed_event_link::event_link;
use super::feed_event_media::media_attachment;
use super::feed_event_profile_mention::profile_mention;
use super::feed_event_reference::reference_unavailable;
use super::feed_event_repost_target::{repost_target, repost_target_shell};
use super::feed_event_sensitive::sensitive_warning;

#[derive(Clone, Debug, Eq, PartialEq)]
struct CustomEmojiImageAttrs {
    row_key: String,
    item_index: String,
    class_name: &'static str,
    src: String,
    alt: String,
    title: String,
    address: String,
    loading: &'static str,
    referrer_policy: &'static str,
}
#[derive(Clone, Debug, Eq, PartialEq)]
struct UnavailablePreviewAttrs {
    row_key: String,
    segment_index: String,
    label: &'static str,
}

pub(crate) fn event_content_with_openers(
    content: FeedEventContent,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    match content {
        FeedEventContent::Sensitive { reason, rows } => {
            sensitive_content(reason, rows, open_profile, open_thread)
        }
        FeedEventContent::Rows(rows) => text_rows_view(rows, open_profile, open_thread),
    }
}

fn sensitive_content(
    reason: Option<String>,
    rows: Vec<FeedEventContentRow>,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    let revealed = RwSignal::new(false);
    view! {
        {move || {
            if revealed.get() {
                text_rows_view(rows.clone(), open_profile, open_thread).into_any()
            } else {
                sensitive_warning(reason.clone(), revealed).into_any()
            }
        }}
    }
    .into_any()
}

fn text_rows_view(
    rows: Vec<FeedEventContentRow>,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    rows.into_iter()
        .map(|row| content_row(row, open_profile, open_thread))
        .collect_view()
        .into_any()
}

fn content_row(
    row: FeedEventContentRow,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    match row {
        FeedEventContentRow::Text(text) => view! { <p>{text}</p> }.into_any(),
        FeedEventContentRow::Link(link) => event_link(link).into_any(),
        FeedEventContentRow::ProfileMention(mention) => {
            profile_mention(mention, open_profile).into_any()
        }
        FeedEventContentRow::CustomEmoji(emoji) => custom_emoji(emoji).into_any(),
        FeedEventContentRow::MediaAttachment(media) => media_attachment(media).into_any(),
        FeedEventContentRow::RepostTarget(target) => {
            repost_target(target, open_profile, open_thread)
        }
        FeedEventContentRow::RepostTargetShell(shell) => repost_target_shell(shell).into_any(),
        FeedEventContentRow::MediaPreviewUnavailable(preview) => {
            unavailable_preview(preview, "Media preview unavailable").into_any()
        }
        FeedEventContentRow::ReferenceUnavailable(reference) => {
            reference_unavailable(reference, open_thread).into_any()
        }
        FeedEventContentRow::ReferencePreviewUnavailable(preview) => {
            unavailable_preview(preview, "Reference preview unavailable").into_any()
        }
    }
}

fn unavailable_preview(preview: FeedEventUnavailablePreview, label: &'static str) -> impl IntoView {
    let attrs = unavailable_preview_attrs(preview, label);
    view! {
        <p
            data-row-key=attrs.row_key
            data-segment-index=attrs.segment_index
        >
            {attrs.label}
        </p>
    }
}

fn unavailable_preview_attrs(
    preview: FeedEventUnavailablePreview,
    label: &'static str,
) -> UnavailablePreviewAttrs {
    UnavailablePreviewAttrs {
        row_key: preview.row_key,
        segment_index: preview.segment_index.to_string(),
        label,
    }
}

fn custom_emoji(emoji: FeedEventCustomEmoji) -> impl IntoView {
    let attrs = custom_emoji_image_attrs(&emoji);
    view! {
        <p>
            <img
                class=attrs.class_name
                src=attrs.src
                alt=attrs.alt
                title=attrs.title
                data-address=attrs.address
                data-row-key=attrs.row_key
                data-item-index=attrs.item_index
                loading=attrs.loading
                referrerpolicy=attrs.referrer_policy
            />
        </p>
    }
}

fn custom_emoji_image_attrs(emoji: &FeedEventCustomEmoji) -> CustomEmojiImageAttrs {
    let token = format!(":{}:", emoji.shortcode);
    CustomEmojiImageAttrs {
        row_key: emoji.row_key.clone(),
        item_index: emoji.item_index.to_string(),
        class_name: "custom-emoji",
        src: emoji.url.clone(),
        alt: token.clone(),
        title: token,
        address: emoji.address.clone().unwrap_or_default(),
        loading: "lazy",
        referrer_policy: "no-referrer",
    }
}
#[cfg(test)]
#[path = "feed_event_content_tests.rs"]
mod tests;
