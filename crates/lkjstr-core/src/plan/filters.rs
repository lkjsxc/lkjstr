//! From accumulated relay groups to concrete REQ filters.

use std::collections::BTreeMap;

use lkjstr_protocol::NostrFilter;

use super::build::{Acc, Group};
use super::{MENTION_KINDS, NOTE_KINDS, Planned};

/// Authors per filter; large follow lists are split.
const AUTHOR_CHUNK: usize = 400;

pub(super) fn finish(relay: String, group: Group, acc: Acc) -> Planned {
    let live = matches!(group, Group::LiveNotes | Group::Thread | Group::Deletions)
        || matches!(group, Group::Global(None) | Group::Mentions(_, None));
    let base = NostrFilter {
        until: acc.until,
        limit: (acc.limit > 0).then_some(acc.limit),
        ..NostrFilter::default()
    };
    let authors: Vec<String> = acc.authors.into_iter().collect();
    let ids: Vec<String> = acc.ids.into_iter().collect();
    let by_authors = |kinds: &[u64], base: &NostrFilter| -> Vec<NostrFilter> {
        authors
            .chunks(AUTHOR_CHUNK)
            .map(|chunk| NostrFilter {
                authors: Some(chunk.to_vec()),
                kinds: Some(kinds.to_vec()),
                ..base.clone()
            })
            .collect()
    };
    let filters = match &group {
        Group::LiveNotes | Group::PagedNotes(_) => by_authors(&NOTE_KINDS, &base),
        Group::Global(_) => vec![NostrFilter {
            kinds: Some(NOTE_KINDS.to_vec()),
            ..base
        }],
        Group::Mentions(pubkey, _) => vec![NostrFilter {
            kinds: Some(MENTION_KINDS.to_vec()),
            tags: BTreeMap::from([("p".to_owned(), vec![pubkey.clone()])]),
            ..base
        }],
        Group::Thread => vec![
            NostrFilter {
                ids: Some(ids.clone()),
                ..NostrFilter::default()
            },
            NostrFilter {
                kinds: Some(vec![1, 5, 6, 7]),
                tags: BTreeMap::from([("e".to_owned(), ids)]),
                limit: Some(500),
                ..NostrFilter::default()
            },
        ],
        Group::Activity => vec![NostrFilter {
            kinds: Some(vec![1, 6, 7, 9735]),
            tags: BTreeMap::from([("e".to_owned(), ids)]),
            limit: Some(3000),
            ..Default::default()
        }],
        Group::Deletions => vec![NostrFilter {
            kinds: Some(vec![5]),
            tags: BTreeMap::from([("e".to_owned(), ids)]),
            ..NostrFilter::default()
        }],
        Group::Events => vec![NostrFilter {
            ids: Some(ids),
            ..NostrFilter::default()
        }],
        Group::Profiles(contacts) => {
            let kinds: &[u64] = if *contacts {
                &[0, 3, 10002]
            } else {
                &[0, 10002]
            };
            by_authors(kinds, &NostrFilter::default())
        }
        Group::Search(query) => vec![NostrFilter {
            kinds: Some(vec![1]),
            search: Some(query.clone()),
            ..base
        }],
    };
    Planned {
        relay,
        filters,
        wants: acc.wants,
        live,
    }
}
