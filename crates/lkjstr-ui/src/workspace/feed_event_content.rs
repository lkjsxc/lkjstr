use leptos::{ev::MouseEvent, prelude::*};
use lkjstr_app::feed::{
    FeedEventContent, FeedEventContentRow, FeedEventCustomEmoji, FeedEventUnavailablePreview,
};

use super::feed_event_link::event_link;
use super::feed_event_media::media_attachment;
use super::feed_event_profile_mention::profile_mention;
use super::feed_event_reference::reference_unavailable;

#[derive(Clone, Debug, Eq, PartialEq)]
struct CustomEmojiImageAttrs {
    class_name: &'static str,
    src: String,
    alt: String,
    title: String,
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
) -> impl IntoView {
    match content {
        FeedEventContent::Sensitive { reason, rows } => {
            sensitive_content(reason, rows, open_profile, open_thread).into_any()
        }
        FeedEventContent::Rows(rows) => text_rows_view(rows, open_profile, open_thread).into_any(),
    }
}

fn sensitive_content(
    reason: Option<String>,
    rows: Vec<FeedEventContentRow>,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
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
}

fn sensitive_warning(reason: Option<String>, revealed: RwSignal<bool>) -> impl IntoView {
    let reveal = move |_event: MouseEvent| revealed.set(true);
    view! {
        <aside class="content-warning">
            <strong>"Sensitive content"</strong>
            {warning_reason(reason)}
            <button type="button" on:click=reveal>"Reveal"</button>
        </aside>
    }
}

fn warning_reason(reason: Option<String>) -> impl IntoView {
    reason.map(|reason| view! { <span>{reason}</span> })
}

fn text_rows_view(
    rows: Vec<FeedEventContentRow>,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    rows.into_iter()
        .map(|row| content_row(row, open_profile, open_thread).into_any())
        .collect_view()
}

fn content_row(
    row: FeedEventContentRow,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    match row {
        FeedEventContentRow::Text(text) => view! { <p>{text}</p> }.into_any(),
        FeedEventContentRow::Link(link) => event_link(link).into_any(),
        FeedEventContentRow::ProfileMention(mention) => {
            profile_mention(mention, open_profile).into_any()
        }
        FeedEventContentRow::CustomEmoji(emoji) => custom_emoji(emoji).into_any(),
        FeedEventContentRow::MediaAttachment(media) => media_attachment(media).into_any(),
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
                loading=attrs.loading
                referrerpolicy=attrs.referrer_policy
            />
        </p>
    }
}

fn custom_emoji_image_attrs(emoji: &FeedEventCustomEmoji) -> CustomEmojiImageAttrs {
    let token = format!(":{}:", emoji.shortcode);
    CustomEmojiImageAttrs {
        class_name: "custom-emoji",
        src: emoji.url.clone(),
        alt: token.clone(),
        title: token,
        loading: "lazy",
        referrer_policy: "no-referrer",
    }
}

#[cfg(test)]
#[path = "feed_event_content_tests.rs"]
mod tests;
