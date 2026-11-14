//! Outbox routing: each author's best write relays, favouring relays many
//! authors share so one plan touches few relays.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use super::build::{PER_AUTHOR, PlanContext};
use super::{Want, WantId};

/// Most distinct relays one plan may touch.
const MAX_RELAYS: usize = 20;

pub(super) fn author_routes(
    wants: &[(WantId, Want)],
    ctx: &PlanContext<'_>,
    fallback: &[String],
) -> HashMap<String, Vec<String>> {
    let mut lists: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for (_, want) in wants {
        let authors: Vec<&String> = match want {
            Want::Notes { authors, .. } => authors.iter().collect(),
            Want::Profiles { pubkeys, .. } => pubkeys.iter().collect(),
            Want::Thread {
                author: Some(author),
                ..
            } => vec![author],
            _ => Vec::new(),
        };
        for author in authors {
            let list = ctx.directory.write_relays(author).unwrap_or_default();
            lists.insert(author.clone(), ctx.scores.rank(&list, ctx.now_ms));
        }
    }
    let mut popularity: HashMap<&String, usize> = HashMap::new();
    for relay in lists.values().flatten() {
        *popularity.entry(relay).or_default() += 1;
    }
    let mut chosen: BTreeSet<String> = fallback.iter().cloned().collect();
    let mut routes = HashMap::new();
    for (author, list) in &lists {
        let mut picks: Vec<&String> = list.iter().collect();
        picks.sort_by_key(|relay| (!chosen.contains(*relay), usize::MAX - popularity[relay]));
        let mut route: Vec<String> = Vec::new();
        for relay in picks {
            if route.len() == PER_AUTHOR {
                break;
            }
            if chosen.contains(relay) || chosen.len() < MAX_RELAYS {
                chosen.insert(relay.clone());
                route.push(relay.clone());
            }
        }
        if route.is_empty() {
            route = fallback.to_vec();
        }
        routes.insert(author.clone(), route);
    }
    routes
}
