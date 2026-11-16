use super::*;
impl Network {
    pub fn pending_event(&self, id: &str) -> bool {
        self.publications
            .get(id)
            .is_some_and(|p| !p.reported_success)
    }
    pub fn publish(
        &mut self,
        req: String,
        event: NostrEvent,
        mut routes: Vec<crate::engine::publication_plan::Destination>,
        now: u64,
    ) {
        if self.publications.len() >= 64 || self.publications.contains_key(&event.id) {
            self.output.push(Output::Error {
                req: Some(req),
                code: "publication-limit".into(),
            });
            return;
        }
        self.release_publication_relays();
        for d in routes.iter_mut().filter(|d| d.state == "pending") {
            if !self.relays.contains_key(&d.url) {
                // Idle transient transports are released before accepting a new job.
                if self.relays.len() >= 64 {
                    d.state = "skipped".into();
                    d.reason = Some("capacity".into());
                    continue;
                }
                self.effects.push(Effect::Inspect(d.url.clone()));
                self.relays.insert(
                    d.url.clone(),
                    Relay {
                        retry_at: now,
                        max_reqs: 4,
                        max_limit: 200,
                        ..Default::default()
                    },
                );
                self.apply_quality(&d.url, now);
            }
        }
        let deliveries: BTreeMap<String, String> = routes
            .iter()
            .filter(|d| d.state == "pending")
            .map(|d| (d.url.clone(), "pending".into()))
            .collect();
        let inbox_routes = routes
            .iter()
            .filter(|d| d.rule != "own" && d.state == "pending")
            .map(|d| d.url.clone())
            .collect();
        self.remember_publication(&event, routes, now);
        let recipients = crate::engine::publication_discovery::recipients(&event);
        let discovery_pending = !recipients.is_empty();
        self.publications.insert(
            event.id.clone(),
            Publication {
                req,
                event,
                deadline: now.saturating_add(30000),
                deliveries,
                sent: BTreeMap::new(),
                attempted: BTreeSet::new(),
                messages: BTreeMap::new(),
                observed: BTreeSet::new(),
                transport_confirmed: BTreeSet::new(),
                reported_success: false,
                recipients,
                inbox_routes,
                discovery_pending,
            },
        );
        self.tick(now);
    }
    pub(super) fn send_pending(&mut self, now: u64) {
        let mut frames = Vec::new();
        let mut updates = Vec::new();
        for p in self.publications.values_mut().filter(|p| now < p.deadline) {
            let before = p.attempted.len();
            for (relay, state) in &p.deliveries {
                if state == "pending"
                    && p.sent
                        .get(relay)
                        .is_none_or(|at| now.saturating_sub(*at) >= 5000)
                    && self
                        .relays
                        .get(relay)
                        .is_some_and(|r| r.online && now >= r.cooldown_until)
                {
                    p.sent.insert(relay.clone(), now);
                    p.attempted.insert(relay.clone());
                    frames.push((relay.clone(), p.event.clone()));
                }
            }
            if before != p.attempted.len() {
                updates.push((p.req.clone(), p.delivery()));
            }
        }
        for (req, deliveries) in updates {
            self.output.push(Output::Delivery { req, deliveries });
        }
        for (relay, event) in frames {
            self.send(&relay, json!(["EVENT", event]));
        }
    }
    pub(super) fn release_publication_relays(&mut self) {
        let idle: Vec<_> = self
            .relays
            .keys()
            .filter(|url| {
                !self.relay_order.contains(url)
                    && !(self.relays[*url].online && self.delivery_connection_wanted(url, self.now))
                    && !self.requests.values().any(|r| &r.relay == *url)
                    && !self
                        .publications
                        .values()
                        .any(|p| p.deliveries.get(*url).is_some_and(|s| s == "pending"))
            })
            .cloned()
            .collect();
        if !idle.is_empty() {
            self.remember_quality(self.now);
        }
        for url in idle {
            if self
                .relays
                .remove(&url)
                .is_some_and(|r| r.online || r.connecting)
            {
                self.effects.push(Effect::Disconnect(url));
            }
        }
    }
    pub(super) fn settle(&mut self, now: u64) {
        let subs: BTreeSet<_> = self
            .requests
            .values()
            .flat_map(|r| r.members.iter().cloned())
            .collect();
        for sub in subs {
            if self.verifying {
                break;
            }
            let rs: Vec<_> = self
                .requests
                .values()
                .filter(|r| r.members.contains(&sub))
                .collect();
            let done = rs
                .iter()
                .all(|r| r.page_eose || r.eose || r.complete || (r.sent && now >= r.deadline));
            if done {
                let state = if rs.iter().any(|r| r.last_event.is_some()) {
                    "data"
                } else if rs.iter().any(|r| !r.eose && !r.page_eose) {
                    "error"
                } else {
                    "not-found"
                };
                if self.reported.get(&sub).is_none_or(|s| s != state) {
                    self.output.push(Output::Status {
                        sub: sub.clone(),
                        state: state.into(),
                        answered_relays: self.request_progress(&sub).1,
                        asked_relays: rs
                            .iter()
                            .filter(|r| r.asked)
                            .map(|r| &r.relay)
                            .collect::<BTreeSet<_>>()
                            .len(),
                    });
                    self.reported.insert(sub.clone(), state.into());
                }
            }
        }
        let timed_out: Vec<_> = self
            .requests
            .iter()
            .filter(|(_, r)| !r.eose && !r.complete && r.sent && now >= r.deadline)
            .map(|(id, _)| id.clone())
            .collect();
        for id in timed_out {
            if let Some(r) = self.requests.get_mut(&id) {
                self.profiles_changed = true;
                r.complete = !r.live;
                r.ready_at = now + r.retry_delay;
                r.retry_delay = (r.retry_delay * 2).min(30000);
                let was_sent = r.sent;
                r.sent = false;
                let relay = r.relay.clone();
                if was_sent {
                    let wire = r.wire_id.clone();
                    self.close_group(&relay, &wire);
                }
            }
        }
        let ids: Vec<_> = self
            .publications
            .iter()
            .filter(|(_, p)| {
                now >= p.deadline
                    || (!p.discovery_pending && p.deliveries.values().all(|s| s != "pending"))
            })
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            if let Some(p) = self.publications.remove(&id) {
                self.finish_delivery(id, p, now);
            }
        }
        self.check_deliveries(now);
        self.release_publication_relays();
    }
}
