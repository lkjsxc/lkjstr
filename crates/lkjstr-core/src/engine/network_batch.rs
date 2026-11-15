//! Immutable multi-filter envelopes. Logical limits/cursors and membership stay separate.
use super::*;
impl Network {
    pub(super) fn send_group(&mut self, id: &str, now: u64) {
        let first = &self.requests[id];
        let relay = first.relay.clone();
        let profile = first.filter.kinds.as_deref() == Some(&[0])
            && !first.members.contains("~account-discovery");
        let cap = self.relays[&relay].max_filters.clamp(1, 8);
        let mut ids = vec![id.to_owned()];
        // Live streams are left independent: interrupting one must not replay
        // another stream. Finite pages safely share a single EOSE boundary.
        if !first.live {
            ids.extend(
                self.requests
                    .iter()
                    .filter(|(key, r)| {
                        key.as_str() != id
                            && r.relay == relay
                            && !r.live
                            && !r.sent
                            && !r.complete
                            && !r.eose
                            && now >= r.ready_at
                            && r.priority == first.priority
                            && (r.filter.kinds.as_deref() == Some(&[0]))
                                == (first.filter.kinds.as_deref() == Some(&[0]))
                    })
                    .take(cap - 1)
                    .map(|(key, _)| key.clone()),
            );
        }
        self.next = self.next.saturating_add(1);
        let wire = format!("w{}", self.next);
        let mut frame = vec![json!("REQ"), json!(wire)];
        for key in ids {
            let r = &mut self.requests.get_mut(&key);
            let Some(r) = r else { continue };
            let mut filter = r.filter.clone();
            if let Some(at) = r.last_event.filter(|_| r.live && r.page_eose) {
                filter.since = Some(at.saturating_sub(2).max(filter.since.unwrap_or(0)));
            }
            filter.limit = Some(
                filter
                    .limit
                    .unwrap_or(200)
                    .min(self.relays[&relay].max_limit),
            );
            frame.push(filter_to_value(&filter));
            if !r.page_eose {
                r.page_limit = filter.limit.unwrap_or(200) as usize;
                r.received.clear();
                r.oldest = None;
            }
            r.wire_id = wire.clone();
            r.sent = true;
            r.asked = true;
            r.sent_at = now;
            r.last_rx = now;
            r.deadline = now + 15000;
        }
        self.send(&relay, Value::Array(frame));
        if !profile && let Some(r) = self.relays.get_mut(&relay) {
            r.next_req_at = now + 100;
        }
    }
    pub(in crate::engine) fn close_group(&mut self, relay: &str, wire: &str) {
        for r in self
            .requests
            .values_mut()
            .filter(|r| r.relay == relay && r.wire_id == wire)
        {
            r.sent = false;
            if !r.complete {
                r.eose = false;
            }
        }
        self.send(relay, json!(["CLOSE", wire]));
    }
}
