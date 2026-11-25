//! Pure request routing with bounded progressive fallback.
//! Inputs are observations and verified outbox lists, never timeline order.
pub use super::quality::weight;
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

pub(super) struct ReadRoutes {
    pub routes: Vec<String>,
    pub primary: BTreeSet<String>,
    pub change: Option<crate::engine::telemetry::Kind>,
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
        self.read_route_plan(f, q, store, weights, now, None).routes
    }
    pub(super) fn read_route_plan<'a>(
        &self,
        f: &lkjstr_protocol::NostrFilter,
        q: &'a crate::engine::protocol::Query,
        store: &crate::store::Store,
        weights: &mut crate::engine::weights::PlanWeights<'a>,
        now: u64,
        time_owner: Option<&str>,
    ) -> ReadRoutes {
        use crate::engine::protocol::Source;
        let mut candidates = self.read_candidates(f, q, store, now);
        let channel = matches!(q.source, Source::Channel | Source::Channels);
        let hedge = !channel && self.hedge_due(f, now, time_owner);
        let limit = if channel {
            24
        } else if hedge {
            3
        } else {
            2
        };
        let current = self.count_routes(f, now).unwrap_or_else(|| {
            self.requests
                .values()
                .filter(|r| r.owns_time(time_owner) && super::want_key::same(&r.page_filter, f))
                .map(|r| (r.relay.as_str(), r))
                .collect()
        });
        let unavailable: BTreeSet<_> = candidates
            .iter()
            .filter(|c| {
                let request = current.get(c.url.as_str()).copied().or_else(|| {
                    if time_owner.is_some() {
                        return None;
                    }
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
                        && (request.complete
                            || (request.first_event_at.is_none()
                                && now.saturating_sub(request.created_at) >= 1_500)
                            || (request.asked && now >= request.initial_deadline)))
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
                    r.read_slot
                        || super::profiles::family(f, &r.members).is_some()
                        || (r.members.is_empty() && r.complete && r.page_eose)
                });
                // An actual inclusive continuation inherits a full predecessor's
                // ordinary slot. Reranking must not discard its unqueried tail.
                // Short pages and unrelated filters cannot acquire this authority.
                let continuing = time_owner.is_none()
                    && current_route.is_none()
                    && self.requests.values().any(|r| {
                        r.relay == c.url
                            && r.read_slot
                            && r.page_eose
                            && r.received.len() >= r.page_limit
                            && self.preceding_page(r, f)
                    });
                (stable || continuing) && !unavailable.contains(&c.url)
            })
            .map(|c| c.url.clone())
            .collect();
        if routes.len() > limit {
            routes.sort_by_key(|url| {
                current
                    .get(url.as_str())
                    .is_none_or(|r| r.first_event_at.is_none() && r.last_event.is_none())
            });
            routes.truncate(limit);
        }
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
        if limit <= 3 && f.until.is_none() && !self.verifying {
            recovery::promote(
                &mut routes,
                &candidates,
                &current,
                &unavailable,
                &q.filters.relay_hints,
            );
        }
        // A newly discovered outbox may join an in-flight configured page without
        // discarding either route's cursor or waiting for its EOSE.
        if f.until.is_none()
            && routes.len() < 3
            && !routes.iter().any(|url| {
                candidates
                    .iter()
                    .any(|c| &c.url == url && !c.authors.is_empty())
            })
            && let Some(outbox) = candidates
                .iter()
                .filter(|c| !c.authors.is_empty() && c.weight > 0)
                .max_by_key(|c| c.weight)
            && !routes.contains(&outbox.url)
        {
            routes.push(outbox.url.clone());
        }
        let change = super::telemetry::read_changes(f, &current, &routes, hedge);
        let primary = routes.iter().cloned().collect();
        // Keep failed-page uncertainty outside those slots. Historical evidence
        // also survives recovery/reranking; bounded by configured read routes and
        // released when the filter/view or explicit read permission is removed.
        for candidate in &candidates {
            if current.get(candidate.url.as_str()).is_some_and(|r| {
                f.until.is_some()
                    || unavailable.contains(&candidate.url)
                    // A demoted live route must answer and verify its resumed gap
                    // before retirement. Raw EOSE cannot decide queued data.
                    || (r.live && !r.read_slot && (!r.eose || self.verifying) && !r.complete)
            }) && !routes.contains(&candidate.url)
            {
                routes.push(candidate.url.clone());
            }
        }
        ReadRoutes {
            routes,
            primary,
            change,
        }
    }
}

#[cfg(test)]
#[path = "read_plan_test.rs"]
mod tests;
