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
        let ids: Vec<_> = self.requests.keys().cloned().collect();
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
            if now < self.relays[&r.relay].next_req_at {
                continue;
            }
            let max = self.relays[&r.relay].max_reqs.clamp(1, 8);
            let count = counts.entry(r.relay.clone()).or_default();
            if *count >= max {
                continue;
            }
            *count += 1;
            let relay = r.relay.clone();
            let mut f = r.filter.clone();
            if let Some(at) = r.last_event.filter(|_| r.live) {
                f.since = Some(at.saturating_sub(2).max(f.since.unwrap_or(0)));
            }
            f.limit = Some(f.limit.unwrap_or(200).min(self.relays[&relay].max_limit));
            let frame = json!(["REQ", id, filter_to_value(&f)]);
            self.send(&relay, frame);
            if let Some(r) = self.relays.get_mut(&relay) {
                r.next_req_at = now + 100;
            }
            if let Some(r) = self.requests.get_mut(&id) {
                r.page_limit = f.limit.unwrap_or(200) as usize;
                r.received.clear();
                r.oldest = None;
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
