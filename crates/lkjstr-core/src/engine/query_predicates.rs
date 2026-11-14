use super::protocol::{Query, Source};
use lkjstr_protocol::{NostrEvent, reply_parent, tags::tag_values};
pub(super) fn matches_extra(e: &NostrEvent, q: &Query) -> bool {
    let f = &q.filters;
    if f.authors.as_ref().is_some_and(|a| !a.contains(&e.pubkey))
        || f.since.is_some_and(|s| e.created_at < s)
        || f.until.is_some_and(|u| e.created_at > u)
        || f.replies.is_some_and(|v| reply_parent(e).is_some() != v)
        || f.reposts.is_some_and(|v| (e.kind == 6) != v)
        || f.media
            .is_some_and(|v| !lkjstr_protocol::embedded_media_attachments(e).is_empty() != v)
        || f.text
            .as_ref()
            .is_some_and(|t| !e.content.to_lowercase().contains(&t.to_lowercase()))
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
    if q.source == Source::Notifications
        && f.types.as_ref().is_some_and(|types| {
            !types.iter().any(|t| match t.as_str() {
                "all" => true,
                "replies" => e.kind == 1 && reply_parent(e).is_some(),
                "mentions" => e.kind == 1,
                "reposts" => e.kind == 6,
                "reactions" => e.kind == 7,
                "zaps" => e.kind == 9735,
                "follows" => e.kind == 3,
                _ => false,
            })
        })
    {
        return false;
    }
    true
}
