use super::*;
use crate::engine::protocol::Delivery;

impl Network {
    pub(in crate::engine) fn can_stage_note(&self, id: &str) -> bool {
        self.publications.len() < 64 && !self.publications.contains_key(id)
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

    pub(super) fn expire_note_routes(&mut self, now: u64) {
        let mut updates = Vec::new();
        for (id, p) in &mut self.publications {
            let mut expired = Vec::new();
            for (relay, (connect, ack)) in &p.note_route_deadlines {
                let Some(state) = p.deliveries.get_mut(relay) else {
                    continue;
                };
                if now < ack.unwrap_or(*connect) || *state != "pending" {
                    continue;
                }
                *state = if p.observed.contains(relay) {
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
            }
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
    pub fn publication_frame_sent(&mut self, relay: &str, frame: &str, sent: bool) {
        if let Some(note) = self.network.publication_frame_sent(relay, frame, sent) {
            if self.tentative_notes.remove(&note.id) {
                self.pending.push(note, true);
            }
            self.invalidate();
        }
    }
}
