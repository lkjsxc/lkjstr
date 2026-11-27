use super::{
    protocol::{Query, Source},
    query_predicates::matches_extra,
    settings::{PrivateLists, list_tags},
    visibility::Reason,
};
use crate::store::Store;
use lkjstr_protocol::{NostrEvent, reply_parent, reply_root, tags::tag_values};
pub fn hidden(store: &Store, q: &Query, e: &NostrEvent) -> Option<String> {
    hidden_with_lists(store, q, e, &Default::default())
}
pub fn hidden_with_lists(
    store: &Store,
    q: &Query,
    e: &NostrEvent,
    private: &PrivateLists,
) -> Option<String> {
    reason(store, q, e, private).map(|reason| {
        match reason {
            Reason::MutedPerson => "muted-person",
            Reason::MutedThread => "muted-thread",
            Reason::MutedWord => "muted-word",
            Reason::MutedHashtag => "muted-hashtag",
            Reason::TheirMutedPerson => "their-muted-person",
            Reason::TheirMutedThread => "their-muted-thread",
            Reason::TheirMutedWord => "their-muted-word",
            Reason::TheirMutedHashtag => "their-muted-hashtag",
            _ => unreachable!("only mute reasons come from a mute list"),
        }
        .into()
    })
}

pub(super) fn reason(
    store: &Store,
    query: &Query,
    event: &NostrEvent,
    private: &PrivateLists,
) -> Option<Reason> {
    // The viewer's own public/private choice takes precedence in every view.
    query
        .account
        .as_deref()
        .and_then(|account| store.replaceable(account, 10000))
        .and_then(|list| tag_reason(&list_tags(&list, private), event))
        .or_else(|| their_reason(store, query, event))
}

/// A muted signed repost keeps its own covered slot. Other admissions of its
/// original remain independent, so an unmuted author can still surface it.
pub(super) fn their_repost(store: &Store, query: &Query, event: &NostrEvent) -> bool {
    event.kind == 6 && their_reason(store, query, event).is_some()
}

pub(super) fn their_reason(store: &Store, query: &Query, event: &NostrEvent) -> Option<Reason> {
    if query.source != Source::TheirHome {
        return None;
    }
    // A viewed owner's public mute list is read policy for this query only.
    // Never consult PrivateLists: it can also contain another saved account's entries.
    let list = store.replaceable(query.target.as_deref()?, 10000)?;
    tag_reason(&list.tags, event).map(|reason| match reason {
        Reason::MutedPerson => Reason::TheirMutedPerson,
        Reason::MutedThread => Reason::TheirMutedThread,
        Reason::MutedWord => Reason::TheirMutedWord,
        Reason::MutedHashtag => Reason::TheirMutedHashtag,
        _ => unreachable!("only mute reasons come from a mute list"),
    })
}

fn tag_reason(tags: &[Vec<String>], event: &NostrEvent) -> Option<Reason> {
    let has = |key: &str, value: &str| {
        tags.iter().any(|tag| {
            tag.first().is_some_and(|name| name == key)
                && tag.get(1).is_some_and(|entry| entry == value)
        })
    };
    if has("p", &event.pubkey) {
        return Some(Reason::MutedPerson);
    }
    let parent = reply_parent(event);
    let root = (event.kind != 42).then(|| reply_root(event)).flatten();
    if [Some(event.id.as_str()), parent.as_deref(), root.as_deref()]
        .into_iter()
        .flatten()
        .any(|id| has("e", id))
    {
        return Some(Reason::MutedThread);
    }
    [Reason::MutedWord, Reason::MutedHashtag]
        .into_iter()
        .find(|reason| matching_entry(tags, event, *reason).is_some())
}

pub(in crate::engine) fn matches_note(store: &Store, q: &Query, e: &NostrEvent) -> bool {
    super::rich::authors(store, q)
        .as_ref()
        .is_none_or(|a| a.contains(&e.pubkey))
        && matches_extra(e, q)
}

fn matching_entry<'a>(
    tags: &'a [Vec<String>],
    event: &NostrEvent,
    reason: Reason,
) -> Option<&'a str> {
    let (key, content, hashtags) = match reason {
        Reason::MutedWord => ("word", event.content.to_lowercase(), Vec::new()),
        Reason::MutedHashtag => ("t", String::new(), tag_values(event, "t")),
        _ => return None,
    };
    tags.iter()
        .filter_map(|tag| {
            (tag.first()?.as_str() == key)
                .then(|| tag.get(1).map(String::as_str))
                .flatten()
        })
        .find(|value| {
            !value.is_empty()
                && if reason == Reason::MutedWord {
                    content.contains(&value.to_lowercase())
                } else {
                    hashtags.iter().any(|tag| tag.eq_ignore_ascii_case(value))
                }
        })
}

pub(super) fn detail(
    store: &Store,
    account: Option<&str>,
    event: &NostrEvent,
    reason: Reason,
    private: &PrivateLists,
) -> Option<String> {
    if !matches!(reason, Reason::MutedWord | Reason::MutedHashtag) {
        return None;
    }
    let list = store.replaceable(account?, 10000)?;
    matching_entry(&list_tags(&list, private), event, reason)
        .map(|value| value.chars().take(160).collect())
}
