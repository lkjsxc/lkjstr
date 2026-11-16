//! Pure request routing within the reader's configured transports.
//! Inputs are observations and verified outbox lists, never timeline order.
use std::collections::{BTreeMap, BTreeSet};
#[path = "read_recovery.rs"]
mod recovery;

#[derive(Clone, Debug)]
pub struct Candidate {
    pub url: String,
    /// Quantized 0..1000 transport quality; zero is cooling down.
    pub weight: u64,
    /// Requested authors whose verified list advertises this relay for writing.
    pub authors: BTreeSet<String>,
}

/// Greedy coverage with a quality prior. Two copies are useful; first coverage
/// counts twice. Unknown authors stay on ordinary reader-selected routes.
/// This bounded selector does not claim global two-cover or discover transports.
pub fn select(candidates: &[Candidate], limit: usize) -> Vec<String> {
    select_weighted(candidates, limit, |_| 1)
}
pub fn select_weighted(
    candidates: &[Candidate],
    limit: usize,
    person: impl Fn(&str) -> u64,
) -> Vec<String> {
    let mut selected = Vec::new();
    let mut covered = BTreeMap::<&str, usize>::new();
    while selected.len() < limit.min(candidates.len()) {
        let best = candidates
            .iter()
            .filter(|r| !selected.contains(&r.url))
            .max_by(|a, b| {
                let utility = |r: &Candidate| {
                    let gain = r.authors.iter().fold(0u64, |sum, author| {
                        sum.saturating_add(person(author).saturating_mul(
                            match covered.get(author.as_str()) {
                                None => 2,
                                Some(1) => 1,
                                _ => 0,
                            },
                        ))
                    });
                    r.weight.saturating_mul(1 + gain)
                };
                utility(a).cmp(&utility(b)).then_with(|| b.url.cmp(&a.url))
            });
        let Some(best) = best else { break };
        for author in &best.authors {
            *covered.entry(author.as_str()).or_default() += 1;
        }
        selected.push(best.url.clone());
    }
    selected
}

/// First useful arrivals receive credit, duplicate volume does not. Small
/// samples have a neutral prior; latency, failures and refusal reduce quality.
/// Callers retain cooling routes when no alternatives exist, so retry recovers.
pub fn weight(
    useful: u64,
    received: u64,
    latency_ms: Option<u64>,
    failures: u32,
    cooling: bool,
    refused: bool,
) -> u64 {
    if cooling {
        return 0;
    }
    let yield_score = 400u64.saturating_mul(useful.min(received).saturating_add(1))
        / received.saturating_add(2).max(1);
    let speed = 400_000 / latency_ms.unwrap_or(1000).saturating_add(1000);
    let quality = (200 + yield_score + speed) / (1 + u64::from(failures.min(8)));
    if refused { quality / 4 } else { quality }
}

pub(super) struct ReadRoutes {
    pub routes: Vec<String>,
    pub primary: BTreeSet<String>,
}
impl super::Network {
    pub(in crate::engine) fn read_routes<'a>(
        &self,
        f: &lkjstr_protocol::NostrFilter,
        q: &'a crate::engine::protocol::Query,
        store: &crate::store::Store,
        weights: &mut crate::engine::weights::PlanWeights<'a>,
        now: u64,
    ) -> Vec<String> {
        self.read_route_plan(f, q, store, weights, now).routes
    }
    pub(super) fn read_route_plan<'a>(
        &self,
        f: &lkjstr_protocol::NostrFilter,
        q: &'a crate::engine::protocol::Query,
        store: &crate::store::Store,
        weights: &mut crate::engine::weights::PlanWeights<'a>,
        now: u64,
    ) -> ReadRoutes {
        use crate::engine::protocol::Source;
        let authors: BTreeMap<_, _> = f
            .authors
            .iter()
            .flatten()
            .filter_map(|author| store.relay_list(author).map(|list| (author, list)))
            .collect();
        let mut candidates: Vec<_> = self
            .relay_order
            .iter()
            .filter_map(|url| {
                let r = self.relays.get(url)?;
                let usage = self.known.get(url)?;
                if !(if q.source == Source::Search {
                    usage.search
                } else if q.source == Source::Channels {
                    usage.read || usage.search
                } else {
                    usage.read
                }) {
                    return None;
                }
                Some(Candidate {
                    url: url.clone(),
                    weight: r.quality_weight(now),
                    authors: authors
                        .iter()
                        .filter(|(_, list)| list.iter().any(|(u, _, write)| u == url && *write))
                        .map(|(author, _)| (*author).clone())
                        .collect(),
                })
            })
            .collect();
        let limit = if matches!(q.source, Source::Channel | Source::Channels) {
            24
        } else {
            2
        };
        let current: BTreeMap<_, _> = self
            .requests
            .values()
            .filter(|r| r.page_filter == *f)
            .map(|r| (r.relay.as_str(), r))
            .collect();
        let unavailable: BTreeSet<_> = candidates
            .iter()
            .filter(|c| {
                let request = current.get(c.url.as_str()).copied().or_else(|| {
                    self.requests
                        .values()
                        .filter(|r| r.relay == c.url && self.preceding_page(r, f))
                        .min_by_key(|r| r.page_filter.until.unwrap_or(u64::MAX))
                });
                let Some(request) = request else {
                    return false;
                };
                // A completed historical page keeps its cursor regardless of later transport quality.
                if f.until.is_some() && request.page_eose {
                    return false;
                }
                let relay = &self.relays[&c.url];
                c.weight == 0
                    || (!relay.online && relay.failures > 0)
                    || (!request.page_eose
                        && (request.complete || (request.asked && now >= request.initial_deadline)))
            })
            .map(|c| c.url.clone())
            .collect();
        for candidate in &mut candidates {
            if unavailable.contains(&candidate.url) {
                candidate.weight = 0;
            }
        }
        // Stable, usable routes occupy the ordinary slots. A refusal, timeout or
        // failed connection must leave room for another permitted reader.
        let mut routes: Vec<_> = candidates
            .iter()
            .filter(|c| !q.filters.relay_hints.contains(&c.url))
            .filter(|c| {
                let current_route = current.get(c.url.as_str());
                let stable = current_route.is_some_and(|r| {
                    // Hydration rewrites logical filter keys into immutable buckets.
                    // Preserve their existing routing independently of live-slot ownership.
                    r.read_slot || super::profiles::family(f, &r.members).is_some()
                });
                // An actual inclusive continuation inherits a full predecessor's
                // ordinary slot. Reranking must not discard its unqueried tail.
                // Short pages and unrelated filters cannot acquire this authority.
                let continuing = current_route.is_none()
                    && self.requests.values().any(|r| {
                        r.relay == c.url
                            && r.read_slot
                            && r.page_eose
                            && r.received.len() >= r.page_limit
                            && self.preceding_page(r, f)
                    });
                (stable || continuing) && !unavailable.contains(&c.url)
            })
            .take(limit)
            .map(|c| c.url.clone())
            .collect();
        let selected = if candidates.iter().any(|c| !c.authors.is_empty()) {
            let policy = weights.get(q.account.as_deref());
            select_weighted(&candidates, limit, |p| policy.person(p))
        } else {
            select(&candidates, limit)
        };
        for url in selected {
            if routes.len() < limit && !routes.contains(&url) {
                routes.push(url);
            }
        }
        if limit == 2 && f.until.is_none() {
            recovery::promote(
                &mut routes,
                &candidates,
                &current,
                &unavailable,
                &q.filters.relay_hints,
            );
        }
        let primary = routes.iter().cloned().collect();
        // Keep failed-page uncertainty outside those slots. Historical evidence
        // also survives recovery/reranking; bounded by configured read routes and
        // released when the filter/view or explicit read permission is removed.
        for candidate in &candidates {
            if current.get(candidate.url.as_str()).is_some_and(|r| {
                f.until.is_some()
                    || unavailable.contains(&candidate.url)
                    // A demoted live route must answer its own resumed gap before
                    // retirement. Its old page EOSE cannot prove reconnection complete.
                    || (r.live && !r.read_slot && !r.eose && !r.complete)
            }) && !routes.contains(&candidate.url)
            {
                routes.push(candidate.url.clone());
            }
        }
        ReadRoutes { routes, primary }
    }
}

#[cfg(test)]
#[path = "read_plan_test.rs"]
mod tests;
