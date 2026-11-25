use super::*;
use crate::engine::protocol::Delivery;

impl Network {
    pub(in crate::engine) fn apply_note_opt_out(&mut self, id: &str, blocked: &BTreeSet<String>) {
        let Some(p) = self.publications.get_mut(id) else {
            return;
        };
        let mut changed = Vec::new();
        for url in blocked {
            let Some(state) = p
                .deliveries
                .get_mut(url)
                .filter(|state| *state == "pending")
            else {
                continue;
            };
            *state = if p.attempted.contains(url) {
                "timeout"
            } else {
                "skipped"
            }
            .into();
            p.route_deadlines.remove(url);
            changed.push(Delivery {
                relay: url.clone(),
                state: state.clone(),
                message: None,
            });
        }
        if !changed.is_empty() {
            self.output.push(Output::Delivery {
                req: p.req.clone(),
                deliveries: p.delivery(),
            });
            self.update_publication(id, &changed);
            self.cancel_publication_sends(id, |relay| blocked.contains(relay));
        }
    }

    pub(in crate::engine) fn track_note_routes(
        &mut self,
        id: &str,
        list: Option<String>,
        defaults: Vec<String>,
        now: u64,
        discovery_active: bool,
    ) {
        if let Some(p) = self.publications.get_mut(id) {
            p.author_route_wait_until = if list.is_none() && discovery_active {
                now.saturating_add(18_000)
            } else {
                0
            };
            p.author_list = list;
            p.default_routes = defaults;
        }
    }
    pub(in crate::engine) fn note_unconfirmed(&self, id: &str) -> bool {
        self.receipts.get(id).is_some_and(|r| {
            !r.echo_confirmation
                && !r.deliveries.iter().any(|d| d.state == "accepted")
                && r.deliveries
                    .iter()
                    .any(|d| matches!(d.state.as_str(), "timeout" | "rejected"))
        })
    }

    pub(in crate::engine) fn connecting_event(&self, id: &str) -> bool {
        self.publications
            .get(id)
            .is_some_and(|p| p.connect_late && p.attempted.is_empty())
    }

    pub(in crate::engine) fn update_note_connection_phases(&mut self, now: u64) -> bool {
        let mut changed = false;
        for p in self.publications.values_mut() {
            if p.event.kind == 1 && !p.connect_late && now >= p.deadline.saturating_sub(27_000) {
                p.connect_late = true;
                changed |= p.attempted.is_empty();
            }
        }
        changed
    }

    pub(super) fn expire_publish_routes(&mut self, now: u64) {
        let mut updates = Vec::new();
        for (id, p) in &mut self.publications {
            let mut expired = Vec::new();
            p.route_deadlines.retain(|relay, (connect, ack)| {
                let Some(state) = p.deliveries.get_mut(relay) else {
                    return false;
                };
                let until = ack.unwrap_or(*connect);
                if *state == "timeout" {
                    return now < until.saturating_add(10_000);
                }
                if *state != "pending" {
                    return false;
                }
                let unavailable = p.event.kind == 1
                    && self.relays.get(relay).is_some_and(|r| {
                        r.cooldown_until >= until
                            || (!r.online && !r.connecting && r.retry_at >= until)
                    });
                if now < until && !unavailable {
                    return true;
                }
                *state = if p.event.kind != 1 && p.observed.contains(relay) {
                    "accepted"
                } else {
                    "timeout"
                }
                .into();
                expired.push(Delivery {
                    relay: relay.clone(),
                    state: state.clone(),
                    message: None,
                });
                if *state == "timeout" && p.attempted.contains(relay) {
                    // Start the late-reply opportunity when the Worker observes expiry.
                    *connect = now;
                    *ack = None;
                    true
                } else {
                    false
                }
            });
            if !expired.is_empty()
                && (p.discovery_pending || p.deliveries.values().any(|s| s == "pending"))
            {
                updates.push((id.clone(), p.req.clone(), expired, p.delivery()));
            }
        }
        for (id, req, expired, deliveries) in updates {
            self.update_publication(&id, &expired);
            self.output.push(Output::Delivery { req, deliveries });
        }
    }
}

impl crate::engine::Engine {
    pub fn publication_frame_sent(&mut self, relay: &str, frame: &str, sent: bool, now: u64) {
        if let Some(note) = self
            .network
            .publication_frame_sent_at(relay, frame, sent, now)
        {
            if self.tentative_notes.contains(&note.id) && self.pending.activate(&note.id) {
                self.tentative_notes.remove(&note.id);
            }
            self.invalidate();
        }
    }
}
