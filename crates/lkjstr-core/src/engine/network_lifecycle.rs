use super::*;
impl Network {
    pub fn connected(&mut self, relay: &str, now: u64) {
        if let Some(r) = self.relays.get_mut(relay) {
            r.online = true;
            r.connected_since = Some(now);
            r.connecting = false;
            r.last_rx = now;
        }
        self.tick(now);
    }
    pub fn disconnected(&mut self, relay: &str, now: u64) {
        self.profiles_changed = true;
        self.effects.push(Effect::Disconnect(relay.into()));
        if let Some(r) = self.relays.get_mut(relay) {
            r.online = false;
            r.connecting = false;
            r.connected_since = None;
            r.last_error = Some("connection-lost".into());
            r.failures = r.failures.saturating_add(1);
            r.retry_at = now + 1000 * (1u64 << r.failures.min(6)) + (r.received % 997);
        }
        for p in self.publications.values_mut() {
            p.sent.remove(relay);
        }
        for r in self.requests.values_mut().filter(|r| r.relay == relay) {
            if !r.complete {
                r.sent = false;
                r.eose = false;
            }
        }
    }
    pub fn event(&mut self, relay: &str, e: &NostrEvent, now: u64) {
        if let Some(r) = self.relays.get_mut(relay) {
            r.last_rx = now;
            r.useful += 1;
        }
        for r in self
            .requests
            .values_mut()
            .filter(|r| r.relay == relay && lkjstr_protocol::matches_filter(e, &r.filter))
        {
            r.last_rx = now;
            r.last_event = Some(r.last_event.unwrap_or(0).max(e.created_at));
        }
    }
}
