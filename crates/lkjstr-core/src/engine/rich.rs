//! Protocol 3 predicates. Name resolution is bounded by the retained profile store.
use super::protocol::Query;
use crate::store::Store;
use lkjstr_protocol::{ContentAttachmentKind, NostrEntity, NostrEvent};
pub(super) fn authors(store: &Store, q: &Query) -> Option<Vec<String>> {
    let from = q.filters.from.as_ref().filter(|v| !v.is_empty());
    let Some(from) = from else {
        return q.filters.authors.clone();
    };
    let mut out = q.filters.authors.clone().unwrap_or_default();
    for typed in from {
        if let Some(key) = store.query_name(typed) {
            out.push(key);
            continue;
        }
        match lkjstr_protocol::decode_nip19(typed.strip_prefix("nostr:").unwrap_or(typed)) {
            Some(NostrEntity::Npub(key)) => out.push(key),
            Some(NostrEntity::Nprofile(profile)) => out.push(profile.pubkey),
            _ => {
                let found = store.search_people(typed, 6000);
                let exact: Vec<_> = found
                    .iter()
                    .filter(|key| {
                        store.profile(key).is_some_and(|p| {
                            [&p.name, &p.display_name, &p.nip05]
                                .iter()
                                .any(|s| s.eq_ignore_ascii_case(typed))
                        })
                    })
                    .cloned()
                    .collect();
                out.extend(if exact.is_empty() { found } else { exact });
            }
        }
    }
    out.sort();
    out.dedup();
    Some(out)
}
pub(super) fn has(e: &NostrEvent, kind: &str) -> bool {
    if kind == "link" {
        let mut parts = crate::content::segments(&e.content, &[]);
        super::row_media::attachments(e, &mut parts);
        return parts
            .iter()
            .any(|p| matches!(p, crate::content::Segment::Link(_)));
    }
    lkjstr_protocol::embedded_media_attachments(e)
        .iter()
        .any(|m| {
            matches!(
                (kind, &m.kind),
                ("image", ContentAttachmentKind::Image) | ("video", ContentAttachmentKind::Video)
            )
        })
}

pub(super) fn anchored(e: &NostrEvent, key: &str, q: &Query) -> bool {
    if e.id == key || (q.source == super::protocol::Source::Followers && e.pubkey == key) {
        return true;
    }
    if q.source == super::protocol::Source::Profile
        && matches!(q.filters.show.as_deref(), Some("reposts" | "reactions"))
    {
        return lkjstr_protocol::tags::tag_values(e, "e")
            .last()
            .is_some_and(|id| id == key);
    }
    if q.filters.notifications == Some(true) || q.source == super::protocol::Source::Notifications {
        let kind = match e.kind {
            6 => "repost",
            7 => "reaction",
            _ => return false,
        };
        let target = lkjstr_protocol::tags::tag_values(e, "e")
            .last()
            .cloned()
            .unwrap_or_default();
        let content = if e.kind == 7 {
            crate::reactions::label(&e.content)
        } else {
            ""
        };
        return key == format!("notification:{kind}:{target}:{content}");
    }
    false
}
