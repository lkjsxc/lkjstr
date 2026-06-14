use lkjstr_protocol::{
    ContentAttachment, ContentAttachmentKind, NostrEvent, classify_url, content_attachments,
    content_urls, embedded_media_attachments,
};

#[test]
fn classifies_direct_media_links_and_imeta_urls() {
    let attachments = content_attachments(&event(
        "https://example.com/a.jpg https://example.com/v.mp4 https://example.com/p",
        vec![
            vec![
                "imeta".to_owned(),
                "url https://example.com/audio.ogg".to_owned(),
                "m audio/ogg".to_owned(),
            ],
            vec![
                "imeta".to_owned(),
                "url https://example.com/ratio.jpg".to_owned(),
                "m image/jpeg".to_owned(),
                "dim 4x3".to_owned(),
            ],
        ],
    ));

    assert_eq!(
        attachments,
        vec![
            attachment(
                "https://example.com/audio.ogg",
                ContentAttachmentKind::Audio,
                None
            ),
            attachment(
                "https://example.com/ratio.jpg",
                ContentAttachmentKind::Image,
                Some("4 / 3"),
            ),
            attachment(
                "https://example.com/a.jpg",
                ContentAttachmentKind::Image,
                None
            ),
            attachment(
                "https://example.com/v.mp4",
                ContentAttachmentKind::Video,
                None
            ),
            attachment("https://example.com/p", ContentAttachmentKind::Link, None),
        ]
    );
}

#[test]
fn ignores_invalid_non_https_and_duplicate_media_urls() {
    let event = event(
        "http://example.com/a.jpg https://example.com/a.jpg, https://example.com/a.jpg!",
        vec![vec![
            "imeta".to_owned(),
            "url http://example.com/a.jpg".to_owned(),
            "m image/jpeg".to_owned(),
        ]],
    );

    assert_eq!(
        embedded_media_attachments(&event),
        vec![attachment(
            "https://example.com/a.jpg",
            ContentAttachmentKind::Image,
            None
        )]
    );
}

#[test]
fn extracts_clean_https_urls_from_content_text() {
    assert_eq!(
        content_urls("(https://example.com/a.webp), https://example.com/b.mp3!"),
        vec![
            "https://example.com/a.webp".to_owned(),
            "https://example.com/b.mp3".to_owned(),
        ]
    );
    assert_eq!(
        classify_url("https://example.com/file.mov?download=1").kind,
        ContentAttachmentKind::Video
    );
}

fn attachment(
    url: &str,
    kind: ContentAttachmentKind,
    aspect_ratio: Option<&str>,
) -> ContentAttachment {
    ContentAttachment {
        url: url.to_owned(),
        kind,
        aspect_ratio: aspect_ratio.map(ToOwned::to_owned),
    }
}

fn event(content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content: content.to_owned(),
        sig: "c".repeat(128),
    }
}
