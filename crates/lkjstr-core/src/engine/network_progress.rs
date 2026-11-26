//! Read readiness is distinct from complete history and proven absence.
use super::*;
const READY_MS: u64 = 300;
const SOFT_MS: u64 = 1_500;
const HARD_MS: u64 = 5_000;

impl Network {
    pub(super) fn hedge_due(
        &self,
        filter: &NostrFilter,
        now: u64,
        time_owner: Option<&str>,
    ) -> bool {
        let current: Vec<_> = self
            .requests
            .values()
            .filter(|r| r.owns_time(time_owner) && want_key::same(&r.page_filter, filter))
            .collect();
        let delay = self.hedge_after(current.iter().copied());
        current
            .iter()
            .any(|r| r.read_slot && !r.page_eose && !r.complete)
            && !current
                .iter()
                .any(|r| r.first_event_at.is_some() || r.last_event.is_some())
            && current
                .iter()
                .any(|r| now.saturating_sub(r.created_at) >= delay)
    }
    pub(super) fn read_wakeup(&mut self, now: u64) {
        self.next_read_plan =
            self.requests
                .values()
                .filter(|r| !r.complete && !r.page_eose && r.first_event_at.is_none())
                .flat_map(|r| {
                    [
                        Some(r.created_at.saturating_add(
                            if r.read_slot && self.optimizer.ready() {
                                self.hedge_after(std::iter::once(r))
                            } else {
                                400
                            },
                        )),
                        Some(r.created_at.saturating_add(SOFT_MS)),
                        Some(r.created_at.saturating_add(HARD_MS)),
                    ]
                    .into_iter()
                    .flatten()
                })
                .filter(|at| *at > now)
                .chain(self.read_startup_wakeup(now))
                .chain(self.metadata.next_expiry(now))
                .chain(
                    self.requests
                        .values()
                        .filter_map(Request::metadata_expiry)
                        .filter(|at| *at > now),
                )
                .min();
    }
    pub(super) fn wake_reads(&mut self, now: u64) {
        if self.next_read_plan.is_some_and(|at| now >= at) {
            self.next_read_plan = None;
            self.profiles_changed = true;
        }
    }
    pub(super) fn settle_reads(&mut self, now: u64) {
        if !self.verifying {
            for r in self.requests.values_mut().filter(|r| r.page_eose) {
                r.page_answered_at.get_or_insert(now);
            }
        }
        let subs: BTreeSet<_> = self
            .requests
            .values()
            .flat_map(|r| r.members.iter().cloned())
            .filter(|sub| {
                !background_member(sub) && !crate::engine::time_window_relay::is_owner(sub)
            })
            .collect();
        for sub in subs {
            let rs: Vec<_> = self
                .requests
                .values()
                .filter(|r| r.members.contains(&sub))
                .collect();
            let has_data = rs
                .iter()
                .any(|r| r.first_event_at.is_some() || r.last_event.is_some())
                || self.reported.get(&sub).is_some_and(|state| state == "data");
            let ready = has_data
                && (rs.iter().any(|r| r.page_eose && r.last_event.is_some())
                    || rs
                        .iter()
                        .any(|r| now.saturating_sub(r.created_at) >= READY_MS));
            // Only terminal absence waits for verification. Already verified rows
            // remain usable while another relay's backlog is still being checked.
            let done = !self.verifying
                && rs.iter().all(|r| {
                    r.page_eose
                        || r.eose
                        || r.complete
                        || (r.sent && now >= r.deadline)
                        || self.unopened_expired(r, now)
                });
            if !ready && !done {
                continue;
            }
            let state = if has_data {
                "data"
            } else if rs.iter().any(|r| !r.eose && !r.page_eose) {
                "error"
            } else {
                "not-found"
            };
            if self.reported.get(&sub).is_none_or(|old| old != state) {
                let (asked_relays, answered_relays) = self.request_progress(&sub);
                self.output.push(Output::Status {
                    sub: sub.clone(),
                    state: state.into(),
                    asked_relays,
                    answered_relays,
                });
                self.reported.insert(sub, state.into());
            }
        }
        let expired: Vec<_> = self
            .requests
            .iter()
            .filter(|(_, r)| {
                !r.eose
                    && !r.complete
                    && now >= r.ready_at
                    && ((r.sent && now >= r.deadline)
                        || (r.time_pages.is_some()
                            && !r.verification_retry
                            && now >= r.initial_deadline)
                        || self.unopened_expired(r, now))
            })
            .map(|(id, _)| id.clone())
            .collect();
        let mut penalties = BTreeSet::new();
        for id in expired {
            let Some(r) = self.requests.get_mut(&id) else {
                continue;
            };
            self.profiles_changed = true;
            r.complete = !r.live;
            r.asked = true;
            r.initial_deadline = r.initial_deadline.min(now);
            r.deadline = now;
            r.ready_at = now.saturating_add(r.retry_delay);
            r.retry_delay = r.retry_delay.saturating_mul(2).min(30_000);
            let was_sent = r.sent;
            r.sent = false;
            let relay = r.relay.clone();
            let wire = r.wire_id.clone();
            if penalties.insert((relay.clone(), wire.clone()))
                && let Some(peer) = self.relays.get_mut(&relay)
            {
                peer.timeouts = peer.timeouts.saturating_add(1).min(8);
                peer.last_error = Some("read-timeout".into());
                self.quality_revision = self.quality_revision.wrapping_add(1);
            }
            if was_sent {
                self.close_group(&relay, &wire);
            }
        }
        self.settle_read_startups(now);
    }
    fn unopened_expired(&self, r: &Request, now: u64) -> bool {
        !r.asked
            && now.saturating_sub(r.created_at) >= r.wait_bound()
            && (r.time_pages.is_some()
                || self
                    .relays
                    .get(&r.relay)
                    .is_none_or(|peer| !peer.online && !peer.connecting))
    }
}

impl Request {
    pub(super) fn wait_bound(&self) -> u64 {
        if self.members.iter().any(|member| member.starts_with("~dm"))
            || self
                .filter
                .kinds
                .as_ref()
                .is_some_and(|ks| ks.iter().any(|kind| matches!(kind, 4 | 1059 | 10050)))
        {
            15_000
        } else {
            HARD_MS
        }
    }
}

pub(super) fn background_member(member: &str) -> bool {
    member.starts_with("~prefetch:") || member.starts_with("~repair:")
}
impl Request {
    pub(super) fn speculative(&self) -> bool {
        self.members.iter().all(|member| background_member(member))
    }
}

pub(super) fn view_owner(member: &str) -> &str {
    member
        .strip_prefix("~prefetch:")
        .or_else(|| member.strip_prefix("~repair:"))
        .unwrap_or(member)
}
impl Request {
    pub(super) fn shares_view(&self, other: &Self) -> bool {
        self.members.iter().any(|member| {
            other
                .members
                .iter()
                .any(|candidate| view_owner(member) == view_owner(candidate))
        })
    }
}
