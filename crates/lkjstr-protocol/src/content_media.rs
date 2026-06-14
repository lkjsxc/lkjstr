use crate::NostrEvent;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ContentAttachmentKind {
    Image,
    Video,
    Audio,
    Link,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentAttachment {
    pub url: String,
    pub kind: ContentAttachmentKind,
    pub aspect_ratio: Option<String>,
}

#[must_use]
pub fn content_attachments(event: &NostrEvent) -> Vec<ContentAttachment> {
    dedupe(
        imeta_attachments(&event.tags)
            .into_iter()
            .chain(
                content_urls(&event.content)
                    .into_iter()
                    .map(|url| classify_url(&url)),
            )
            .collect(),
    )
}

#[must_use]
pub fn content_urls(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut urls = Vec::new();
    let mut index = 0;
    while let Some(offset) = content[index..].find("https://") {
        let start = index + offset;
        if start > 0 && is_ascii_word(bytes[start - 1]) {
            index = start + 1;
            continue;
        }
        let end = scan_url_end(bytes, start);
        if let Some(url) = clean_https_url(&content[start..end]) {
            urls.push(url);
        }
        index = end;
    }
    urls
}

#[must_use]
pub fn classify_url(url: &str) -> ContentAttachment {
    let clean = clean_url(url);
    let lower = clean.to_lowercase();
    ContentAttachment {
        kind: classify_lower_url(&lower),
        url: clean,
        aspect_ratio: None,
    }
}

#[must_use]
pub fn embedded_media_attachments(event: &NostrEvent) -> Vec<ContentAttachment> {
    content_attachments(event)
        .into_iter()
        .filter(|item| !matches!(item.kind, ContentAttachmentKind::Link))
        .collect()
}

fn imeta_attachments(tags: &[Vec<String>]) -> Vec<ContentAttachment> {
    tags.iter()
        .filter(|tag| tag.first().is_some_and(|name| name == "imeta"))
        .filter_map(|tag| imeta_attachment(tag))
        .collect()
}

fn imeta_attachment(tag: &[String]) -> Option<ContentAttachment> {
    let url = tag_token(tag, "url").and_then(clean_https_url)?;
    let mime = tag_token(tag, "m").unwrap_or_default().to_lowercase();
    let kind = if mime.starts_with("image/") {
        ContentAttachmentKind::Image
    } else if mime.starts_with("video/") {
        ContentAttachmentKind::Video
    } else if mime.starts_with("audio/") {
        ContentAttachmentKind::Audio
    } else {
        classify_lower_url(&url.to_lowercase())
    };
    Some(ContentAttachment {
        url,
        kind,
        aspect_ratio: aspect_ratio_from_dim(tag_token(tag, "dim")),
    })
}

fn tag_token<'a>(tag: &'a [String], name: &str) -> Option<&'a str> {
    let prefix = format!("{name} ");
    tag.iter()
        .find(|item| item.starts_with(&prefix))
        .map(|item| &item[prefix.len()..])
}

fn classify_lower_url(lower: &str) -> ContentAttachmentKind {
    let path = lower.split(['?', '#']).next().unwrap_or(lower);
    if ends_with_any(path, &[".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]) {
        ContentAttachmentKind::Image
    } else if ends_with_any(path, &[".mp4", ".webm", ".mov", ".m4v"]) {
        ContentAttachmentKind::Video
    } else if ends_with_any(path, &[".mp3", ".m4a", ".ogg", ".opus", ".wav", ".flac"]) {
        ContentAttachmentKind::Audio
    } else {
        ContentAttachmentKind::Link
    }
}

fn ends_with_any(value: &str, suffixes: &[&str]) -> bool {
    suffixes.iter().any(|suffix| value.ends_with(suffix))
}

fn aspect_ratio_from_dim(dim: Option<&str>) -> Option<String> {
    let (width, height) = dim?.split_once('x')?;
    let width = width.parse::<u32>().ok()?;
    let height = height.parse::<u32>().ok()?;
    (width > 0 && height > 0).then(|| format!("{width} / {height}"))
}

fn scan_url_end(bytes: &[u8], start: usize) -> usize {
    let mut end = start;
    while end < bytes.len()
        && !matches!(
            bytes[end],
            b' ' | b'\n' | b'\t' | b'<' | b'>' | b'"' | b'\''
        )
    {
        end += 1;
    }
    end
}

fn clean_https_url(value: &str) -> Option<String> {
    let cleaned = clean_url(value);
    (cleaned.starts_with("https://") && url::Url::parse(&cleaned).ok()?.scheme() == "https")
        .then_some(cleaned)
}

fn clean_url(value: &str) -> String {
    value
        .trim_end_matches([')', ',', '.', ';', ':', '!', '?'])
        .to_owned()
}

fn dedupe(items: Vec<ContentAttachment>) -> Vec<ContentAttachment> {
    let mut urls = Vec::<String>::new();
    let mut attachments = Vec::new();
    for item in items {
        if urls.iter().any(|url| url == &item.url) {
            continue;
        }
        urls.push(item.url.clone());
        attachments.push(item);
    }
    attachments
}

fn is_ascii_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}
