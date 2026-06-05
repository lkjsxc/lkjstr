use lkjstr_protocol::{FollowEntry, NostrEvent, follow_entries_from_event};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FollowListSummary {
    pub entries: Vec<FollowEntry>,
    pub following_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserTimelineAuthorSet {
    pub authors: Vec<String>,
    pub hash: String,
    pub mode: String,
}

#[must_use]
pub fn summarize_follow_list(event: &NostrEvent) -> FollowListSummary {
    let entries = follow_entries_from_event(event);
    FollowListSummary {
        following_count: entries.len(),
        entries,
    }
}

#[must_use]
pub fn user_timeline_author_set(
    target_pubkey: &str,
    follow_list: Option<&NostrEvent>,
) -> UserTimelineAuthorSet {
    let mut authors = vec![target_pubkey.to_owned()];
    if let Some(event) = follow_list {
        authors.extend(
            follow_entries_from_event(event)
                .into_iter()
                .map(|entry| entry.pubkey),
        );
    }
    authors = dedupe_preserve_order(authors);
    UserTimelineAuthorSet {
        hash: author_set_hash(&authors),
        authors,
        mode: "follow_graph".to_owned(),
    }
}

#[must_use]
pub fn target_posts_only_author_set(target_pubkey: &str) -> UserTimelineAuthorSet {
    let authors = vec![target_pubkey.to_owned()];
    UserTimelineAuthorSet {
        hash: author_set_hash(&authors),
        authors,
        mode: "target_posts_only".to_owned(),
    }
}

#[must_use]
pub fn author_set_hash(authors: &[String]) -> String {
    let sorted = authors.iter().collect::<BTreeSet<_>>();
    sorted.into_iter().cloned().collect::<Vec<_>>().join(",")
}

fn dedupe_preserve_order(values: Vec<String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for value in values {
        if seen.insert(value.clone()) {
            out.push(value);
        }
    }
    out
}
