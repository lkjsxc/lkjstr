//! Build shared logical wants before scheduling physical envelopes.
use super::*;
impl Network {
    pub fn plan_with_lists(
        &mut self,
        wants: Vec<(String, NostrFilter, Query)>,
        store: &crate::store::Store,
        private: &crate::engine::settings::PrivateLists,
        now: u64,
    ) {
        self.expire_coverage(now);
        let wants = want_key::gaps(wants, store);
        self.admit_outboxes(&wants, store, now);
        self.reported
            .retain(|sub, _| wants.iter().any(|(id, _, _)| id == sub));
        self.observe_read_starts(&wants, now);
        let live_lists = lists::views(&wants);
        let refresh_profiles: BTreeSet<_> = wants
            .iter()
            .filter(|(_, f, q)| q.source == Source::People && f.kinds.as_deref() == Some(&[0]))
            .map(|(sub, _, _)| sub.clone())
            .collect();
        let queries = wants.iter().map(|(sub, _, q)| (sub.clone(), q)).collect();
        let mut weights = crate::engine::weights::PlanWeights::new(store, private);
        let mut desired = Desired::new();
        let mut primary_reads = BTreeMap::new();
        for (sub, f, q) in &wants {
            let time_owner =
                crate::engine::time_window_relay::is_owner(sub).then_some(sub.as_str());
            let selected = if q.source == Source::Relay {
                read_plan::ReadRoutes {
                    routes: q
                        .target
                        .iter()
                        .filter(|r| self.has_reader(r))
                        .cloned()
                        .collect(),
                    primary: BTreeSet::new(),
                    change: None,
                }
            } else {
                self.read_route_plan(f, q, store, &mut weights, now, time_owner)
            };
            let mut routes = selected.routes;
            // Keep unfinished or full preceding, still-permitted routes when a
            // healthy route advances. Their remaining span is still owed.
            routes.extend(self.pending_page_routes(sub, f).into_iter().filter(|url| {
                self.has_reader(url)
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
                    .filter(|u| self.has_reader(u))
                    .cloned(),
            );
            routes.sort();
            routes.dedup();
            for r in routes {
                let primary = selected.primary.contains(&r);
                let key = (
                    r,
                    time_owner.map_or_else(|| want_key::key(f), |owner| owner.to_owned()),
                );
                if primary {
                    let change = primary_reads.entry(key.clone()).or_insert(None);
                    *change = change.or(selected.change);
                }
                desired
                    .entry(key)
                    .or_insert((f.clone(), BTreeSet::new()))
                    .1
                    .insert(sub.clone());
            }
        }
        self.add_cache_repairs(&mut desired, &queries, store, now);
        self.stabilize_profiles(&mut desired, &live_lists);
        let mut retained = BTreeSet::new();
        for ((relay, key), (filter, members)) in desired {
            let primary = primary_reads.remove(&(relay.clone(), key));
            let read_slot = primary.is_some();
            let change = primary.flatten();
            let time_owner = members
                .iter()
                .find(|m| crate::engine::time_window_relay::is_owner(m));
            let list_watch = lists::watch(&filter, &members, &live_lists);
            let live = (filter_live(&filter) && filter.kinds.as_deref() != Some(&[10002]))
                || members.contains("~account-discovery")
                || list_watch;
            let union_safe = union::allowed(&filter, &members, &queries, store, private);
            let existing = self.requests.iter_mut().find(|(_, r)| {
                r.relay == relay
                    && r.owns_time(time_owner.map(String::as_str))
                    && want_key::same(&r.page_filter, &filter)
            });
            if let Some((id, r)) = existing {
                let close = r.watch_list(live, now);
                r.list_watch = list_watch;
                r.union_safe = union_safe;
                let relay = r.relay.clone();
                let wire = r.wire_id.clone();
                r.refresh_metadata(now);
                r.refresh_profile(&members, &refresh_profiles, now);
                r.live |= members.contains("~account-discovery");
                let shared = r.shared_members_added(&members);
                r.members = members;
                let promoted = read_slot && !r.read_slot;
                r.read_slot = read_slot;
                retained.insert(id.clone());
                if let Some(kind) = change.filter(|_| promoted).or(shared) {
                    self.decision(now, kind, &relay);
                }
                if close {
                    self.close_group(&relay, &wire);
                }
            } else {
                let (mut wire_filter, exhausted, pending) = if time_owner.is_some() {
                    (filter.clone(), false, None)
                } else {
                    self.page_request(&relay, &filter, &members)
                };
                if let Some(id) = pending.as_ref() {
                    let previous = &self.requests[id];
                    let still_wanted = wants.iter().any(|(sub, f, _)| {
                        previous.members.contains(sub) && want_key::same(f, &previous.page_filter)
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
                if let Some(kind) = change {
                    self.decision(now, kind, &relay);
                }
                let previous = pending.as_ref().and_then(|id| self.requests.get(id));
                let cached_until = previous.and_then(|r| r.cached_until).or_else(|| {
                    self.cached_boundary(&relay, &filter, &members, &queries, store, now)
                });
                if let Some(boundary) = cached_until {
                    wire_filter.since = Some(
                        boundary
                            .saturating_sub(2)
                            .max(wire_filter.since.unwrap_or(0)),
                    );
                }
                self.requests.insert(
                    id.clone(),
                    Request {
                        relay,
                        wire_id: id.clone(),
                        time_pages: time_owner.map(|owner| time_window::TimePages::new(owner)),
                        priority: 4,
                        purpose: "prefetch",
                        weight: 1,
                        filter: wire_filter,
                        page_filter: filter.clone(),
                        cached_until,
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
                        created_at: previous.map_or(now, |r| r.created_at),
                        first_event_at: previous.and_then(|r| r.first_event_at),
                        last_rx: now,
                        complete: exhausted
                            || previous.is_some_and(|r| r.complete && !r.retryable_page_timeout()),
                        live,
                        union_safe,
                        list_watch,
                        asked: previous.is_some_and(|r| r.asked),
                        ready_at: previous.map_or(ready_at, |r| r.ready_at),
                        received: previous
                            .map_or_else(PageFrontier::default, |r| r.received.clone()),
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
            // Rerouting a still-wanted follower page must not discard its
            // unfinished physical answer. Wait for the relay's EOSE before
            // changing routes; a tab truly closing can still cancel at once.
            let expensive_inflight = self.requests.get(&id).is_some_and(|r| {
                r.sent
                    && !r.page_eose
                    && now.saturating_sub(r.sent_at) < 9000
                    && r.filter.kinds.as_deref() == Some(&[3])
                    && r.filter.tags.contains_key("p")
                    && wants.iter().any(|(sub, filter, _)| {
                        r.members.contains(sub) && want_key::same(filter, &r.page_filter)
                    })
            });
            if expensive_inflight || self.keep_coverage(&id, now) {
                continue;
            }
            if let Some(r) = self.requests.remove(&id)
                && r.sent
                && !self.requests.iter().any(|(id, q)| {
                    retained.contains(id) && q.sent && q.relay == r.relay && q.wire_id == r.wire_id
                })
            {
                self.close_group(&r.relay, &r.wire_id);
            }
        }
        self.bound_coverage();
        self.request_policy(&queries, store, &mut weights);
        self.read_wakeup(now);
        self.tick(now);
    }
}
