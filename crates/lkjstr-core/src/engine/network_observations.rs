//! Bounded routing diagnostics: no event bodies, public keys or secret material.
use super::*;
impl Network {
    pub fn request_stats(&self) -> Value {
        self.project_requests(None)
    }
    pub(in crate::engine) fn stats_requests(
        &self,
        views: &BTreeMap<&str, &crate::engine::View>,
    ) -> Value {
        self.project_requests(Some(views))
    }
    fn project_requests(&self, views: Option<&BTreeMap<&str, &crate::engine::View>>) -> Value {
        let stage_safe = views.is_some();
        json!(
            self.requests
                .iter()
                .filter(|(_, request)| !stage_safe || request.visible_in_stats())
                .take(256)
                .map(|(id, r)| json!({
                    "id":id,"relay":if stage_safe { self.stats_relay_label(&r.relay) } else { r.relay.clone() },"wireId":r.wire_id,"purpose":r.purpose,
                    "priority":r.priority,"weight":r.weight,"received":r.received.len(),
                    "sent":r.sent,"complete":r.page_eose,"members":r.members.len(),
                    "memberSubs":r.members.iter().filter_map(|member| {
                        let owner = progress::view_owner(member);
                        let owner = crate::engine::time_window_relay::view_owner(owner).unwrap_or(owner);
                        views.and_then(|views| views.get(owner))
                            .map(|view| format!("view-{}", view.telemetry_id))
                    }).collect::<BTreeSet<_>>(),
                    "role":r.role,"createdAtMs":r.created_at,"firstEventAtMs":r.first_event_at,
                    "hedgeDueAtMs":self.stats_hedge_due(r)
                }))
                .collect::<Vec<_>>()
        )
    }
    pub fn followed_coverage(
        &self,
        followed: &BTreeSet<String>,
        store: &crate::store::Store,
    ) -> BTreeMap<String, usize> {
        let mut asked: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::new();
        for r in self
            .requests
            .values()
            .filter(|r| r.sent && r.filter.kinds.as_ref().is_some_and(|ks| ks.contains(&1)))
        {
            for author in r
                .filter
                .authors
                .iter()
                .flatten()
                .filter(|a| followed.contains(*a))
            {
                asked.entry(&r.relay).or_default().insert(author);
            }
        }
        let mut coverage = BTreeMap::new();
        for person in followed {
            let routes: BTreeSet<_> = store
                .relay_list(person)
                .unwrap_or_default()
                .into_iter()
                .filter(|(_, _, write)| *write)
                .map(|(url, _, _)| url)
                .collect();
            for url in routes {
                if asked
                    .get(url.as_str())
                    .is_some_and(|authors| authors.contains(person.as_str()))
                {
                    *coverage.entry(url).or_default() += 1;
                }
            }
        }
        coverage
    }
    pub fn routing_stats(&self, url: &str, covered: usize) -> Value {
        let active = self.requests.values().any(|r| r.relay == url);
        let known = self.known.get(url);
        let rule = if !active {
            "unused"
        } else if known.is_some_and(|r| r.read) {
            "reader"
        } else if known.is_some_and(|r| r.search) {
            "search"
        } else {
            "hint"
        };
        let route = match known {
            Some(r) if r.read && r.write => "both",
            Some(r) if r.read => "reading",
            Some(r) if r.write => "writing",
            Some(r) if r.search => "search",
            Some(_) => "own",
            None if active => "reading",
            None => "unused",
        };
        let mut row = json!({"route":route,"readRule":rule,"followedCovered":covered,
            "weight":self.relays.get(url).map(|r| r.quality_weight(self.now)),
            "eoseMs":self.relays.get(url).and_then(|r| r.latency_ms),
            "usefulShare":self.relays.get(url).and_then(|r| (r.received > 0).then(|| r.useful.min(r.received) as f64 / r.received as f64)),
            "firstEventMs":self.relays.get(url).and_then(|r| r.first_event_ms),
            "requestUses":self.relays.get(url).map(|r| r.request_uses),
            "readTimeouts":self.relays.get(url).map(|r| r.timeouts)});
        if let Some(index) = self.telemetry.relay_index(url) {
            row["relayIndex"] = json!(index);
        }
        row
    }
    pub fn open_wires(&self) -> BTreeMap<&str, usize> {
        let mut out = BTreeMap::new();
        for r in self.receipts.values() {
            for url in r.checks.keys() {
                *out.entry(url.as_str()).or_default() += 1;
            }
        }
        let mut seen = BTreeSet::new();
        for r in self.requests.values().filter(|r| r.sent) {
            if seen.insert((&r.relay, &r.wire_id)) {
                *out.entry(r.relay.as_str()).or_default() += 1;
            }
        }
        out
    }
}
