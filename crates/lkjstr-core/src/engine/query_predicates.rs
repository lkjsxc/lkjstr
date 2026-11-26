use super::{
    acts,
    protocol::{Query, Source},
};
use crate::{
    kinds::policy,
    store::{Event, Store},
};
use lkjstr_protocol::{NostrEvent, NostrFilter, reply_parent};
pub(super) fn matches_extra(e: &NostrEvent, q: &Query) -> bool {
    matches_fields(e, q, false)
}

fn matches_fields(e: &NostrEvent, q: &Query, repost_target: bool) -> bool {
    let f = &q.filters;
    // Repost placement already matched the date and kind; these fields describe the target.
    if (!repost_target
        && (f.since.is_some_and(|s| e.created_at < s)
            || f.until.is_some_and(|u| e.created_at > u)
            || f.reposts.is_some_and(|v| (e.kind == 6) != v)))
        || f.replies.is_some_and(|v| reply_parent(e).is_some() != v)
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
        || (!repost_target
            && q.source == Source::Profile
            && match f.show.as_deref() {
                None | Some("posts") => reply_parent(e).is_some(),
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

pub(super) fn accepts(
    store: &Store,
    q: &Query,
    e: &lkjstr_protocol::NostrEvent,
    f: &NostrFilter,
    authors: &Option<Vec<String>>,
) -> bool {
    policy(e.kind).openable
        && (q.source != Source::Channel
            || lkjstr_protocol::channel_id(e).as_ref() == q.target.as_ref())
        && authors.as_ref().is_none_or(|a| a.contains(&e.pubkey))
        // One relay's notes are the ones it served, not every cached note it might hold.
        && (q.source != Source::Relay
            || q.target.as_ref().is_some_and(|r| store.seen_on(&e.id).contains(r)))
        && (q.source == Source::Bookmarks || lkjstr_protocol::matches_filter(e, f))
        && (q.source != Source::Profile
            || q.filters.show.as_deref() != Some("lists")
            || crate::kinds::is_public_list(e.kind))
        && if q.source == Source::Profile
            && matches!(q.filters.show.as_deref(), Some("reposts" | "reactions"))
        {
            super::acts::matches_terminal(store, e, q)
        } else if profile_posts(q) && acts::is_repost(e.kind) {
            acts::target(e).is_some_and(|id| {
                store.get(&id).is_none_or(|target| {
                    policy(target.kind).openable && matches_fields(&target, q, true)
                })
            })
        } else if e.kind == 6 && q.source != Source::Notifications {
            q.filters.reposts != Some(false)
                && super::acts::target(e)
                    .and_then(|id| store.get(&id))
                    .is_none_or(|target| super::query_hidden::matches_note(store, q, &target))
        } else {
            matches_extra(e, q)
        }
}

pub(super) fn profile_posts(q: &Query) -> bool {
    q.source == Source::Profile && matches!(q.filters.show.as_deref(), None | Some("posts"))
}

pub(super) fn collapse_repost(store: &Store, q: &Query, event: Event) -> Option<Event> {
    if !(event.kind == 6 || (profile_posts(q) && acts::is_repost(event.kind)))
        || q.source == Source::Notifications
        || q.filters.show.as_deref() == Some("reposts")
    {
        return Some(event);
    }
    let target = acts::target(&event).and_then(|id| store.get(&id));
    if target.as_ref().is_some_and(|target| target.kind == 42)
        && matches!(
            q.source,
            Source::Home
                | Source::TheirHome
                | Source::Global
                | Source::Relay
                | Source::Hashtag
                | Source::Search
                | Source::List
        )
    {
        return None;
    }
    target.or(Some(event))
}
