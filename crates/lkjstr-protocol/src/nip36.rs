use crate::{NostrEvent, NostrTag};

pub fn content_warning_reason(event: &NostrEvent) -> Option<String> {
    event
        .tags
        .iter()
        .find(|tag| tag.first().is_some_and(|name| name == "content-warning"))
        .map(|tag| tag.get(1).map_or("", String::as_str).trim().to_owned())
}

pub fn has_content_warning(event: &NostrEvent) -> bool {
    content_warning_reason(event).is_some()
}

pub fn content_warning_tag(reason: &str) -> NostrTag {
    let trimmed = reason.trim();
    if trimmed.is_empty() {
        vec!["content-warning".to_owned()]
    } else {
        vec!["content-warning".to_owned(), trimmed.to_owned()]
    }
}
