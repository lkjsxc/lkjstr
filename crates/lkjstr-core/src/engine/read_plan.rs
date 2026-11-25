pub use super::quality::weight;
#[cfg(test)]
use std::collections::BTreeMap;
use std::collections::BTreeSet;
#[path = "read_recovery.rs"]
mod recovery;
#[path = "read_selection.rs"]
mod selection;
pub use selection::{Candidate, select, select_weighted};

pub(super) struct ReadRoutes {
    pub routes: Vec<String>,
    pub primary: BTreeSet<String>,
    pub change: Option<(crate::engine::telemetry::Kind, String)>,
    pub hedge_delay_ms: u64,
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
        self.read_route_plan(f, q, store, weights, now, None, false)
            .routes
    }
    #[allow(clippy::too_many_arguments)]
    pub(super) fn read_route_plan<'a>(
        &self,
        f: &lkjstr_protocol::NostrFilter,
        q: &'a crate::engine::protocol::Query,
        store: &crate::store::Store,
        weights: &mut crate::engine::weights::PlanWeights<'a>,
        now: u64,
        time_owner: Option<&str>,
        focused: bool,
    ) -> ReadRoutes {
        use crate::engine::protocol::Source;
        let mut candidates = self.read_candidates(f, q, store, now);
        let channel = matches!(q.source, Source::Channel | Source::Channels);
        let hedge = !channel && self.hedge_due(f, now, time_owner);
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
        let max = if channel { 24 } else { 8 };
        let ranked = if candidates.iter().any(|c| !c.authors.is_empty()) {
            let policy = weights.get(q.account.as_deref());
            select_weighted(&candidates, max, |p| policy.person(p))
        } else {
            select(&candidates, max)
        };
        let available: Vec<_> = ranked
            .iter()
            .filter(|url| {
                !q.filters.relay_hints.contains(url)
                    && !unavailable.contains(*url)
                    && self.relays[*url].cooldown_until <= now
            })
            .collect();
        let observed: Vec<_> = available
            .iter()
            .enumerate()
            .map(|(i, url)| self.route_features(url, i, now))
            .collect();
        let adaptive = !channel && time_owner.is_none() && super::telemetry::public_filter(f);
        let plan = crate::optimizer::plan_policy::decide(
            crate::optimizer::features::Features {
                focused,
                ..self.plan_features(now)
            },
            self.optimizer.link.state(),
            &observed,
            self.optimizer.enabled && adaptive,
        );
        let existing_hedge = current.values().find(|r| r.role == "hedge" && r.read_slot);
        let hedge = hedge || existing_hedge.is_some();
        let limit = if channel {
            24
        } else {
            (plan.fanout + usize::from(hedge)).min(3)
        };
        let hedge_target = existing_hedge.map(|r| &r.relay).or_else(|| {
            plan.hedge_target
                .and_then(|index| available.get(index).copied())
        });
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
        let mut new_hedge = None;
        if hedge
            && routes.len() == limit.saturating_sub(1)
            && let Some(url) =
                hedge_target.filter(|url| !routes.contains(url) && !unavailable.contains(*url))
        {
            new_hedge = Some(url.clone());
            routes.push(url.clone());
        }
        for url in ranked {
            if routes.len() < limit && !routes.contains(&url) {
                if hedge && routes.len() + 1 == limit && !current.contains_key(url.as_str()) {
                    let peer = self.route_features(&url, 0, now);
                    if peer.closed_recent || peer.cooldown {
                        continue;
                    }
                    new_hedge = Some(url.clone());
                }
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
        self.preserve_new_outbox(f, &candidates, &mut routes);
        use crate::engine::telemetry::Kind;
        let change = if super::telemetry::public_filter(f) {
            new_hedge.map(|url| (Kind::Hedge, url)).or_else(|| {
                (!unavailable.is_empty())
                    .then(|| {
                        routes.iter().find(|url| {
                            !current.contains_key(url.as_str()) && !unavailable.contains(*url)
                        })
                    })
                    .flatten()
                    .map(|url| (Kind::Fallback, url.clone()))
            })
        } else {
            None
        };
        let hedge_delay_ms = self.hedge_after(current.values().copied());
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
            hedge_delay_ms,
        }
    }
}

#[cfg(test)]
#[path = "read_plan_test.rs"]
mod tests;
