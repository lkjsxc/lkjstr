use super::{
    protocol::Query,
    query_predicates::matches_extra,
    settings::{PrivateLists, list_has, list_tags},
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
    reason(store, q.account.as_deref(), e, private).map(|reason| {
        match reason {
            Reason::MutedPerson => "muted-person",
            Reason::MutedThread => "muted-thread",
            Reason::MutedWord => "muted-word",
            Reason::MutedHashtag => "muted-hashtag",
            _ => unreachable!("only mute reasons come from a mute list"),
        }
        .into()
    })
}

pub(super) fn reason(
    store: &Store,
    account: Option<&str>,
    e: &NostrEvent,
    private: &PrivateLists,
) -> Option<Reason> {
    let account = account?;
    if list_has(store, private, Some(account), 10000, "p", &e.pubkey) {
        return Some(Reason::MutedPerson);
    }
    if [
        Some(e.id.clone()),
        reply_parent(e),
        (e.kind != 42).then(|| reply_root(e)).flatten(),
    ]
    .into_iter()
    .flatten()
    .any(|id| list_has(store, private, Some(account), 10000, "e", &id))
    {
        return Some(Reason::MutedThread);
    }
    let mute = store.replaceable(account, 10000)?;
    let tags = list_tags(&mute, private);
    [Reason::MutedWord, Reason::MutedHashtag]
        .into_iter()
        .find(|reason| matching_entry(&tags, e, *reason).is_some())
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
