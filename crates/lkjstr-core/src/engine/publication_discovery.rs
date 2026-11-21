//! Missing inbox lists are read during the discovery window while own delivery proceeds.
use super::{
    Engine,
    network::Network,
    protocol::{Query, Source},
    publication_plan::Destination,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
pub(super) fn recipients(event: &NostrEvent) -> Vec<String> {
    if !matches!(event.kind, 1 | 6 | 7 | 16 | 42 | 30023) {
        return vec![];
    }
    event
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|k| k == "p"))
        .filter_map(|t| t.get(1))
        .filter(|p| *p != &event.pubkey && lkjstr_protocol::is_pubkey(p))
        .cloned()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .take(32)
        .collect()
}
impl Engine {
    pub(super) fn publication_wants(&mut self, now: u64) -> Vec<(String, NostrFilter, Query)> {
        let updates: Vec<_> = self
            .network
            .publications
            .iter()
            .filter(|(_, p)| p.event.kind == 1 && now < p.delivery_until())
            .map(|(id, p)| {
                (
                    id.clone(),
                    p.author_list.clone(),
                    now < p.deadline,
                    self.note_route_policy(&p.event.pubkey),
                )
            })
            .collect();
        for (id, previous, discover, policy) in updates {
            self.network.apply_note_opt_out(&id, &policy.blocked);
            if !discover {
                continue;
            }
            let Some(list) = policy
                .list
                .as_ref()
                .filter(|list| Some(&list.id) != previous.as_ref())
            else {
                continue;
            };
            if let Some(p) = self.network.publications.get_mut(&id) {
                p.author_list = Some(list.id.clone());
                p.author_route_wait_until = 0;
            }
            let routes = super::note_routes::refreshed_destinations(list, &policy);
            self.network.extend_publication(&id, routes, true);
        }
        let jobs: Vec<_> = self
            .network
            .publications
            .iter()
            .filter(|(_, p)| p.discovery_pending && now < p.deadline)
            .map(|(id, p)| (id.clone(), p.event.clone(), p.recipients.clone()))
            .collect();
        let mut wants = vec![];
        for (id, event, people) in jobs {
            let missing: Vec<_> = people
                .into_iter()
                .filter(|p| {
                    self.store.replaceable(p, 10002).is_none()
                        && !self.network.list_loaded(&self.store, p, 10002)
                })
                .collect();
            self.network.set_unresolved_recipients(&id, missing.len());
            let routes = self.publication_routes(&event);
            self.network.extend_publication(&id, routes, false);
            if let Some(p) = self.network.publications.get_mut(&id) {
                p.discovery_pending = !missing.is_empty();
                p.recipients = missing.clone();
            }
            for person in missing {
                let filter = NostrFilter {
                    authors: Some(vec![person]),
                    kinds: Some(vec![10002]),
                    limit: Some(1),
                    ..Default::default()
                };
                let mut routes = self.network.read_routes(
                    &filter,
                    &Query::default(),
                    &self.store,
                    &mut super::weights::PlanWeights::new(&self.store, &self.private_lists),
                    now,
                );
                if routes.is_empty() {
                    routes = self
                        .network
                        .relay_order
                        .iter()
                        .filter(|url| {
                            self.discovery_relays.contains(url)
                                || self
                                    .network
                                    .known
                                    .get(*url)
                                    .is_some_and(|r| r.write || r.search)
                        })
                        .take(2)
                        .cloned()
                        .collect();
                }
                for relay in routes {
                    wants.push((
                        format!("~publication:{id}"),
                        filter.clone(),
                        Query {
                            source: Source::Relay,
                            target: Some(relay),
                            ..Default::default()
                        },
                    ));
                }
            }
        }
        wants
    }
}
impl Network {
    fn extend_publication(&mut self, id: &str, mut routes: Vec<Destination>, author_update: bool) {
        let Some(p) = self.publications.get_mut(id) else {
            return;
        };
        // Author refresh adds outboxes; recipient discovery adds inbox/context.
        routes.retain(|d| {
            (d.rule == "own") == author_update
                && p.deliveries
                    .get(&d.url)
                    .is_none_or(|state| state == "skipped")
        });
        if routes.is_empty() {
            return;
        }
        let limit = if p.event.kind == 1 {
            super::publication_plan::NOTE_ROUTE_LIMIT
        } else {
            20
        };
        for d in routes.iter_mut().filter(|d| d.state == "pending") {
            let reason = if p.deliveries.len() >= limit && !p.deliveries.contains_key(&d.url) {
                Some("capacity")
            } else if p.event.kind != 1 && p.inbox_routes >= 8 && d.rule != "own" {
                Some("inbox-cap")
            } else {
                None
            };
            if let Some(reason) = reason {
                d.state = "skipped".into();
                d.reason = Some(reason.into());
                continue;
            }
            p.inbox_routes += usize::from(d.rule != "own");
            p.deliveries.insert(d.url.clone(), "pending".into());
            p.waiting.push_back(d.url.clone());
        }
        let output = super::protocol::Output::Delivery {
            req: p.req.clone(),
            deliveries: p.delivery(),
        };
        self.extend_publication_history(id, routes);
        self.output.push(output);
    }
}
