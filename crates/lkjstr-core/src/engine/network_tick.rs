use super::*;
impl Network {
    pub fn tick(&mut self, now: u64) {
        let relays: Vec<_> = self.relays.keys().cloned().collect();
        for url in relays {
            let r = &self.relays[&url];
            let wanted = self
                .requests
                .values()
                .any(|r| r.relay == url && !r.complete)
                || self
                    .publications
                    .values()
                    .any(|p| p.deliveries.get(&url).is_some_and(|s| s == "pending"));
            if !wanted {
                if r.online || r.connecting {
                    self.effects.push(Effect::Disconnect(url.clone()));
                    if let Some(r) = self.relays.get_mut(&url) {
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
        let stale: Vec<_> = self
            .requests
            .iter()
            .filter(|(_, r)| r.live && r.sent && now.saturating_sub(r.last_rx) > 120000)
            .map(|(id, _)| id.clone())
            .collect();
        for id in stale {
            if let Some(r) = self.requests.get_mut(&id) {
                r.sent = false;
                r.eose = false;
                r.last_rx = now;
                let relay = r.relay.clone();
                self.send(&relay, json!(["CLOSE", id]));
            }
        }
        let mut counts: BTreeMap<String, usize> = BTreeMap::new();
        for r in self.requests.values().filter(|r| r.sent) {
            *counts.entry(r.relay.clone()).or_default() += 1;
        }
        let mut ids: Vec<_> = self.requests.keys().cloned().collect();
        ids.sort_by_key(|id| {
            let r = &self.requests[id];
            let f = &r.filter;
            let priority = if profile(f) {
                0
            } else if f.ids.is_some() {
                1
            } else if r.members.contains("~account-discovery") {
                4 + u8::from(r.page_eose)
            } else if counts_filter(f) {
                3
            } else {
                2
            };
            (priority, id.clone())
        });
        for id in ids {
            let r = &self.requests[&id];
            if now < r.ready_at
                || r.sent
                || r.complete
                || r.eose
                || !self.relays.get(&r.relay).is_some_and(|s| s.online)
            {
                continue;
            }
            if !profile(&r.filter) && now < self.relays[&r.relay].next_req_at {
                continue;
            }
            let max = self.relays[&r.relay].max_reqs.clamp(1, 8);
            let count = counts.entry(r.relay.clone()).or_default();
            if *count >= max {
                if profile(&r.filter) || !counts_filter(&r.filter) || !r.page_eose {
                    // Names may interrupt feeds; channels and visible follow watches
                    // rotate after EOSE. Discovery tails alone never interrupt live work.
                    // Interrupted requests retain their page coverage and resume later.
                    let victim = self
                        .requests
                        .iter()
                        .find(|(_, q)| {
                            q.relay == r.relay
                                && q.sent
                                && !profile(&q.filter)
                                && (profile(&r.filter)
                                    || (q.eose
                                        && ((q.list_watch
                                            && !r.members.contains("~account-discovery"))
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
                        if let Some(q) = self.requests.get_mut(&victim) {
                            q.sent = false;
                            q.eose = false;
                            if rotate
                                && !q.members.contains("~account-discovery")
                                && (slot_sharing(q) || q.live)
                            {
                                q.ready_at = now + 1000;
                            }
                        }
                        self.send(&relay, json!(["CLOSE", victim]));
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            } else {
                *count += 1;
            }
            let r = &self.requests[&id];
            let relay = r.relay.clone();
            let mut f = r.filter.clone();
            if let Some(at) = r.last_event.filter(|_| r.live && r.page_eose) {
                f.since = Some(at.saturating_sub(2).max(f.since.unwrap_or(0)));
            }
            f.limit = Some(f.limit.unwrap_or(200).min(self.relays[&relay].max_limit));
            let frame = json!(["REQ", id, filter_to_value(&f)]);
            let is_profile = profile(&f);
            self.send(&relay, frame);
            if !is_profile && let Some(r) = self.relays.get_mut(&relay) {
                r.next_req_at = now + 100;
            }
            if let Some(r) = self.requests.get_mut(&id) {
                if !r.page_eose {
                    r.page_limit = f.limit.unwrap_or(200) as usize;
                    r.received.clear();
                    r.oldest = None;
                }
                r.sent = true;
                r.asked = true;
                r.sent_at = now;
                r.last_rx = now;
                r.deadline = now + 15000;
            }
        }
        self.send_pending();
        self.settle(now);
    }
}

fn profile(f: &NostrFilter) -> bool {
    f.kinds.as_deref() == Some(&[0])
}

pub(super) fn filter_live(f: &NostrFilter) -> bool {
    f.ids.is_none()
        && f.until.is_none()
        && f.kinds.as_ref().is_some_and(|ks| {
            ks.iter()
                .any(|k| matches!(k, 1 | 6 | 7 | 41 | 42 | 9735 | 10002 | 10005 | 10063))
        })
}

fn counts_filter(f: &NostrFilter) -> bool {
    matches!(
        f.kinds.as_deref(),
        Some([1, 6, 7, 9735] | [42, 16, 7, 9735] | [1, 42, 6, 16, 7, 9735])
    )
}

// A bounded cooldown shares slots between channels, follow watches and live feeds.
fn slot_sharing(r: &Request) -> bool {
    r.list_watch
        || r.filter
            .kinds
            .as_ref()
            .is_some_and(|ks| ks.iter().any(|k| matches!(k, 40 | 41 | 42 | 10005)))
}
