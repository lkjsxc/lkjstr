use super::*;
impl Network {
    pub fn tick(&mut self, now: u64) {
        self.now = now;
        self.auth_tick(now);
        self.admit_configured(now);
        let relays: Vec<_> = self.relays.keys().cloned().collect();
        for url in relays {
            let r = &self.relays[&url];
            let wanted = self
                .requests
                .values()
                .any(|r| r.relay == url && !r.complete)
                || (r.online && self.delivery_connection_wanted(&url, now))
                || self.publications.values().any(|p| {
                    now < p.deadline && p.deliveries.get(&url).is_some_and(|s| s == "pending")
                });
            if !wanted {
                if r.online || r.connecting {
                    self.effects.push(Effect::Disconnect(url.clone()));
                    if let Some(r) = self.relays.get_mut(&url) {
                        r.auth.reset();
                        r.online = false;
                        r.connected_since = None;
                        r.connecting = false;
                        r.retry_at = now;
                    }
                }
                continue;
            }
            if (r.online && now.saturating_sub(r.last_rx) > 120000)
                || (r.connecting && now >= r.retry_at)
            {
                self.disconnected(&url, now);
            }
            let r = &mut self.relays.get_mut(&url);
            if let Some(r) = r
                && !r.online
                && !r.connecting
                && now >= r.retry_at
            {
                r.connecting = true;
                r.retry_at = now + 15000;
                self.effects.push(Effect::Connect(url.clone()));
            }
        }
        let stale: BTreeSet<_> = self
            .requests
            .values()
            .filter(|r| r.live && r.sent && now.saturating_sub(r.last_rx) > 120000)
            .filter(|r| {
                !self.requests.values().any(|q| {
                    q.sent
                        && q.relay == r.relay
                        && q.wire_id == r.wire_id
                        && now.saturating_sub(q.last_rx) <= 120000
                })
            })
            .map(|r| (r.relay.clone(), r.wire_id.clone()))
            .collect();
        for (relay, wire) in stale {
            for r in self
                .requests
                .values_mut()
                .filter(|r| r.relay == relay && r.wire_id == wire)
            {
                r.eose = false;
                r.last_rx = now;
            }
            self.close_group(&relay, &wire);
        }
        let mut counts = self.delivery_check_counts();
        let mut wires = BTreeSet::new();
        for r in self.requests.values().filter(|r| r.sent) {
            if !wires.insert((&r.relay, &r.wire_id)) {
                continue;
            }
            *counts.entry(r.relay.clone()).or_default() += 1;
        }
        let mut ids: Vec<_> = self.requests.keys().cloned().collect();
        ids.sort_by_key(|id| {
            let r = &self.requests[id];
            (
                r.priority
                    + if r.purpose == "own" && r.page_eose {
                        3
                    } else {
                        0
                    },
                counts_filter(&r.filter),
                std::cmp::Reverse(r.weight),
                id.clone(),
            )
        });
        for id in ids {
            let r = &self.requests[&id];
            // Collect the initial visible page before freezing count buckets,
            // bounded by its first deadline even across backoff and retries.
            // Otherwise every verification slice creates another 200-event stream.
            if counts_filter(&r.filter)
                && self.requests.values().any(|q| {
                    q.relay == r.relay
                        && q.priority <= 1
                        && !q.page_eose
                        && !q.complete
                        && now < q.initial_deadline
                        && !q.members.is_disjoint(&r.members)
                })
            {
                continue;
            }
            if now < r.ready_at
                || (r.verification_retry && self.verifying)
                || r.sent
                || r.complete
                || r.eose
                || !self.relays.get(&r.relay).is_some_and(|s| s.online)
            {
                continue;
            }
            if now < self.relays[&r.relay].cooldown_until
                || (!visible_profile(r) && now < self.relays[&r.relay].next_req_at)
            {
                continue;
            }
            let max = self.relays[&r.relay].max_reqs.clamp(1, 8);
            let count = counts.entry(r.relay.clone()).or_default();
            if *count >= max {
                let focused_page = r.priority == 0 && !r.page_eose;
                if visible_profile(r) || !counts_filter(&r.filter) || !r.page_eose {
                    // Names may interrupt feeds; channels and visible follow watches
                    // rotate after EOSE. Discovery tails alone never interrupt live work.
                    // Interrupted requests retain their page coverage and resume later.
                    let victim = self
                        .requests
                        .iter()
                        .find(|(_, q)| {
                            q.relay == r.relay
                                && q.sent
                                && !self.requests.values().any(|other| other.sent
                                    && other.relay == q.relay && other.wire_id == q.wire_id
                                    && other.priority == 0 && !other.eose)
                                // Finite hydration must finish or time out. Replaying
                                // a large follower/ID answer for every name is costly.
                                && (q.live || q.eose || focused_page
                                    || !(q.filter.ids.is_some()
                                        || (q.filter.kinds.as_deref() == Some(&[3])
                                            && q.filter.tags.contains_key("p"))))
                                && (!visible_profile(q) || (focused_page && q.priority > 0))
                                && (q.priority != 0 || q.eose)
                                && ((focused_page && q.priority > 0)
                                    || visible_profile(r)
                                    || (q.eose
                                        && ((q.list_watch
                                            && !r.members.contains("~account-discovery"))
                                            || ((r.members.contains("~account-discovery")
                                                || r.members
                                                    .iter()
                                                    .any(|m| m.starts_with("~publication:")))
                                                && !r.page_eose
                                                && q.live)
                                            || (r.filter.ids.is_some() && q.live)
                                            || ((slot_sharing(r) || counts_filter(&r.filter))
                                                && (slot_sharing(q) || q.live))
                                            || (r.live
                                                && !r.members.contains("~account-discovery")
                                                && slot_sharing(q))
                                            || (!r.members.contains("~account-discovery")
                                                && counts_filter(&q.filter))
                                            || (q.members.contains("~account-discovery")
                                                && (!r.members.contains("~account-discovery")
                                                    || !r.page_eose)))))
                        })
                        .map(|(id, _)| id.clone());
                    if let Some(victim) = victim {
                        let relay = r.relay.clone();
                        let rotate = slot_sharing(r) || r.live;
                        let wire = self.requests[&victim].wire_id.clone();
                        for q in self
                            .requests
                            .values_mut()
                            .filter(|q| q.relay == relay && q.wire_id == wire)
                        {
                            q.sent = false;
                            q.eose = false;
                            if rotate
                                && !q.members.contains("~account-discovery")
                                && (slot_sharing(q) || q.live)
                            {
                                q.ready_at = now + 1000;
                            }
                        }
                        self.close_group(&relay, &wire);
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            } else {
                *count += 1;
            }
            self.send_group(&id, now);
        }
        self.send_pending(now);
        self.settle(now);
    }
}

fn visible_profile(r: &Request) -> bool {
    profile(&r.filter) && !r.members.contains("~account-discovery")
}

fn profile(f: &NostrFilter) -> bool {
    f.kinds.as_deref() == Some(&[0])
}

pub(super) fn filter_live(f: &NostrFilter) -> bool {
    f.ids.is_none()
        && f.until.is_none()
        && f.kinds.as_ref().is_some_and(|ks| {
            ks.iter().any(|k| {
                matches!(
                    k,
                    1 | 4 | 6 | 7 | 41 | 42 | 1059 | 9735 | 10002 | 10005 | 10050 | 10063
                )
            })
        })
}

fn counts_filter(f: &NostrFilter) -> bool {
    f.tags.contains_key("e")
        && matches!(
            f.kinds.as_deref(),
            Some([1, 6, 7, 9735] | [42, 16, 7, 9735] | [1, 42, 6, 16, 7, 9735])
        )
}

// A bounded cooldown shares slots between channels, follow watches and live feeds.
fn slot_sharing(r: &Request) -> bool {
    r.members.iter().any(|m| {
        m.starts_with("~dm:") || m.starts_with("~dm-legacy:") || m.starts_with("~dm-list:")
    }) || r.list_watch
        || r.filter
            .kinds
            .as_ref()
            .is_some_and(|ks| ks.iter().any(|k| matches!(k, 40 | 41 | 42 | 10005)))
}
