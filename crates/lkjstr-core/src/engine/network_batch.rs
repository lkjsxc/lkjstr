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
        // Each logical quota/cursor survives inside the envelope. Never enlarge a
        // transmitted envelope; a later want uses a new gap request.
        let mut candidates: Vec<_> = self
            .requests
            .iter()
            .filter(|(key, r)| {
                first.owns_time(None)
                    && r.owns_time(None)
                    && key.as_str() != id
                    && r.relay == relay
                    && r.live == first.live
                    && !r.sent
                    && !(r.verification_retry && self.verifying)
                    && !r.complete
                    && !r.eose
                    && now >= r.ready_at
                    && if first.live {
                        first.union_safe
                            && r.union_safe
                            && first.priority <= 2
                            && r.priority <= 2
                            && union::overlaps(&first.filter, &r.filter)
                    } else {
                        r.priority == first.priority
                            && (r.filter.kinds.as_deref() == Some(&[0]))
                                == (first.filter.kinds.as_deref() == Some(&[0]))
                    }
            })
            .collect();
        candidates.sort_by_key(|(key, r)| (r.priority, std::cmp::Reverse(r.weight), *key));
        ids.extend(
            candidates
                .into_iter()
                .take(cap - 1)
                .map(|(key, _)| key.clone()),
        );
        self.next = self.next.saturating_add(1);
        let wire = format!("w{}", self.next);
        let mut frame = vec![json!("REQ"), json!(wire)];
        for key in ids {
            let r = &mut self.requests.get_mut(&key);
            let Some(r) = r else { continue };
            let wait = r.wait_bound();
            let mut filter = r.filter.clone();
            if let Some(at) = r.last_event.filter(|_| r.live && r.page_eose) {
                // Gift-wrap timestamps are randomized over the preceding two days.
                let overlap = if filter.kinds.as_ref().is_some_and(|ks| ks.contains(&1059)) {
                    172_802
                } else {
                    2
                };
                filter.since = Some(at.saturating_sub(overlap).max(filter.since.unwrap_or(0)));
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
            r.verification_retry = false;
            r.sent = true;
            if !r.asked {
                r.initial_deadline = now.saturating_add(wait);
            }
            r.asked = true;
            r.sent_at = now;
            r.first_event_at = None;
            r.last_rx = now;
            r.deadline = now.saturating_add(wait);
            if !r.page_eose && now < r.initial_deadline {
                r.deadline = r.deadline.min(r.initial_deadline);
            }
        }
        if let Some(r) = self.relays.get_mut(&relay) {
            r.request_uses = r.request_uses.saturating_add(1);
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
