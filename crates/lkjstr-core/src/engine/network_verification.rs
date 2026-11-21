//! Queue pressure revokes raw-page evidence; replay remains owned by the request.
use super::*;
impl Network {
    pub(in crate::engine) fn verification_dropped(&mut self, relay: &str, event: &NostrEvent) {
        let wires: BTreeSet<_> = self
            .requests
            .values()
            .filter(|r| {
                r.relay == relay
                    && r.sent
                    && lkjstr_protocol::matches_filter(event, &r.filter)
                    && (r.owns_time(None) || r.received.contains(&event.id))
            })
            .map(|r| r.wire_id.clone())
            .collect();
        for wire in wires {
            // Every member of a closed envelope must replay. State is bounded by
            // existing requests and released with the final view or read permission.
            for r in self
                .requests
                .values_mut()
                .filter(|r| r.relay == relay && r.wire_id == wire)
            {
                r.verification_retry = true;
                r.page_eose = false;
                r.eose = false;
                r.complete = false;
                r.received.clear();
                r.oldest = None;
                r.ready_at = self.now.saturating_add(r.retry_delay);
                r.retry_delay = r.retry_delay.saturating_mul(2).min(60_000);
                // Keep filter/page_filter unchanged: another route's cursor or a
                // later live watermark cannot discharge this original span.
            }
            self.close_group(relay, &wire);
            self.profiles_changed = true;
        }
    }
}
