use super::protocol::{Query, Source};
use lkjstr_protocol::{NostrEvent, reply_parent};
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
    let matches_language = |lang: &str| {
        e.tags.iter().any(|tag| {
            tag.first()
                .is_some_and(|key| matches!(key.as_str(), "L" | "l"))
                && tag.get(1).is_some_and(|value| value == lang)
        }) || (matches!(lang, "en" | "ja")
            && crate::reading::language_matches(&e.content, lang == "ja"))
    };
    if let Some(languages) = f
        .languages
        .as_ref()
        .filter(|languages| !languages.is_empty())
    {
        if !languages.iter().any(|lang| matches_language(lang)) {
            return false;
        }
    } else if f
        .language
        .as_deref()
        .is_some_and(|lang| !matches_language(lang))
    {
        return false;
    }
    !(q.source == Source::Notifications
        && f.types.as_ref().is_some_and(|types| {
            !types.iter().any(|t| match t.as_str() {
                "all" => true,
                "replies" => crate::kinds::policy(e.kind).reply && reply_parent(e).is_some(),
                "mentions" => crate::kinds::policy(e.kind).reply,
                "reposts" => {
                    crate::kinds::policy(e.kind).act == Some(crate::kinds::ActKind::Repost)
                }
                "reactions" => {
                    crate::kinds::policy(e.kind).act == Some(crate::kinds::ActKind::Reaction)
                }
                "zaps" => crate::kinds::policy(e.kind).act == Some(crate::kinds::ActKind::Zap),
                _ => false,
            })
        }))
}

/// These views have no event source until an account is selected.
pub(super) fn signed_out(q: &Query) -> bool {
    q.account.is_none()
        && matches!(
            q.source,
            Source::Home
                | Source::Notifications
                | Source::Bookmarks
                | Source::Mutes
                | Source::Emoji
                | Source::MediaServers
        )
}
