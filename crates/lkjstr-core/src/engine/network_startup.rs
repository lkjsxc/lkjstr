//! Bound startup observations while allowing late answers to recover.
use super::*;
const STARTUP_MS: u64 = 10_000;
const MAX_OBSERVATIONS: usize = 4096;

pub(super) struct ReadStart {
    at: u64,
    wait: u64,
    connected: bool,
    public_profile: bool,
}

impl Network {
    pub(super) fn observe_read_starts(&mut self, wants: &[(String, NostrFilter, Query)], now: u64) {
        let mut active = BTreeMap::<String, (u64, bool)>::new();
        for (sub, filter, query) in wants.iter().filter(|(sub, _, _)| !sub.starts_with('~')) {
            if active.len() == MAX_OBSERVATIONS && !active.contains_key(sub) {
                continue;
            }
            let wait = if filter
                .kinds
                .as_ref()
                .is_some_and(|ks| ks.iter().any(|kind| matches!(kind, 4 | 1059 | 10050)))
            {
                15_000
            } else {
                STARTUP_MS
            };
            let (longest_wait, public_profile) = active.entry(sub.clone()).or_default();
            *longest_wait = (*longest_wait).max(wait);
            *public_profile |= matches!(query.source, Source::Profile | Source::TheirHome);
        }
        self.read_starts.retain(|sub, _| active.contains_key(sub));
        for (sub, (wait, public_profile)) in active {
            let start = self.read_starts.entry(sub).or_insert(ReadStart {
                at: now,
                wait,
                connected: false,
                public_profile,
            });
            start.wait = wait;
            start.public_profile = public_profile;
            if self.relays.is_empty() && start.connected && !public_profile {
                start.at = now;
                start.connected = false;
            }
        }
    }

    pub(super) fn read_startup_wakeup(&self, now: u64) -> Option<u64> {
        self.read_starts
            .values()
            .filter(|start| !start.connected || start.public_profile)
            .map(|start| start.at.saturating_add(start.wait))
            .filter(|at| *at > now)
            .min()
    }

    pub(super) fn settle_read_startups(&mut self, now: u64) {
        let subs: Vec<_> = self.read_starts.keys().cloned().collect();
        for sub in subs {
            let requests: Vec<_> = self
                .requests
                .values()
                .filter(|r| r.members.contains(&sub))
                .collect();
            let online = requests
                .iter()
                .any(|r| self.relays.get(&r.relay).is_some_and(|peer| peer.online));
            let has_data = self.reported.get(&sub).is_some_and(|s| s == "data")
                || requests
                    .iter()
                    .any(|r| r.first_event_at.is_some() || r.last_event.is_some());
            let pending = requests.is_empty()
                || requests
                    .iter()
                    .any(|r| !r.complete && !r.page_eose && !r.eose);
            let inflight = requests.iter().any(|r| {
                !r.complete
                    && !r.page_eose
                    && ((r.sent && now < r.deadline)
                        || self
                            .relays
                            .get(&r.relay)
                            .is_some_and(|peer| peer.connecting))
            });
            let Some(start) = self.read_starts.get_mut(&sub) else {
                continue;
            };
            start.connected |= online;
            let reported = self.reported.get(&sub);
            let state = if has_data || !pending {
                continue;
            } else if (!start.connected || (start.public_profile && reported.is_none()))
                && now.saturating_sub(start.at) >= start.wait
            {
                "error"
            } else if inflight && !start.public_profile && reported.is_some_and(|s| s == "error") {
                "pending"
            } else {
                continue;
            };
            if reported.is_some_and(|old| old == state) {
                continue;
            }
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
}
