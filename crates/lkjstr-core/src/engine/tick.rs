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
    /// Whether another ordinary verification slice can make immediate progress.
    pub fn verification_ready(&self) -> bool {
        self.queue.front().is_some_and(|entry| {
            !self.store.pressure_admission_paused() && self.pending.can_admit(&entry.event)
        })
    }
    fn pressure_control(&mut self) -> Option<usize> {
        let count = self.queue.len();
        if count == 0 {
            return None;
        }
        let mut selected = None;
        for _ in 0..count.min(256) {
            let index = self.pressure_cursor % count;
            self.pressure_cursor = (index + 1) % count;
            if self
                .queue
                .get(index)
                .is_some_and(|entry| entry.event.kind == 5 && self.pending.can_admit(&entry.event))
            {
                selected = Some(index);
                break;
            }
        }
        selected
    }
    /// Called away from socket callbacks. At most 32 verifications per slice.
    pub fn tick(&mut self, now: u64) {
        self.tick_observed(now, |_| {});
    }
    /// Return whether verification recovery or rendering still needs another short turn.
    pub fn tick_observed(&mut self, now: u64, mut observe: impl FnMut(TickPhase)) -> bool {
        self.previews.tick(now);
        let revision = self.store.revision();
        self.advance_visibility_clock(now);
        let was_verifying = self.network.verifying;
        let pressured = self.store.pressure_admission_paused();
        let mut new_preview_note = false;
        let notifications = if self.verification_ready() {
            self.notification_indices()
        } else {
            vec![]
        };
        for attempt in 0..VERIFY_SLICE_LIMIT {
            let blocked = pressured
                || self
                    .queue
                    .front()
                    .is_some_and(|entry| !self.pending.can_admit(&entry.event));
            let index = if blocked {
                if attempt != 0 {
                    break;
                }
                let Some(index) = self.pressure_control() else {
                    break;
                };
                index
            } else {
                // Earlier removals always precede this ordered selection. A candidate
                // cannot bypass persistence admission or the pressure-control lane.
                notifications
                    .get(attempt)
                    .map(|index| index - attempt)
                    .filter(|index| {
                        self.queue
                            .get(*index)
                            .is_some_and(|entry| self.pending.can_admit(&entry.event))
                    })
                    .unwrap_or(0)
            };
            let Some(q) = self.queue.remove(index) else {
                break;
            };
            let e = q.event;
            self.queue_bytes = self.queue_bytes.saturating_sub(q.bytes);
            let confirm = |network: &mut network::Network| {
                if let Some(wire) = &q.wire {
                    network.confirm_page_event(&q.relay, wire, &e);
                }
                for (relay, wire) in &q.copies {
                    network.confirm_page_event(relay, wire, &e);
                }
            };
            if self
                .store
                .lease(&e.id)
                .is_some_and(|known| known.matches(&e))
            {
                confirm(&mut self.network);
                self.network.observe_verified(&q.relay, &e, now);
                self.relay_served(&q.relay, &e.id);
                self.network.observed_receipt(
                    q.observation,
                    fetch_records::Outcome::Duplicate,
                    Some(0),
                    false,
                );
                continue;
            }
            if matches!(verify_event(&e), VerificationResult::Ok(_)) {
                self.verified += 1;
                confirm(&mut self.network);
                self.network.event(&q.relay, &e, now);
                if let Some(nested) = lkjstr_protocol::verified_nested_repost(&e) {
                    self.insert_verified(nested, Some(&q.relay));
                }
                self.read_contexts.changed(&e);
                let timeline_note = matches!(e.kind, 1 | 6 | 42);
                let (outcome, lease) = self.store.insert_leased(e, Some(&q.relay));
                use crate::store::Inserted;
                let admitted = matches!(outcome, Inserted::New | Inserted::Replaced);
                let stored = admitted
                    .then(|| lease.as_ref().map(|l| l.wire_bytes as u64))
                    .flatten()
                    .or(Some(0));
                self.network.observed_receipt(
                    q.observation,
                    match outcome {
                        Inserted::New | Inserted::Replaced => fetch_records::Outcome::Ok,
                        Inserted::Duplicate | Inserted::Stale => fetch_records::Outcome::Duplicate,
                        _ => fetch_records::Outcome::Rejected,
                    },
                    stored,
                    admitted,
                );
                new_preview_note |= timeline_note && lease.is_some();
                if matches!(
                    outcome,
                    crate::store::Inserted::InvalidExpiration
                        | crate::store::Inserted::InvalidEncoding
                ) {
                    self.record_invalid_delivery(&q.relay, q.wire.as_deref(), q.sequence);
                }
                if q.relay != "cache"
                    && !matches!(
                        outcome,
                        crate::store::Inserted::Expired
                            | crate::store::Inserted::InvalidExpiration
                            | crate::store::Inserted::InvalidEncoding
                    )
                    && let Some(lease) = lease
                {
                    self.pending.push_lease(lease);
                }
                for v in self.views.values_mut() {
                    v.dirty = true;
                }
            } else {
                self.network.observed_receipt(
                    q.observation,
                    fetch_records::Outcome::Rejected,
                    Some(0),
                    false,
                );
                self.rejected += 1;
                self.record_invalid_delivery(&q.relay, q.wire.as_deref(), q.sequence);
            }
        }
        if self.queue.iter().any(|entry| entry.relay.starts_with("ws")) {
            self.network
                .ingress
                .record(now, |bucket| bucket.queue_busy = true);
        }
        observe(TickPhase::Verify);
        self.trim_store();
        self.network.verifying = !self.queue.is_empty();
        self.network.profiles_changed |= was_verifying && !self.network.verifying;
        if self.reconcile_local_reads(now) || self.store.revision() != revision {
            self.replan(now);
        }
        self.resume_signed_notes(now);
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
        let flush = now.saturating_sub(self.last_flush) >= 75;
        if flush {
            self.refresh_history_horizons();
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
        observe(TickPhase::Plan);
        if flush {
            self.last_flush = now;
        }
        if flush || new_preview_note {
            let subs: Vec<_> = self
                .views
                .iter()
                .filter(|(_, v)| {
                    v.visible
                        && v.dirty
                        && (flush
                            || v.rows.is_empty()
                                && v.time_window.is_none()
                                && matches!(
                                    v.query.source,
                                    protocol::Source::Home | protocol::Source::TheirHome
                                ))
                })
                .map(|(id, _)| id.clone())
                .collect();
            for sub in subs {
                self.render(&sub, false);
                observe(TickPhase::Render);
            }
        }
        !self.queue.is_empty() || self.views.values().any(|view| view.visible && view.dirty)
    }
}

#[cfg(test)]
#[path = "tick_preview_test.rs"]
mod preview_tests;
#[cfg(test)]
#[path = "pressure_recovery_test.rs"]
mod tests;
