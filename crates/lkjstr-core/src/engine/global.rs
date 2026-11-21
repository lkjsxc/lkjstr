//! Small signed-out Global policy. Refill scans at most 6000 cached rows per bounded window.
use super::visibility::Reason;
use crate::store::Event;
use std::collections::{BTreeMap, BTreeSet};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Held {
    Hidden(Reason),
    NoRow,
    UnavailableRepost,
    AuthorCap,
    Duplicate,
}
impl Held {
    pub(super) fn reason(self) -> Option<Reason> {
        match self {
            Self::Hidden(reason) => Some(reason),
            Self::AuthorCap => Some(Reason::AuthorLimit),
            Self::Duplicate => Some(Reason::RepeatedContent),
            Self::UnavailableRepost | Self::NoRow => None,
        }
    }
}

pub(super) fn has_slot(held: Option<Held>) -> bool {
    !matches!(held, Some(Held::NoRow | Held::UnavailableRepost))
}

/// Newest-first input. A duplicate burst spans ten minutes; an author gets three
/// rows. Near copies normalize case, punctuation, whitespace, URLs and numbers,
/// but need >=40 alphanumeric characters to avoid collapsing short conversation.
pub fn classify(events: &[Event]) -> Vec<Option<Held>> {
    classify_window(events, |e| matches!(e.kind, 6 | 16), |_| None, 301)
}
pub(super) fn classify_window(
    events: &[Event],
    unavailable: impl Fn(&Event) -> bool,
    excluded: impl Fn(&Event) -> Option<Reason>,
    limit: usize,
) -> Vec<Option<Held>> {
    let mut authors = BTreeMap::<String, usize>::new();
    let mut retained: Vec<(u64, String, BTreeSet<String>)> = Vec::new();
    let mut slots = 0;
    events
        .iter()
        .take(6000)
        .scan((), |_, e| {
            if slots >= limit {
                return None;
            }
            Some((|| {
                if unavailable(e) {
                    return Some(Held::UnavailableRepost);
                }
                slots += 1;
                if let Some(reason) = excluded(e) {
                    return Some(Held::Hidden(reason));
                }
                if authors.get(&e.pubkey).copied().unwrap_or(0) >= 3 {
                    return Some(Held::AuthorCap);
                }
                // Bound work on arbitrarily large note payloads to 4096 characters.
                let text: String = e.content.chars().take(4096).collect();
                let exact = text.split_whitespace().collect::<Vec<_>>().join(" ");
                let tokens: BTreeSet<_> = text
                    .split_whitespace()
                    .take(256)
                    .map(|word| {
                        if word.starts_with("https://") || word.starts_with("http://") {
                            "url".into()
                        } else {
                            word.chars()
                                .filter(|c| c.is_alphanumeric())
                                .flat_map(char::to_lowercase)
                                .map(|c| if c.is_numeric() { '#' } else { c })
                                .collect::<String>()
                        }
                    })
                    .filter(|s| !s.is_empty())
                    .collect();
                let long = tokens.iter().map(|s| s.chars().count()).sum::<usize>() >= 40;
                if retained.iter().any(|(at, content, words)| {
                    e.created_at.abs_diff(*at) <= 600
                        && ((!exact.is_empty() && *content == exact)
                            || (long
                                && tokens.len() >= 8
                                && words.len() >= 8
                                && tokens.intersection(words).count() * 10
                                    >= tokens.union(words).count() * 9))
                }) {
                    return Some(Held::Duplicate);
                }
                *authors.entry(e.pubkey.clone()).or_default() += 1;
                retained.push((e.created_at, exact, tokens));
                None
            })())
        })
        .collect()
}
