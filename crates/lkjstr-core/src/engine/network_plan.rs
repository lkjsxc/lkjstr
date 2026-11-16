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
        let live_lists = lists::views(&wants);
        let refresh_profiles: BTreeSet<_> = wants
            .iter()
            .filter(|(_, f, q)| q.source == Source::People && f.kinds.as_deref() == Some(&[0]))
            .map(|(sub, _, _)| sub.clone())
            .collect();
        let queries = wants.iter().map(|(sub, _, q)| (sub.clone(), q)).collect();
        let mut weights = crate::engine::weights::PlanWeights::new(store, private);
        let mut desired = Desired::new();
        let mut primary_reads = BTreeSet::new();
        for (sub, f, q) in &wants {
            let selected = if q.source == Source::Relay {
                read_plan::ReadRoutes {
                    routes: q
                        .target
                        .iter()
                        .filter(|r| self.relays.contains_key(*r))
                        .cloned()
                        .collect(),
                    primary: BTreeSet::new(),
                }
            } else {
                self.read_route_plan(f, q, store, &mut weights, now)
            };
            let mut routes = selected.routes;
            // Keep unfinished or full preceding, still-permitted routes when a
            // healthy route advances. Their remaining span is still owed.
            routes.extend(self.pending_page_routes(sub, f).into_iter().filter(|url| {
                self.relays.contains_key(url)
                    && (q.filters.relay_hints.contains(url)
                        || (q.source == Source::Relay && q.target.as_ref() == Some(url))
                        || self.known.get(url).is_some_and(|usage| match q.source {
                            Source::Search => usage.search,
                            Source::Channels => usage.read || usage.search,
                            Source::Relay => false,
                            _ => usage.read,
                        }))
            }));
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
                let primary = selected.primary.contains(&r);
                let key = (r, filter_to_value(f).to_string());
                if primary {
                    primary_reads.insert(key.clone());
                }
                let entry = desired.entry(key).or_insert((f.clone(), BTreeSet::new()));
                entry.1.insert(sub.clone());
            }
        }
        self.stabilize_profiles(&mut desired, &live_lists);
        let mut retained = BTreeSet::new();
        for ((relay, key), (filter, members)) in desired {
            let read_slot = primary_reads.contains(&(relay.clone(), key));
            let list_watch = lists::watch(&filter, &members, &live_lists);
            let live = filter_live(&filter) || members.contains("~account-discovery") || list_watch;
            let existing = self
                .requests
                .iter_mut()
                .find(|(_, r)| r.relay == relay && r.page_filter == filter);
            if let Some((id, r)) = existing {
                let close = r.watch_list(live, now);
                r.list_watch = list_watch;
                let relay = r.relay.clone();
                let wire = r.wire_id.clone();
                r.refresh_profile(&members, &refresh_profiles, now);
                r.live |= members.contains("~account-discovery");
                r.members = members;
                r.read_slot = read_slot;
                retained.insert(id.clone());
                if close {
                    self.close_group(&relay, &wire);
                }
            } else {
                let (wire_filter, exhausted, pending) =
                    self.page_request(&relay, &filter, &members);
                if let Some(id) = pending.as_ref() {
                    let previous = &self.requests[id];
                    let still_wanted = wants.iter().any(|(sub, f, _)| {
                        previous.members.contains(sub) && *f == previous.page_filter
                    });
                    if !still_wanted && let Some(r) = self.requests.get_mut(id) {
                        r.page_filter = filter;
                        r.members = members;
                        r.read_slot = read_slot;
                        r.live = live;
                        if r.retryable_page_timeout() {
                            r.complete = false;
                        }
                        retained.insert(id.clone());
                        continue;
                    }
                }
                self.next += 1;
                let id = format!("e{}", self.next);
                retained.insert(id.clone());
                let ready_at = if list_watch || !members.is_disjoint(&refresh_profiles) {
                    now
                } else {
                    self.hydration_ready(&filter, &members, now)
                };
                let previous = pending.as_ref().and_then(|id| self.requests.get(id));
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
                        read_slot,
                        verification_retry: previous.is_some_and(|r| r.verification_retry),
                        sent: false,
                        eose: exhausted,
                        page_eose: exhausted,
                        deadline: previous.map_or(u64::MAX, |r| r.deadline),
                        initial_deadline: previous.map_or(u64::MAX, |r| r.initial_deadline),
                        last_event: None,
                        sent_at: 0,
                        last_rx: now,
                        complete: exhausted
                            || previous.is_some_and(|r| r.complete && !r.retryable_page_timeout()),
                        live,
                        list_watch,
                        asked: previous.is_some_and(|r| r.asked),
                        ready_at: previous.map_or(ready_at, |r| r.ready_at),
                        received: previous.map_or_else(BTreeSet::new, |r| r.received.clone()),
                        page_limit: previous.map_or(200, |r| r.page_limit),
                        oldest: previous.and_then(|r| r.oldest),
                        retry_delay: previous.map_or(1000, |r| r.retry_delay),
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
                && !self.requests.iter().any(|(id, q)| {
                    retained.contains(id) && q.sent && q.relay == r.relay && q.wire_id == r.wire_id
                })
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
