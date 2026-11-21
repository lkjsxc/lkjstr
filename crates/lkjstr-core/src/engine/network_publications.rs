use super::*;

impl Publication {
    pub(in crate::engine) fn delivery_until(&self) -> u64 {
        if self.reported_success && matches!(self.event.kind, 1 | 5) {
            self.deadline.saturating_add(90_000)
        } else {
            self.deadline
        }
    }
}
impl Network {
    pub fn pending_event(&self, id: &str) -> bool {
        self.publications
            .get(id)
            .is_some_and(|p| !p.reported_success)
    }
    pub(in crate::engine) fn can_stage_publication(&self, id: &str) -> bool {
        self.publications.len() < 64 && !self.publications.contains_key(id)
    }
    pub(in crate::engine) fn stage_publication(
        &mut self,
        req: String,
        event: NostrEvent,
        routes: Vec<crate::engine::publication_plan::Destination>,
        now: u64,
        auth_account: String,
    ) {
        if !self.can_stage_publication(&event.id) {
            self.output.push(Output::Error {
                req: Some(req),
                code: "publication-limit".into(),
            });
            return;
        }
        let mut pending: Vec<_> = routes.iter().filter(|d| d.state == "pending").collect();
        if event.kind == 1 {
            pending.sort_by_key(|d| self.publication_priority(&d.url, now));
        }
        let waiting = pending
            .iter()
            .map(|d| d.url.clone())
            .collect::<std::collections::VecDeque<_>>();
        let inbox_routes = pending.iter().filter(|d| d.rule != "own").count();
        let deliveries = waiting
            .iter()
            .map(|url| (url.clone(), "pending".into()))
            .collect();
        self.remember_publication(&event, routes, now);
        let recipients = crate::engine::publication_discovery::recipients(&event);
        let discovery_pending = !recipients.is_empty();
        self.publications.insert(
            event.id.clone(),
            Publication {
                req,
                event,
                auth_account,
                deadline: now.saturating_add(PUBLICATION_WAIT_MS),
                deliveries,
                waiting,
                route_deadlines: BTreeMap::new(),
                sent: BTreeMap::new(),
                attempted: BTreeSet::new(),
                messages: BTreeMap::new(),
                observed: BTreeSet::new(),
                transport_confirmed: BTreeSet::new(),
                reported_success: false,
                recipients,
                inbox_routes,
                discovery_pending,
                author_list: None,
                author_route_wait_until: 0,
                default_routes: Vec::new(),
                default_notice_sent: false,
                connect_late: false,
            },
        );
    }
    pub(super) fn send_pending(&mut self, now: u64) {
        let mut frames = Vec::new();
        let mut updates = Vec::new();
        for p in self
            .publications
            .values_mut()
            .filter(|p| now < p.delivery_until())
        {
            let before = p.attempted.len();
            for (relay, (_, ack)) in &mut p.route_deadlines {
                if p.deliveries.get(relay).is_some_and(|s| s == "pending")
                    && p.sent
                        .get(relay)
                        .is_none_or(|at| now.saturating_sub(*at) >= 5000)
                    && self.relays.get(relay).is_some_and(|r| {
                        r.online && now >= r.cooldown_until && !r.auth.writes.contains(&p.event.id)
                    })
                {
                    p.sent.insert(relay.clone(), now);
                    if p.attempted.insert(relay.clone()) && p.event.kind == 1 {
                        *ack = Some(now.saturating_add(NOTE_ACK_WAIT_MS));
                    }
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
                (self.relays[*url].publish_only || !self.relay_order.contains(url))
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
        self.settle_reads(now);
        self.metadata_finished();
        let ids: Vec<_> = self
            .publications
            .iter()
            .filter(|(_, p)| {
                now >= p.delivery_until()
                    || ((!p.discovery_pending || now >= p.deadline)
                        && (p.reported_success || now >= p.author_route_wait_until)
                        && p.deliveries.values().all(|s| s != "pending"))
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

impl Network {
    pub fn publish(
        &mut self,
        req: String,
        event: NostrEvent,
        routes: Vec<crate::engine::publication_plan::Destination>,
        now: u64,
    ) {
        let account = if event.kind == 1059 {
            String::new()
        } else {
            event.pubkey.clone()
        };
        self.publish_as(req, event, routes, now, account);
    }

    /// Gift wraps require their original sender; their event pubkey is ephemeral.
    pub fn publish_as(
        &mut self,
        req: String,
        event: NostrEvent,
        routes: Vec<crate::engine::publication_plan::Destination>,
        now: u64,
        account: String,
    ) {
        self.stage_publication(req, event, routes, now, account);
        self.tick(now);
    }
}
