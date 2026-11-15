//! Build shared logical wants before scheduling physical envelopes.
use super::*;
impl Network {
    pub fn plan(
        &mut self,
        wants: Vec<(String, NostrFilter, Query)>,
        store: &crate::store::Store,
        now: u64,
    ) {
        self.plan_with_lists(wants, store, &Default::default(), now);
    }
    pub fn plan_with_lists(
        &mut self,
        wants: Vec<(String, NostrFilter, Query)>,
        store: &crate::store::Store,
        private: &crate::engine::settings::PrivateLists,
        now: u64,
    ) {
        self.reported
            .retain(|sub, _| wants.iter().any(|(id, _, _)| id == sub));
        if self.relays.is_empty() {
            for (sub, _, _) in &wants {
                if self.reported.get(sub).is_none_or(|s| s != "error") {
                    self.output.push(Output::Status {
                        sub: sub.clone(),
                        state: "error".into(),
                        asked_relays: 0,
                        answered_relays: 0,
                    });
                    self.reported.insert(sub.clone(), "error".into());
                }
            }
        }
        let queries = wants.iter().map(|(sub, _, q)| (sub.clone(), q)).collect();
        let mut weights = crate::engine::weights::PlanWeights::new(store, private);
        let mut desired = Desired::new();
        for (sub, f, q) in &wants {
            let routes: Vec<String> = if q.source == Source::Relay {
                q.target
                    .iter()
                    .filter(|r| self.relays.contains_key(*r))
                    .cloned()
                    .collect()
            } else {
                self.read_routes(f, q, store, &mut weights, now)
            };
            let mut routes = routes;
            routes.extend(
                q.filters
                    .relay_hints
                    .iter()
                    .filter(|u| self.relays.contains_key(*u))
                    .cloned(),
            );
            routes.sort();
            routes.dedup();
            for r in routes {
                let key = (r, filter_to_value(f).to_string());
                let entry = desired.entry(key).or_insert((f.clone(), BTreeSet::new()));
                entry.1.insert(sub.clone());
            }
        }
        self.stabilize_profiles(&mut desired);
        let mut retained = BTreeSet::new();
        for ((relay, _key), (filter, members)) in desired {
            let existing = self
                .requests
                .iter_mut()
                .find(|(_, r)| r.relay == relay && r.page_filter == filter);
            if let Some((id, r)) = existing {
                r.refresh_profile(&members, now);
                r.live |= members.contains("~account-discovery");
                r.members = members;
                retained.insert(id.clone());
            } else {
                self.next += 1;
                let id = format!("e{}", self.next);
                retained.insert(id.clone());
                let live = filter_live(&filter) || members.contains("~account-discovery");
                let (wire_filter, exhausted) = self.page_request(&relay, &filter);
                self.requests.insert(
                    id.clone(),
                    Request {
                        relay,
                        wire_id: id.clone(),
                        priority: 4,
                        purpose: "prefetch",
                        weight: 1,
                        filter: wire_filter,
                        page_filter: filter.clone(),
                        members,
                        sent: false,
                        eose: exhausted,
                        page_eose: exhausted,
                        deadline: u64::MAX,
                        last_event: None,
                        sent_at: 0,
                        last_rx: now,
                        complete: exhausted,
                        live,
                        asked: false,
                        ready_at: now,
                        received: BTreeSet::new(),
                        page_limit: 200,
                        oldest: None,
                        retry_delay: 1000,
                    },
                );
            }
        }
        let obsolete: Vec<_> = self
            .requests
            .keys()
            .filter(|id| !retained.contains(*id))
            .cloned()
            .collect();
        for id in obsolete {
            if let Some(r) = self.requests.remove(&id)
                && r.sent
            {
                self.close_group(&r.relay, &r.wire_id);
            }
        }
        self.request_policy(&queries, store, &mut weights);
        self.tick(now);
    }
    pub(super) fn send(&mut self, relay: &str, value: Value) {
        if let Some(r) = self.relays.get_mut(relay) {
            r.sent += 1;
            r.bytes_out += value.to_string().len() as u64;
        }
        self.effects
            .push(Effect::Send(relay.into(), value.to_string()));
    }
}
