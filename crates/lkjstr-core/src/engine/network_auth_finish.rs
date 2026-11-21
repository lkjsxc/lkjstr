//! Resume or fail only the authenticated owner's blocked work.
use super::*;
impl Network {
    pub(super) fn auth_finished(&mut self, relay: &str, accepted: bool, message: &str, now: u64) {
        let Some(r) = self.relays.get_mut(relay) else {
            return;
        };
        let Some((job, _)) = r.auth.pending.take() else {
            return;
        };
        let account = &job.event.pubkey;
        let blocked = r.auth.blocked.clone();
        let writes = r
            .auth
            .writes
            .iter()
            .filter(|id| {
                self.publications
                    .get(*id)
                    .is_some_and(|p| p.auth_account == *account && p.pending_on(relay, now))
            })
            .cloned()
            .collect::<Vec<_>>();
        r.last_error = if accepted {
            None
        } else {
            Some(message.chars().take(512).collect())
        };
        for id in blocked {
            let Some(q) = self.requests.get_mut(&id) else {
                continue;
            };
            if q.complete
                || now >= q.deadline
                || !request_needs(&q.filter, account, self.auth_active.as_deref())
            {
                continue;
            }
            q.sent = false;
            q.eose = false;
            q.complete = !accepted;
            if accepted {
                q.ready_at = now;
                r.auth.blocked.remove(&id);
            }
        }
        for id in &writes {
            r.auth.writes.remove(id);
        }
        for id in writes {
            if accepted {
                if let Some(p) = self.publications.get_mut(&id) {
                    p.sent.remove(relay);
                }
            } else {
                if let Some(p) = self.publications.get_mut(&id) {
                    p.deliveries.insert(relay.into(), "rejected".into());
                    p.messages
                        .insert(relay.into(), message.chars().take(512).collect());
                    let req = p.req.clone();
                    let deliveries = p.delivery();
                    self.update_publication(&id, &deliveries);
                    self.output.push(Output::Delivery { req, deliveries });
                }
            }
        }
        self.profiles_changed = true;
        self.quality_revision = self.quality_revision.wrapping_add(1);
    }
    pub(in crate::engine::network) fn auth_tick(&mut self, now: u64) {
        let jobs = self
            .relays
            .values()
            .filter_map(|r| r.auth.pending.as_ref())
            .map(|(job, _)| job.clone())
            .collect::<Vec<_>>();
        for job in jobs {
            if !self.auth_needed(&job.relay, &job.event.pubkey, now) {
                self.auth_cancel(&job);
            } else if now >= job.deadline {
                self.auth_finished(&job.relay, false, "authentication-timeout", now);
            }
        }
        for r in self.relays.values_mut() {
            r.auth.blocked.retain(|id| self.requests.contains_key(id));
            r.auth
                .writes
                .retain(|id| self.publications.contains_key(id));
            for id in &r.auth.blocked {
                if let Some(q) = self.requests.get_mut(id)
                    && !q.complete
                    && now >= q.deadline
                {
                    q.complete = true;
                    self.profiles_changed = true;
                }
            }
        }
    }
}
