//! A value skipped by a resource budget cannot prove complete empty membership.
use super::{MAX_CODE, MAX_IDENTIFIER, MAX_TAGS, MAX_URL};
use lkjstr_protocol::NostrEvent;

pub(super) fn limited(event: &NostrEvent) -> bool {
    event.tags.len() > MAX_TAGS
        || event
            .tags
            .iter()
            .take(MAX_TAGS)
            .any(|tag| match tag.first().map(String::as_str) {
                Some("emoji") => {
                    tag.get(1).is_some_and(|s| s.len() > MAX_CODE)
                        || tag.get(2).is_some_and(|s| s.len() > MAX_URL)
                }
                Some("a") if event.kind == 10030 => {
                    tag.get(1).is_some_and(|value| limited_reference(value))
                }
                _ => false,
            })
}

fn limited_reference(value: &str) -> bool {
    if value.len() <= 6 + 64 + 1 + MAX_IDENTIFIER {
        return false;
    }
    // Borrow only the coordinate header: do not allocate the over-budget identifier.
    let mut parts = value.splitn(3, ':');
    parts.next().and_then(|kind| kind.parse::<u16>().ok()) == Some(30030)
        && parts.next().is_some_and(lkjstr_protocol::is_pubkey)
        && parts
            .next()
            .is_some_and(|identifier| !identifier.is_empty())
}
