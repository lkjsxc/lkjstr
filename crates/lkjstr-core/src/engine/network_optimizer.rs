//! Adapts public scheduler facts to the deterministic policy.
use super::*;
use crate::optimizer::{
    features::{Features, Route},
    plan_policy::hedge_delay,
};

const SECONDS: usize = 60;

#[derive(Clone, Copy, Default)]
pub(in crate::engine) struct Bucket {
    at_ms: u64,
    pub bytes_in: u64,
    pub queue_busy: bool,
}

pub(in crate::engine) struct Ingress {
    // One slot for each of the last 60 aligned seconds.
    seconds: [Option<Bucket>; SECONDS],
}

impl Default for Ingress {
    fn default() -> Self {
        Self {
            seconds: [None; SECONDS],
        }
    }
}

impl Ingress {
    pub fn record(&mut self, now: u64, update: impl FnOnce(&mut Bucket)) {
        let second = now / 1000;
        let at_ms = second * 1000;
        let slot = &mut self.seconds[(second % SECONDS as u64) as usize];
        if slot.is_some_and(|bucket| bucket.at_ms > at_ms) {
            return;
        }
        if slot.is_none_or(|bucket| bucket.at_ms != at_ms) {
            *slot = Some(Bucket {
                at_ms,
                ..Bucket::default()
            });
        }
        if let Some(bucket) = slot {
            update(bucket);
        }
    }

    pub fn bucket(&self, second: u64) -> Bucket {
        let at_ms = second * 1000;
        self.seconds[(second % SECONDS as u64) as usize]
            .filter(|bucket| bucket.at_ms == at_ms)
            .unwrap_or(Bucket {
                at_ms,
                ..Bucket::default()
            })
    }
}

impl Network {
    pub(in crate::engine) fn plan_features(&self, now: u64) -> Features {
        Features {
            hidden: self.optimizer.hidden,
            offline: self.relays.values().all(|r| !r.online),
            save_data: self.optimizer.save_data,
            awaiting_ok: self.publications.values().any(|p| !p.reported_success),
            interaction: if now.saturating_sub(self.optimizer.hinted_at) < 500 {
                self.optimizer.interaction
            } else {
                Default::default()
            },
            ..Features::default()
        }
    }

    pub(super) fn route_features(&self, url: &str, index: usize, now: u64) -> Route {
        let relay = &self.relays[url];
        Route {
            index,
            useful_per_mille: (relay.received >= 16)
                .then(|| (relay.useful.saturating_mul(1000) / relay.received).min(1000) as u16),
            first_event_p75_ms: relay.read_timing.p75(),
            eose_ms: relay.latency_ms,
            cooldown: relay.cooldown_until > now,
            closed_recent: relay
                .last_closed
                .is_some_and(|at| now.saturating_sub(at) < 10_000),
            online: relay.online,
        }
    }

    pub(super) fn planned_limit(&self, r: &Request, now: u64) -> u64 {
        let relay = &self.relays[&r.relay];
        let fixed = r.filter.limit.unwrap_or(200).min(relay.max_limit);
        if r.asked {
            return fixed.min(r.page_limit as u64);
        }
        // Explicit IDs, account metadata and side-window cursor work keep their quotas.
        if !stats_relay::public_filter(&r.filter)
            || r.filter.ids.is_some()
            || !r.owns_time(None)
            || r.verification_retry
            || !matches!(r.purpose, "visible" | "focused" | "history")
            || !r.filter.kinds.as_ref().is_some_and(|ks| ks.contains(&1))
        {
            return fixed;
        }
        let features = Features {
            lane: usize::from(r.priority != 0) + usize::from(r.page_filter.until.is_some()),
            relay_limit: relay.max_limit,
            avg_event_bytes: relay.event_bytes.unwrap_or(1100),
            ..self.plan_features(now)
        };
        fixed.min(self.optimizer.decide_plan(features, &[]).limit)
    }

    pub(in crate::engine) fn prefetch_depth(&self) -> usize {
        let features = self.plan_features(self.now);
        if features.hidden || features.offline || features.save_data || features.awaiting_ok {
            return 0;
        }
        self.optimizer.decide_plan(features, &[]).prefetch_depth
    }

    pub(super) fn hedge_after<'a>(&self, requests: impl Iterator<Item = &'a Request>) -> u64 {
        let routes: Vec<_> = requests
            .filter(|r| r.read_slot && r.role == "primary")
            .filter(|r| self.relays.contains_key(&r.relay))
            .map(|r| self.route_features(&r.relay, 0, self.now))
            .collect();
        hedge_delay(self.optimizer.link.state(), &routes, self.optimizer.ready())
    }

    pub(super) fn observe_link(&mut self, now: u64) {
        let second = now / 1000;
        let start = self.optimizer.second.unwrap_or(second.saturating_sub(1));
        if start >= second {
            return;
        }
        let start = start.max(second.saturating_sub(60));
        let saturated = self.optimizer.link.state().saturated;
        for second in start..second {
            let bucket = self.ingress.bucket(second);
            self.optimizer
                .link
                .observe_bucket(second, bucket.bytes_in, bucket.queue_busy);
        }
        self.optimizer.second = Some(second);
        self.profiles_changed |= saturated != self.optimizer.link.state().saturated;
    }
}

impl Network {
    pub fn plan(
        &mut self,
        wants: Vec<(String, NostrFilter, Query)>,
        store: &crate::store::Store,
        now: u64,
    ) {
        self.plan_with_lists(wants, store, &Default::default(), now);
    }
}

impl Network {
    pub(super) fn release_obsolete(
        &mut self,
        wants: &[(String, NostrFilter, Query)],
        retained: &BTreeSet<String>,
        now: u64,
    ) {
        let obsolete: Vec<_> = self
            .requests
            .keys()
            .filter(|id| !retained.contains(*id))
            .cloned()
            .collect();
        for id in obsolete {
            // Rerouting a still-wanted follower page must not discard its
            // unfinished physical answer. Wait for the relay's EOSE before
            // changing routes; a tab truly closing can still cancel at once.
            let expensive_inflight = self.requests.get(&id).is_some_and(|r| {
                r.sent
                    && !r.page_eose
                    && now.saturating_sub(r.sent_at) < 9000
                    && r.filter.kinds.as_deref() == Some(&[3])
                    && r.filter.tags.contains_key("p")
                    && wants.iter().any(|(sub, filter, _)| {
                        r.members.contains(sub) && want_key::same(filter, &r.page_filter)
                    })
            });
            if expensive_inflight || self.keep_coverage(&id, now) {
                continue;
            }
            if let Some(r) = self.requests.remove(&id)
                && r.sent
                && !self.requests.iter().any(|(id, q)| {
                    retained.contains(id) && q.sent && q.relay == r.relay && q.wire_id == r.wire_id
                })
            {
                self.close_group(&r.relay, &r.wire_id);
            }
        }
    }
}
