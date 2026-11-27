//! Resume durable notes through the same route plan and scheduler as the first send.
use super::*;

impl Engine {
    pub fn note_key_known(&self, account: &str, key: &str) -> bool {
        self.network.note_outbox.known(account, key)
            || self
                .signing
                .values()
                .any(|s| s.event.pubkey == account && s.note_key.as_deref() == Some(key))
    }

    pub fn bind_note_key(&mut self, req: &str, key: String) {
        if let Some(s) = self.signing.get_mut(req).filter(|s| s.event.kind == 1) {
            s.note_key = Some(key);
        }
    }

    pub fn wake_note_outbox(&mut self, now: u64) {
        self.network.note_outbox.ready(None, now);
    }

    pub fn discard_signed_note(&mut self, key: &str, now: u64) {
        if let Some(id) = self.network.note_outbox.discard(key, now) {
            self.cancel_signed_note(&id);
        } else if let Some((req, _)) = self
            .signing
            .iter()
            .find(|(_, s)| s.note_key.as_deref() == Some(key))
        {
            self.refuse_sign(req.clone(), "rejected");
        }
    }

    pub fn reconcile_signed_note(&mut self, status: network::note_outbox::Status) {
        let id = status.id.clone();
        if self.network.note_outbox.reconcile(status, self.network.now) {
            self.cancel_signed_note(&id);
        }
    }

    pub fn forget_signed_notes(&mut self, account: &str) {
        for id in self.network.note_outbox.pending_ids(account) {
            self.cancel_signed_note(&id);
        }
        self.network.note_outbox.forget(account);
        let signing: Vec<_> = self
            .signing
            .iter()
            .filter(|(_, s)| s.event.kind == 1 && s.event.pubkey == account)
            .map(|(req, _)| req.clone())
            .collect();
        for req in signing {
            self.refuse_sign(req, "signed-out");
        }
    }

    fn cancel_signed_note(&mut self, id: &str) {
        self.network.cancel_publication(id);
        if self.tentative_notes.remove(id) {
            self.pending.cancel_reservation(id);
            self.store.discard_unseen_note(id);
        }
        self.invalidate();
    }

    pub(super) fn resume_signed_notes(&mut self, now: u64) {
        for event in self.network.note_outbox.due(now) {
            let id = event.id.clone();
            if !self.network.can_stage_publication(&id) {
                continue;
            }
            let (routes, list, defaults) = self.plan_publication(&event);
            let account = event.pubkey.clone();
            let blocked = self.note_route_policy(&account).blocked;
            let routes = self.network.note_outbox.retry_routes(&id, routes, &blocked);
            let (_, lease) = self.store.insert_leased(event.clone(), None);
            if let Some(lease) = lease {
                self.tentative_notes.insert(id.clone());
                self.pending.reserve(lease);
            }
            self.network.stage_publication(
                format!("~note:{id}"),
                event,
                routes,
                now,
                account.clone(),
            );
            self.network.track_note_routes(
                &id,
                list,
                defaults,
                now,
                self.discovery_accounts.contains(&account),
            );
            self.network.profiles_changed = true;
        }
    }
}
