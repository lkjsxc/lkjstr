use super::protocol::{Query, Source};
use lkjstr_protocol::{NostrEvent, reply_parent, tags::tag_values};
pub(super) fn matches_extra(e: &NostrEvent, q: &Query) -> bool {
    let f = &q.filters;
    if f.since.is_some_and(|s| e.created_at < s)
        || f.until.is_some_and(|u| e.created_at > u)
        || f.replies.is_some_and(|v| reply_parent(e).is_some() != v)
        || f.reposts.is_some_and(|v| (e.kind == 6) != v)
        || f.media
            .is_some_and(|v| !lkjstr_protocol::embedded_media_attachments(e).is_empty() != v)
        || f.text.as_ref().is_some_and(|t| {
            !t.split_whitespace()
                .all(|w| e.content.to_lowercase().contains(&w.to_lowercase()))
        })
    {
        return false;
    }
    let text = e.content.to_lowercase();
    if f.phrases
        .as_ref()
        .is_some_and(|v| v.iter().any(|x| !text.contains(&x.to_lowercase())))
        || f.exclude
            .as_ref()
            .is_some_and(|v| v.iter().any(|x| text.contains(&x.to_lowercase())))
        || f.has
            .as_ref()
            .is_some_and(|v| v.iter().any(|x| !super::rich::has(e, x)))
        || (q.source == Source::Profile
            && match f.show.as_deref() {
                Some("posts") => reply_parent(e).is_some(),
                Some("replies") => reply_parent(e).is_none(),
                Some("media") => !super::rich::has(e, "image") && !super::rich::has(e, "video"),
                _ => false,
            })
    {
        return false;
    }
    if let Some(lang) = &f.language {
        let tagged = tag_values(e, "L")
            .into_iter()
            .chain(tag_values(e, "l"))
            .any(|l| l == *lang);
        if !tagged
            && (!matches!(lang.as_str(), "en" | "ja")
                || !crate::reading::language_matches(&e.content, lang == "ja"))
        {
            return false;
        }
    }
    !(q.source == Source::Notifications
        && f.types.as_ref().is_some_and(|types| {
            !types.iter().any(|t| match t.as_str() {
                "all" => true,
                "replies" => matches!(e.kind, 1 | 42) && reply_parent(e).is_some(),
                "mentions" => matches!(e.kind, 1 | 42),
                "reposts" => matches!(e.kind, 6 | 16),
                "reactions" => e.kind == 7,
                "zaps" => e.kind == 9735,
                _ => false,
            })
        }))
}
