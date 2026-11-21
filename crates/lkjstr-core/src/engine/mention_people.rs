//! Candidate keys shared by the bare-mention projection and its metadata request.
use super::weights::Weights;
use crate::store::Store;
use std::{cmp::Reverse, collections::HashSet};

pub(super) fn context(
    store: &Store,
    account: Option<&str>,
    target: Option<&str>,
    weights: &Weights<'_>,
) -> Vec<String> {
    let thread = target.map_or_else(Vec::new, |id| store.thread(id));
    let target_author = thread
        .iter()
        .find(|event| Some(event.id.as_str()) == target)
        .map(|event| event.pubkey.as_str());
    let participants: HashSet<_> = thread.iter().map(|e| e.pubkey.as_str()).collect();
    let follows = account
        .and_then(|key| store.follows(key))
        .unwrap_or_default();
    let keys: HashSet<_> = participants
        .iter()
        .copied()
        .chain(follows.iter().map(String::as_str))
        .filter(|key| Some(*key) != account)
        .collect();
    let mut keys: Vec<_> = keys.into_iter().collect();
    keys.sort_by_cached_key(|key| {
        (
            Some(*key) != target_author,
            !participants.contains(key),
            Reverse(weights.person(key)),
            *key,
        )
    });
    keys.into_iter().take(6).map(str::to_owned).collect()
}
