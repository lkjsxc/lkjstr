//! Bounded verification, replanning and view updates away from socket callbacks.
use super::*;
impl Engine {
    /// Called away from socket callbacks. At most 32 verifications per slice.
    pub fn tick(&mut self, now: u64) {
        self.previews.tick(now);
        let revision = self.store.revision();
        let was_verifying = self.network.verifying;
        for _ in 0..32 {
            let Some((relay, e)) = self.queue.pop_front() else {
                break;
            };
            self.queue_bytes = self
                .queue_bytes
                .saturating_sub(crate::store::event_payload_bytes(&e));
            if self.store.get(&e.id).is_some() {
                continue;
            }
            if matches!(verify_event(&e), VerificationResult::Ok(_)) {
                self.verified += 1;
                self.network.event(&relay, &e, now);
                if let Some(nested) = lkjstr_protocol::verified_nested_repost(&e) {
                    self.insert_verified(nested, Some(&relay));
                }
                if relay != "cache" {
                    self.pending.push(e.clone(), true);
                }
                self.insert_verified(e, Some(&relay));
                for v in self.views.values_mut() {
                    v.dirty = true;
                }
            } else {
                self.rejected += 1;
            }
        }
        self.network.verifying = !self.queue.is_empty();
        self.network.profiles_changed |= was_verifying && !self.network.verifying;
        if self.reconcile_local_reads(now) || self.store.revision() != revision {
            self.replan(now);
        }
        self.network.tick(now);
        self.resume_channel_actions(now);
        if self.network.publications.len() != self.pending_publications {
            self.pending_publications = self.network.publications.len();
            self.replan(now);
            for v in self.views.values_mut() {
                v.dirty = true;
            }
        }
        if std::mem::take(&mut self.network.profiles_changed) {
            self.replan(now);
            for v in self.views.values_mut() {
                v.dirty = true;
            }
        }
        self.refill_history(now);
        self.zap_tick(now);
        for v in self.views.values_mut() {
            if v.source_exhausted != history::exhausted(&self.network, &self.store, v) {
                v.dirty = true;
            }
        }
        let expired: Vec<_> = self
            .signing
            .iter()
            .filter(|(_, s)| now >= s.deadline)
            .map(|(k, _)| k.clone())
            .collect();
        for req in expired {
            self.signing.remove(&req);
            self.error(Some(req), "signer-timeout");
        }
        if now.saturating_sub(self.last_flush) >= 75 {
            self.last_flush = now;
            let subs: Vec<_> = self
                .views
                .iter()
                .filter(|(_, v)| v.visible && v.dirty)
                .map(|(id, _)| id.clone())
                .collect();
            for sub in subs {
                self.render(&sub, false);
            }
        }
    }
}
