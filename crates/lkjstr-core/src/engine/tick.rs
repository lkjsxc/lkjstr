//! Bounded verification, replanning and view updates away from socket callbacks.
use super::*;
pub(super) const VERIFY_SLICE_LIMIT: usize = 32;
#[derive(Clone, Copy)]
pub enum TickPhase {
    Verify,
    Plan,
    Render,
}
impl Engine {
    /// Called away from socket callbacks. At most 32 verifications per slice.
    pub fn tick(&mut self, now: u64) {
        self.tick_observed(now, |_| {});
    }
    pub fn tick_observed(&mut self, now: u64, mut observe: impl FnMut(TickPhase)) {
        self.previews.tick(now);
        let revision = self.store.revision();
        self.advance_visibility_clock(now);
        let was_verifying = self.network.verifying;
        self.last_slice_verified = 0;
        for _ in 0..VERIFY_SLICE_LIMIT {
            let Some(ingest::QueuedEvent {
                relay,
                event: e,
                wire,
                sequence,
            }) = self.queue.pop_front()
            else {
                break;
            };
            self.queue_bytes = self
                .queue_bytes
                .saturating_sub(crate::store::event_payload_bytes(&e));
            if self.store.get(&e.id).is_some_and(|known| *known == e) {
                self.network.observe_verified(&relay, &e, now);
                continue;
            }
            if matches!(verify_event(&e), VerificationResult::Ok(_)) {
                self.verified += 1;
                self.last_slice_verified += 1;
                if relay.starts_with("ws") {
                    self.network.telemetry.traffic(now, |b| b.verified += 1);
                }
                self.network.event(&relay, &e, now);
                if let Some(nested) = lkjstr_protocol::verified_nested_repost(&e) {
                    self.insert_verified(nested, Some(&relay));
                }
                let outcome = self.insert_verified(e.clone(), Some(&relay));
                if outcome == crate::store::Inserted::InvalidExpiration {
                    self.record_invalid_delivery(&relay, wire.as_deref(), sequence);
                }
                if relay != "cache"
                    && !matches!(
                        outcome,
                        crate::store::Inserted::Expired | crate::store::Inserted::InvalidExpiration
                    )
                {
                    self.pending.push(e, true);
                }
                for v in self.views.values_mut() {
                    v.dirty = true;
                }
            } else {
                self.rejected += 1;
                self.record_invalid_delivery(&relay, wire.as_deref(), sequence);
            }
        }
        if self.queue.iter().any(|entry| entry.relay.starts_with("ws")) {
            self.network
                .telemetry
                .traffic(now, |bucket| bucket.queue_busy = true);
        }
        observe(TickPhase::Verify);
        self.trim_store();
        self.network.verifying = !self.queue.is_empty();
        self.network.profiles_changed |= was_verifying && !self.network.verifying;
        if self.reconcile_local_reads(now) || self.store.revision() != revision {
            self.replan(now);
        }
        self.network.tick(now);
        self.resume_channel_actions(now);
        let delivery_changed = self.network.update_note_connection_phases(now)
            || self.network.publications.len() != self.pending_publications;
        self.pending_publications = self.network.publications.len();
        if std::mem::take(&mut self.network.profiles_changed) || delivery_changed {
            self.replan(now);
            for v in self.views.values_mut() {
                v.dirty = true;
            }
        }
        self.settle_client_info(now);
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
        observe(TickPhase::Plan);
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
                observe(TickPhase::Render);
            }
        }
    }
}
