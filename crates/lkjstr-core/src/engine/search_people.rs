//! At most six suggestions from retained verified profile events; no relay search effect.
use crate::engine::settings::{PrivateLists, list_tags_for};
use crate::store::Store;
use std::collections::{BTreeMap, BTreeSet};
use unicode_normalization::UnicodeNormalization;
pub(super) struct Person {
    pub pubkey: String,
    pub followed: bool,
    pub follows_you: bool,
    pub own: bool,
    pub weight: u64,
}
fn fold(value: &str) -> String {
    value.nfkc().flat_map(char::to_lowercase).collect()
}
pub(super) fn select(
    store: &Store,
    private: &PrivateLists,
    account: Option<&str>,
    text: &str,
) -> Vec<Person> {
    let normalized = fold(text);
    let words: BTreeSet<_> = normalized.split_whitespace().collect();
    if words.is_empty() {
        return vec![];
    }
    // Membership is prepared once; this selector never builds the interaction graph.
    let follows: BTreeSet<_> = account
        .and_then(|a| store.follows(a))
        .unwrap_or_default()
        .into_iter()
        .collect();
    let mutes: BTreeSet<_> = account
        .and_then(|a| store.replaceable(a, 10000))
        .map(|event| list_tags_for(&event, private, account))
        .unwrap_or_default()
        .into_iter()
        .filter(|tag| tag.first().is_some_and(|key| key == "p"))
        .filter_map(|tag| tag.get(1).cloned())
        .collect();
    // Only the best six keys/labels survive a scan of the bounded metadata directory.
    let mut chosen = BTreeMap::new();
    for (pubkey, profile) in store.profile_entries() {
        if mutes.contains(pubkey) {
            continue;
        }
        let fields =
            [&profile.name, &profile.display_name, &profile.nip05].map(|field| fold(field));
        if !words
            .iter()
            .all(|word| fields.iter().any(|field| field.contains(*word)))
        {
            continue;
        }
        let own = account == Some(pubkey);
        let followed = follows.contains(pubkey);
        chosen.insert(
            (
                if own {
                    0
                } else if followed {
                    1
                } else {
                    2
                },
                fold(profile.label().unwrap_or("")),
                pubkey.to_owned(),
            ),
            Person {
                pubkey: pubkey.to_owned(),
                followed,
                follows_you: false,
                own,
                weight: if own {
                    64
                } else if followed {
                    32
                } else {
                    1
                },
            },
        );
        if chosen.len() > 6 {
            chosen.pop_last();
        }
    }
    chosen
        .into_values()
        .map(|mut person| {
            person.follows_you = account.is_some_and(|account| {
                store.replaceable(&person.pubkey, 3).is_some_and(|event| {
                    event.tags.iter().any(|tag| {
                        tag.first().is_some_and(|key| key == "p")
                            && tag.get(1).is_some_and(|pubkey| pubkey == account)
                    })
                })
            });
            person
        })
        .collect()
}
