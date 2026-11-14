//! Plan construction: relay choice per want, then coalescing per relay.

use std::collections::{BTreeMap, BTreeSet};

use super::filters::finish;
use super::routes::author_routes;
use super::{Directory, Planned, RelayDefaults, Want, WantId};
use crate::relays::Scores;

/// Relays per author (outbox); two hedge against one slow or stale relay.
pub(super) const PER_AUTHOR: usize = 2;
/// Fallback fan-out when an author's relays are unknown.
const DEFAULT_FANOUT: usize = 3;

pub struct PlanContext<'a> {
    pub defaults: &'a RelayDefaults,
    pub directory: &'a dyn Directory,
    pub scores: &'a Scores,
    pub now_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(super) enum Group {
    LiveNotes,
    PagedNotes(WantId),
    Global(Option<u64>),
    Mentions(String, Option<u64>),
    Thread,
    Events,
    Deletions,
    Activity,
    Profiles(bool),
    Search(String),
}

#[derive(Default)]
pub(super) struct Acc {
    pub(super) authors: BTreeSet<String>,
    pub(super) ids: BTreeSet<String>,
    pub(super) wants: BTreeSet<WantId>,
    pub(super) limit: u64,
    pub(super) until: Option<u64>,
}

pub fn plan(wants: &[(WantId, Want)], ctx: &PlanContext<'_>) -> Vec<Planned> {
    let defaults = ctx.scores.rank(&ctx.defaults.read, ctx.now_ms);
    let fallback: Vec<String> = defaults.iter().take(DEFAULT_FANOUT).cloned().collect();
    let routes = author_routes(wants, ctx, &fallback);
    let mut acc: BTreeMap<(String, Group), Acc> = BTreeMap::new();
    for (id, want) in wants {
        match want {
            Want::Notes {
                authors,
                until,
                limit,
            } => {
                let group = match until {
                    None => Group::LiveNotes,
                    Some(_) => Group::PagedNotes(*id),
                };
                for author in authors {
                    for relay in routes.get(author).unwrap_or(&fallback) {
                        let slot = add(&mut acc, relay, group.clone(), *id);
                        slot.authors.insert(author.clone());
                        slot.limit = slot.limit.max(*limit);
                        slot.until = *until;
                    }
                }
            }
            Want::Global { until, limit } => {
                for relay in defaults.iter().take(DEFAULT_FANOUT + 1) {
                    let slot = add(&mut acc, relay, Group::Global(*until), *id);
                    slot.limit = slot.limit.max(*limit);
                    slot.until = *until;
                }
            }
            Want::Mentions {
                pubkey,
                until,
                limit,
            } => {
                let inbox = ctx.directory.read_relays(pubkey).unwrap_or_default();
                let mut relays = ctx.scores.rank(&inbox, ctx.now_ms);
                relays.truncate(PER_AUTHOR + 1);
                relays.extend(fallback.iter().cloned());
                for relay in dedupe(relays) {
                    let slot = add(
                        &mut acc,
                        &relay,
                        Group::Mentions(pubkey.clone(), *until),
                        *id,
                    );
                    slot.limit = slot.limit.max(*limit);
                    slot.until = *until;
                }
            }
            Want::Thread {
                root,
                author,
                relays,
            } => {
                let mut targets = hinted(relays, ctx);
                if let Some(author) = author {
                    targets.extend(routes.get(author).cloned().unwrap_or_default());
                }
                targets.extend(fallback.iter().cloned());
                for relay in dedupe(targets) {
                    add(&mut acc, &relay, Group::Thread, *id)
                        .ids
                        .insert(root.clone());
                }
            }
            Want::Events { ids, relays } | Want::Deletions { ids, relays } => {
                let mut targets = hinted(relays, ctx);
                targets.extend(fallback.iter().cloned());
                for relay in dedupe(targets) {
                    add(
                        &mut acc,
                        &relay,
                        if matches!(want, Want::Deletions { .. }) {
                            Group::Deletions
                        } else {
                            Group::Events
                        },
                        *id,
                    )
                    .ids
                    .extend(ids.iter().cloned());
                }
            }
            Want::Activity { ids } => {
                for relay in &fallback {
                    add(&mut acc, relay, Group::Activity, *id)
                        .ids
                        .extend(ids.iter().take(60).cloned());
                }
            }
            Want::Profiles { pubkeys, contacts } => {
                for pubkey in pubkeys {
                    let mut targets: Vec<String> = routes
                        .get(pubkey)
                        .into_iter()
                        .flatten()
                        .take(1)
                        .cloned()
                        .collect();
                    targets.extend(
                        ctx.scores
                            .rank(&ctx.defaults.indexers, ctx.now_ms)
                            .into_iter()
                            .take(1),
                    );
                    targets.extend(fallback.iter().take(2).cloned());
                    for relay in dedupe(targets) {
                        add(&mut acc, &relay, Group::Profiles(*contacts), *id)
                            .authors
                            .insert(pubkey.clone());
                    }
                }
            }
            Want::Search { query, limit } => {
                for relay in ctx
                    .scores
                    .rank(&ctx.defaults.search, ctx.now_ms)
                    .into_iter()
                    .take(2)
                {
                    add(&mut acc, &relay, Group::Search(query.clone()), *id).limit = *limit;
                }
            }
        }
    }
    acc.into_iter()
        .map(|((relay, group), acc)| finish(relay, group, acc))
        .collect()
}

fn add<'a>(
    acc: &'a mut BTreeMap<(String, Group), Acc>,
    relay: &str,
    group: Group,
    want: WantId,
) -> &'a mut Acc {
    let slot = acc.entry((relay.to_owned(), group)).or_default();
    slot.wants.insert(want);
    slot
}

fn hinted(relays: &[String], ctx: &PlanContext<'_>) -> Vec<String> {
    ctx.scores
        .rank(relays, ctx.now_ms)
        .into_iter()
        .take(PER_AUTHOR)
        .collect()
}

fn dedupe(relays: Vec<String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    relays
        .into_iter()
        .filter(|relay| seen.insert(relay.clone()))
        .collect()
}
