//! Finite demand owns HTTP; historical receipts keep only compact proof.
use super::{
    Discovery, Failure, InvoiceWork, Jobs, Providers, Receipts, Result, Target, TargetPlan,
};
use crate::store::Store;
use lkjstr_nips::identity::HttpResponse;
use std::collections::{BTreeMap, BTreeSet};
#[path = "state_effects.rs"]
mod effects;
#[path = "state_tick.rs"]
mod tick;
pub const MAX_TARGETS: usize = 1024;
#[derive(Default)]
pub struct Effects {
    pub providers: Vec<Discovery>,
    pub abort_providers: Vec<u64>,
    pub invoices: Vec<InvoiceWork>,
    pub abort_invoices: Vec<u64>,
}
#[derive(Default)]
pub struct State {
    pub providers: Providers,
    pub receipts: Receipts,
    pub jobs: Jobs,
    demand: Vec<Target>,
    plans: BTreeMap<Target, Result<TargetPlan>>,
    pub(crate) routes: BTreeMap<String, Vec<String>>,
    scope_errors: BTreeMap<Target, Failure>,
    candidates: Vec<String>,
    candidate_revision: Option<u64>,
    last_sync: Option<(u64, u64, u64)>,
    projected_revision: (u64, u64),
    pending_providers: BTreeMap<u64, Discovery>,
    running_providers: BTreeSet<u64>,
    cancel_providers: BTreeSet<u64>,
    pending_invoices: BTreeMap<u64, InvoiceWork>,
    running_invoices: BTreeSet<u64>,
    cancel_invoices: BTreeSet<u64>,
}
impl State {
    pub fn revision(&self) -> (u64, u64) {
        (self.providers.revision(), self.receipts.revision())
    }
    /// Includes asynchronous completions since the last rendered projection.
    pub fn projection_changed(&mut self) -> bool {
        let revision = self.revision();
        let changed = self.projected_revision != revision;
        self.projected_revision = revision;
        changed
    }
    pub(crate) fn target_pending(&self, store: &Store, target: &Target, now: u64) -> bool {
        if self.scope_errors.contains_key(target) {
            return false;
        }
        let Some(plan) = self.plans.get(target) else {
            return true;
        };
        let Ok(plan) = plan else {
            return false;
        };
        self.receipts.target_pending(target)
            || plan
                .recipients
                .iter()
                .any(|r| self.providers.status(store, &r.pubkey, now).0 == super::Phase::Loading)
    }
    pub fn targets(&self) -> &[Target] {
        &self.demand
    }
    pub fn metadata(&self) -> Vec<(String, Vec<String>)> {
        self.providers
            .missing_metadata()
            .into_iter()
            .map(|p| {
                let routes = self.routes.get(&p).cloned().unwrap_or_default();
                (p, routes)
            })
            .collect()
    }
    pub fn missing_targets(&self, store: &Store) -> Vec<String> {
        self.demand
            .iter()
            .filter_map(|t| match t {
                Target::Event { id } if store.get(id).is_none() => Some(id.clone()),
                _ => None,
            })
            .collect()
    }
    pub fn provider_response(
        &mut self,
        store: &Store,
        job: &Discovery,
        response: Result<HttpResponse>,
        now: u64,
    ) -> bool {
        self.running_providers.remove(&job.token);
        self.providers.complete(store, job, response, now)
    }
    pub fn metadata_finished(&mut self, recipient: &str, error: Failure, now: u64) {
        self.providers.metadata_finished(recipient, error, now);
    }
}
