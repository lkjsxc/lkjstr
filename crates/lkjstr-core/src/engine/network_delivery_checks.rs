//! One finite ids check, seven to ten seconds after waiting, on an open socket only.
use super::*;
impl Network {
    // Preserve an existing socket through its one confirmation opportunity; never
    // make an offline socket wanted, and release after the finite check/window.
    pub(super) fn delivery_connection_wanted(&self, url: &str, now: u64) -> bool {
        self.publications.values().any(|p| {
            p.attempted.contains(url)
                && p.deliveries
                    .get(url)
                    .is_some_and(|s| (s == "pending" && now >= p.deadline) || s == "timeout")
        }) || self.receipts.values().any(|r| {
            r.checks.contains_key(url)
                || (now <= r.finished_at.saturating_add(10000)
                    && !r.checked.contains(url)
                    && r.deliveries
                        .iter()
                        .any(|d| d.relay == url && d.state == "timeout"))
        })
    }

    pub(super) fn delivery_check_counts(&self) -> BTreeMap<String, usize> {
        let mut out = BTreeMap::new();
        for r in self.receipts.values() {
            for url in r.checks.keys() {
                *out.entry(url.clone()).or_default() += 1;
            }
        }
        out
    }
    pub(super) fn check_deliveries(&mut self, now: u64) {
        let expired: Vec<_> = self
            .receipts
            .values()
            .flat_map(|r| r.checks.iter())
            .filter(|(url, (_, until))| {
                now >= *until || !self.relays.get(*url).is_some_and(|s| s.online)
            })
            .map(|(url, (wire, _))| (url.clone(), wire.clone()))
            .collect();
        for (url, wire) in expired {
            self.close_delivery_check(&url, &wire);
        }
        let mut counts: BTreeMap<String, usize> = self
            .open_wires()
            .into_iter()
            .map(|(url, n)| (url.into(), n))
            .collect();
        let mut sends = Vec::new();
        for (id, r) in &mut self.receipts {
            let elapsed = now.saturating_sub(r.finished_at);
            if !(7000..=10000).contains(&elapsed) {
                continue;
            }
            for d in &r.deliveries {
                if d.state != "timeout" || r.checked.contains(&d.relay) {
                    continue;
                }
                let Some(relay) = self
                    .relays
                    .get(&d.relay)
                    .filter(|s| s.online && now >= s.cooldown_until)
                else {
                    continue;
                };
                let count = counts.entry(d.relay.clone()).or_default();
                if *count >= relay.max_reqs.clamp(1, 8) {
                    continue;
                }
                *count += 1;
                self.next += 1;
                let wire = format!("delivery-{}", self.next);
                r.checked.insert(d.relay.clone());
                r.checks.insert(d.relay.clone(), (wire.clone(), now + 5000));
                sends.push((d.relay.clone(), json!(["REQ",wire,{"ids":[id],"limit":1}])));
            }
        }
        for (url, frame) in sends {
            self.send(&url, frame);
        }
    }
    pub(super) fn close_delivery_check(&mut self, relay: &str, wire: &str) {
        let mut closed = false;
        for r in self.receipts.values_mut() {
            if r.checks.get(relay).is_some_and(|(id, _)| id == wire) {
                r.checks.remove(relay);
                closed = true;
            }
        }
        if closed {
            self.send(relay, json!(["CLOSE", wire]));
        }
    }
    pub(super) fn delivery_event(&self, relay: &str, wire: &str, event: &NostrEvent) -> bool {
        self.receipts
            .get(&event.id)
            .is_some_and(|r| r.checks.get(relay).is_some_and(|(id, _)| id == wire))
    }
}
