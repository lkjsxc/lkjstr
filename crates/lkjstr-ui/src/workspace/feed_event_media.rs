use leptos::prelude::*;
use lkjstr_app::feed::{FeedEventMediaAttachment, FeedEventMediaKind};

#[derive(Clone, Debug, Eq, PartialEq)]
struct MediaAttachmentAttrs {
    row_key: String,
    item_index: String,
    url: String,
    kind: FeedEventMediaKind,
    aspect_ratio: Option<String>,
    loading: &'static str,
    referrer_policy: &'static str,
}

pub(super) fn media_attachment(media: FeedEventMediaAttachment) -> impl IntoView {
    let attrs = media_attachment_attrs(&media);
    match attrs.kind {
        FeedEventMediaKind::Image => media_image(attrs).into_any(),
        FeedEventMediaKind::Video => media_video(attrs).into_any(),
        FeedEventMediaKind::Audio => media_audio(attrs).into_any(),
    }
}

fn media_image(attrs: MediaAttachmentAttrs) -> impl IntoView {
    view! {
        <a
            class="media-embed media-embed--image-link"
            href=attrs.url.clone()
            target="_blank"
            rel="noopener noreferrer"
            data-row-key=attrs.row_key
            data-item-index=attrs.item_index
        >
            <span
                class="media-embed__image-box"
                style:aspect-ratio=attrs.aspect_ratio
            >
                <img
                    class="media-embed__image"
                    src=attrs.url.clone()
                    alt=""
                    loading=attrs.loading
                    referrerpolicy=attrs.referrer_policy
                />
            </span>
        </a>
    }
}

fn media_video(attrs: MediaAttachmentAttrs) -> impl IntoView {
    view! {
        <div
            class="media-embed media-embed--video"
            style:aspect-ratio=attrs.aspect_ratio
            data-row-key=attrs.row_key
            data-item-index=attrs.item_index
        >
            <video src=attrs.url.clone() controls></video>
            <a href=attrs.url target="_blank" rel="noopener noreferrer">"Open video"</a>
        </div>
    }
}

fn media_audio(attrs: MediaAttachmentAttrs) -> impl IntoView {
    view! {
        <div
            class="media-embed media-embed--audio"
            data-row-key=attrs.row_key
            data-item-index=attrs.item_index
        >
            <audio src=attrs.url.clone() controls></audio>
            <a href=attrs.url target="_blank" rel="noopener noreferrer">"Open audio"</a>
        </div>
    }
}

fn media_attachment_attrs(media: &FeedEventMediaAttachment) -> MediaAttachmentAttrs {
    MediaAttachmentAttrs {
        row_key: media.row_key.clone(),
        item_index: media.item_index.to_string(),
        url: media.url.clone(),
        kind: media.kind.clone(),
        aspect_ratio: media.aspect_ratio.clone(),
        loading: "lazy",
        referrer_policy: "no-referrer",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_attachment_attrs_keep_real_url_and_fragment_identity() {
        let attrs = media_attachment_attrs(&FeedEventMediaAttachment {
            row_key: "event:e:shape:s:kind:event-media-attachment:index:1".to_owned(),
            item_index: 1,
            url: "https://cdn.example/image.png".to_owned(),
            kind: FeedEventMediaKind::Image,
            aspect_ratio: Some("4 / 3".to_owned()),
        });

        assert_eq!(
            attrs,
            MediaAttachmentAttrs {
                row_key: "event:e:shape:s:kind:event-media-attachment:index:1".to_owned(),
                item_index: "1".to_owned(),
                url: "https://cdn.example/image.png".to_owned(),
                kind: FeedEventMediaKind::Image,
                aspect_ratio: Some("4 / 3".to_owned()),
                loading: "lazy",
                referrer_policy: "no-referrer",
            }
        );
    }
}
