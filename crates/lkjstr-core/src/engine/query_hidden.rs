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
        .and_then(|list| {
            let tags = list_tags(&list, private);
            tag_reason(event, |key| values(&tags, key))
        })
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
    // Read public tags directly from the signed list's compact storage. Private
    // list entries belong to the account that decrypted them.
    let list = store.replaceable_lease(query.target.as_deref()?, 10000)?;
    tag_reason(event, |key| list.tag_values(key)).map(|reason| match reason {
        Reason::MutedPerson => Reason::TheirMutedPerson,
        Reason::MutedThread => Reason::TheirMutedThread,
        Reason::MutedWord => Reason::TheirMutedWord,
        Reason::MutedHashtag => Reason::TheirMutedHashtag,
        _ => unreachable!("only mute reasons come from a mute list"),
    })
}

fn values<'a>(tags: &'a [Vec<String>], key: &'a str) -> impl Iterator<Item = &'a str> {
    tags.iter().filter_map(move |tag| {
        (tag.first()?.as_str() == key).then_some(())?;
        tag.get(1).map(String::as_str)
    })
}

fn tag_reason<I: Iterator<Item: AsRef<str>>>(
    event: &NostrEvent,
    values: impl Fn(&'static str) -> I,
) -> Option<Reason> {
    let has = |key, value: &str| values(key).any(|entry| entry.as_ref() == value);
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
    if matching_entry(values("word"), event, Reason::MutedWord).is_some() {
        return Some(Reason::MutedWord);
    }
    matching_entry(values("t"), event, Reason::MutedHashtag).map(|_| Reason::MutedHashtag)
}

pub(in crate::engine) fn matches_note(store: &Store, q: &Query, e: &NostrEvent) -> bool {
    super::rich::authors(store, q)
        .as_ref()
        .is_none_or(|a| a.contains(&e.pubkey))
        && matches_extra(e, q)
}

fn matching_entry<T: AsRef<str>>(
    values: impl Iterator<Item = T>,
    event: &NostrEvent,
    reason: Reason,
) -> Option<T> {
    let mut values = values.filter(|value| !value.as_ref().is_empty()).peekable();
    values.peek()?;
    match reason {
        Reason::MutedWord => {
            let content = event.content.to_lowercase();
            values.find(|value| content.contains(&value.as_ref().to_lowercase()))
        }
        Reason::MutedHashtag => {
            let hashtags = tag_values(event, "t");
            values.find(|value| {
                hashtags
                    .iter()
                    .any(|tag| tag.eq_ignore_ascii_case(value.as_ref()))
            })
        }
        _ => None,
    }
}

pub(super) fn detail(
    store: &Store,
    account: Option<&str>,
    event: &NostrEvent,
    reason: Reason,
    private: &PrivateLists,
) -> Option<String> {
    let key = match reason {
        Reason::MutedWord => "word",
        Reason::MutedHashtag => "t",
        _ => return None,
    };
    let list = store.replaceable(account?, 10000)?;
    let tags = list_tags(&list, private);
    matching_entry(values(&tags, key), event, reason).map(|value| value.chars().take(160).collect())
}
