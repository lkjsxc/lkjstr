use super::super::{Coverage, Failure, Target, target};
use super::{MAX_TARGETS, State};
use crate::store::{Query, Store};
use std::collections::{BTreeMap, BTreeSet};
impl State {
    /// Expensive target signatures and receipt signatures each use four slots per
    /// pump. Provider discovery has its own four-request bound and absolute deadline.
    pub fn tick(
        &mut self,
        store: &Store,
        visible: &[Target],
        coverage: &BTreeMap<Target, Coverage>,
        missing: &BTreeMap<Target, Failure>,
        now: u64,
    ) -> bool {
        let old = (self.demand.clone(), self.routes.clone());
        let mut seen = BTreeSet::new();
        let demand: Vec<_> = self
            .jobs
            .targets()
            .into_iter()
            .chain(visible.iter().cloned())
            .filter(|t| seen.insert(t.clone()))
            .take(MAX_TARGETS)
            .collect();
        let jobs_changed = self.jobs.changed();
        let demand_changed = self.demand != demand || jobs_changed;
        self.demand = demand;
        self.plans.retain(|t, plan| {
            seen.contains(t)
                && match t {
                    Target::Event { id } => {
                        store.get(id).is_some() || matches!(plan, Err(Failure::NotFound))
                    }
                    _ => true,
                }
        });
        for t in &self.demand {
            if self.plans.get(t) == Some(&Err(Failure::NotFound))
                && matches!(t, Target::Event{id} if store.get(id).is_some())
            {
                self.plans.remove(t);
            }
        }
        let unresolved: Vec<_> = self
            .demand
            .iter()
            .filter(|t| !self.plans.contains_key(*t))
            .take(4)
            .cloned()
            .collect();
        let plans_changed = !unresolved.is_empty();
        for t in unresolved {
            self.plans.insert(t.clone(), target(store, &t));
        }
        let stamp = (store.revision(), self.providers.revision(), now);
        if demand_changed || plans_changed || self.last_sync != Some(stamp) {
            self.routes.clear();
            self.scope_errors.clear();
            for t in &self.demand {
                let Some(plan) = self.plans.get(t) else {
                    continue;
                };
                let plan = match plan {
                    Ok(plan) => plan,
                    Err(Failure::NotFound) => continue,
                    Err(error) => {
                        self.scope_errors.insert(t.clone(), *error);
                        continue;
                    }
                };
                let extra = plan
                    .recipients
                    .iter()
                    .filter(|r| !self.routes.contains_key(&r.pubkey))
                    .count();
                if self.routes.len() + extra > super::super::discovery::MAX_PROVIDERS {
                    self.scope_errors.insert(t.clone(), Failure::TooLarge);
                    continue;
                }
                for r in &plan.recipients {
                    let routes = self.routes.entry(r.pubkey.clone()).or_default();
                    for relay in &r.metadata_relays {
                        if !routes.contains(relay) {
                            routes.push(relay.clone());
                        }
                    }
                    routes.truncate(8);
                }
            }
            let people: Vec<_> = self.routes.keys().cloned().collect();
            let urgent: BTreeSet<_> = self
                .jobs
                .targets()
                .iter()
                .filter_map(|t| self.plans.get(t).and_then(|p| p.as_ref().ok()))
                .flat_map(|p| p.recipients.iter().map(|r| r.pubkey.clone()))
                .collect();
            if let Ok(work) = self.providers.sync_for(store, &people, &urgent, now) {
                for token in work.cancel {
                    self.pending_providers.remove(&token);
                    if self.running_providers.remove(&token) {
                        self.cancel_providers.insert(token);
                    }
                }
                for work in work.fetch {
                    self.pending_providers.insert(work.token, work);
                }
            }
            if self.candidate_revision != Some(store.revision()) {
                self.candidates = store
                    .feed(&Query {
                        kinds: vec![9735],
                        limit: super::super::receipt_cache::MAX_RECEIPTS,
                        ..Default::default()
                    })
                    .iter()
                    .map(|e| e.id.clone())
                    .collect();
                self.candidate_revision = Some(store.revision());
            }
            let _ = self
                .receipts
                .sync(store, &self.providers, &self.candidates, now);
            self.last_sync = Some((store.revision(), self.providers.revision(), now));
        }
        if !self.demand.is_empty() {
            self.receipts.advance_selected(
                store,
                &self.providers,
                &self.demand,
                &self.jobs.targets(),
                now,
                4,
            );
        }
        let mut missing = missing.clone();
        missing.extend(self.scope_errors.clone());
        self.jobs.fail_targets(&missing);
        self.jobs.project(
            store,
            &self.providers,
            &self.receipts,
            &self.plans,
            (coverage, &missing),
            now,
        );
        for work in self
            .jobs
            .prepare_invoices(store, &self.providers, &self.plans, now)
        {
            self.pending_invoices.insert(work.token, work);
        }
        old != (self.demand.clone(), self.routes.clone())
    }
}
