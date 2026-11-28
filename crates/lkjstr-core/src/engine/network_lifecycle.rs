use super::*;
impl Network {
    pub fn connected(&mut self, relay: &str, now: u64) {
        if let Some(r) = self.relays.get_mut(relay) {
            r.online = true;
            r.connected_since = Some(now);
            r.observed_request = false;
            r.connecting = false;
            r.last_rx = now;
        }
        self.note_outbox.ready(Some(relay), now);
        self.tick(now);
    }
    pub fn disconnected(&mut self, relay: &str, now: u64) {
        self.observe_disconnect(relay, now);
        self.profiles_changed = true;
        self.quality_revision = self.quality_revision.wrapping_add(1);
        self.effects.push(Effect::Disconnect(relay.into()));
        // While a post waits on this relay, try again soon; its route's own deadline bounds this.
        let posting = self.publications.values().any(|p| p.pending_on(relay, now));
        if let Some(r) = self.relays.get_mut(relay) {
            r.auth.reset();
            r.online = false;
            r.connecting = false;
            r.connected_since = None;
            r.last_error = Some("connection-lost".into());
            r.failures = r.failures.saturating_add(1);
            r.retry_at = now + 1000 * (1u64 << r.failures.min(6)) + (r.received % 997);
            if posting {
                r.retry_at = r.retry_at.min(now + 1_500);
            }
        }
        for p in self.publications.values_mut() {
            p.sent.remove(relay);
        }
        for r in self.requests.values_mut().filter(|r| r.relay == relay) {
            if r.ready_at == u64::MAX {
                r.ready_at = now;
                r.complete = false;
            }
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
            self.quality_revision = self.quality_revision.wrapping_add(1);
        }
        self.observe_verified(relay, e, now);
    }
    /// Exact copies of retained verified events advance resumption watermarks,
    /// but never earn first-arrival credit in Stats or quality ranking.
    pub fn observe_verified(&mut self, relay: &str, e: &NostrEvent, now: u64) {
        self.confirm_delivery(relay, &e.id, now);
        // Follow lists from broad follower-count reads must not evict author
        // hydration stamps. Only a directed owner read establishes list freshness.
        let owner_list = e.kind != 3
            || self.requests.values().any(|r| {
                r.relay == relay
                    && r.asked
                    && r.filter.tags.is_empty()
                    && r.filter
                        .kinds
                        .as_ref()
                        .is_some_and(|kinds| kinds.contains(&3))
                    && r.filter
                        .authors
                        .as_ref()
                        .is_some_and(|authors| authors.contains(&e.pubkey))
            });
        if relay.starts_with("ws") && owner_list && self.metadata.observed(e, now) {
            self.quality_revision = self.quality_revision.wrapping_add(1);
        }
        let mut first = None;
        let mut matched_delivery = false;
        for r in self
            .requests
            .values_mut()
            .filter(|r| r.relay == relay && lkjstr_protocol::matches_filter(e, &r.filter))
        {
            r.last_rx = now;
            matched_delivery |= r.sent || (r.asked && r.page_eose && r.received.contains(&e.id));
            if r.first_event_at.is_none()
                && (r.sent || (r.asked && r.page_eose && r.received.contains(&e.id)))
            {
                r.first_event_at = Some(now);
                first = Some(now.saturating_sub(r.sent_at));
            }
            // A future-dated event must not move the replay watermark past valid traffic.
            if e.created_at <= now / 1000 {
                r.last_event = Some(r.last_event.unwrap_or(0).max(e.created_at));
            }
        }
        // A healthy signed delivery resets transport backoff, never a mere handshake.
        // Explicit relay rate-limit cooldown retains its independent deadline.
        if matched_delivery
            && let Some(r) = self.relays.get_mut(relay)
            && r.online
            && r.connected_since
                .is_some_and(|at| now.saturating_sub(at) >= 10_000)
            && now >= r.cooldown_until
        {
            r.failures = 0;
        }
        if let Some(latency) = first
            && let Some(r) = self.relays.get_mut(relay)
        {
            self.optimizer.link.observe_rtt(latency);
            r.read_timing.observe(latency);
            r.first_event_ms = Some(
                r.first_event_ms
                    .map_or(latency, |old| (old * 7 + latency) / 8),
            );
            r.timeouts = r.timeouts.saturating_sub(1);
            self.quality_revision = self.quality_revision.wrapping_add(1);
        }
    }
}
