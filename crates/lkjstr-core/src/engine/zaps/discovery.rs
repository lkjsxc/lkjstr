//! At most 512 cached recipients and four concurrent provider requests.
use super::{Binding, Failure, Phase, Provider, binding, provider};
use crate::store::Store;
use lkjstr_nips::identity::HttpResponse;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
#[path = "discovery_sync.rs"]
mod sync;

pub const MAX_PROVIDERS: usize = 512;
pub const MAX_HTTP: usize = 4;
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Discovery {
    pub token: u64,
    pub binding: Binding,
}
#[derive(Default)]
pub struct Work {
    pub fetch: Vec<Discovery>,
    pub cancel: Vec<u64>,
}
#[derive(Clone)]
struct Entry {
    profile: Option<String>,
    binding: Option<Binding>,
    provider: Option<Arc<Provider>>,
    phase: Phase,
    error: Option<Failure>,
    inflight: Option<(u64, u64)>,
    retry_at: u64,
    last_used: u64,
    last_attempt: u64,
}
impl Entry {
    fn refresh(&mut self, store: &Store, recipient: &str, now: u64) {
        let last_attempt = self.last_attempt;
        *self = Self::new(store, recipient, now);
        self.last_attempt = last_attempt;
    }
    fn new(store: &Store, recipient: &str, now: u64) -> Self {
        let profile = store.replaceable(recipient, 0).map(|p| p.id.clone());
        let result = binding(store, recipient);
        let (binding, error, phase) = match result {
            Ok(binding) => (Some(binding), None, Phase::Loading),
            Err(Failure::NotFound) => (None, None, Phase::Loading),
            Err(error) => (None, Some(error), error.phase()),
        };
        Self {
            profile,
            binding,
            provider: None,
            phase,
            error,
            inflight: None,
            retry_at: now.saturating_add(if phase == Phase::Loading {
                20
            } else {
                super::FAILURE_TTL
            }),
            last_used: now,
            last_attempt: 0,
        }
    }
}
#[derive(Default)]
pub struct Providers {
    entries: BTreeMap<String, Entry>,
    wanted: BTreeSet<String>,
    serial: u64,
    revision: u64,
}
impl Providers {
    pub fn revision(&self) -> u64 {
        self.revision
    }
    pub fn len(&self) -> usize {
        self.entries.len()
    }
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
    pub fn get(&self, store: &Store, recipient: &str, now: u64) -> Option<Arc<Provider>> {
        let value = self.entries.get(recipient)?.provider.as_ref()?;
        (now < value.expires_at
            && store
                .replaceable(recipient, 0)
                .is_some_and(|p| p.id == value.binding.profile))
        .then(|| value.clone())
    }
    pub fn status(&self, store: &Store, recipient: &str, now: u64) -> (Phase, Option<Failure>) {
        let Some(entry) = self.entries.get(recipient) else {
            return (Phase::Loading, None);
        };
        if entry.profile != store.replaceable(recipient, 0).map(|p| p.id.clone())
            || (entry.provider.is_some() && self.get(store, recipient, now).is_none())
        {
            return (Phase::Loading, None);
        }
        (entry.phase, entry.error)
    }
    pub fn missing_metadata(&self) -> Vec<String> {
        self.wanted
            .iter()
            .filter(|r| {
                self.entries
                    .get(*r)
                    .is_some_and(|e| e.profile.is_none() && e.phase == Phase::Loading)
            })
            .cloned()
            .collect()
    }
    /// Only a settled metadata lookup may distinguish an absent profile from failure.
    pub fn metadata_finished(&mut self, recipient: &str, error: Failure, now: u64) {
        if let Some(entry) = self.entries.get_mut(recipient)
            && entry.profile.is_none()
            && entry.phase == Phase::Loading
        {
            entry.error = Some(error);
            entry.phase = error.phase();
            entry.retry_at = now.saturating_add(super::FAILURE_TTL);
            self.revision = self.revision.saturating_add(1);
        }
    }
    /// Late answers after cancellation/profile replacement cannot establish trust.
    pub fn complete(
        &mut self,
        store: &Store,
        job: &Discovery,
        response: std::result::Result<HttpResponse, Failure>,
        now: u64,
    ) -> bool {
        if !self.wanted.contains(&job.binding.recipient) {
            return false;
        }
        let Some(entry) = self.entries.get_mut(&job.binding.recipient) else {
            return false;
        };
        if !entry
            .inflight
            .is_some_and(|(id, deadline)| id == job.token && now < deadline)
            || entry.binding.as_ref() != Some(&job.binding)
            || binding(store, &job.binding.recipient).ok().as_ref() != Some(&job.binding)
        {
            return false;
        }
        entry.inflight = None;
        match response.and_then(|response| provider(job.binding.clone(), &response, now)) {
            Ok(value) => {
                entry.retry_at = value.expires_at;
                entry.provider = Some(Arc::new(value));
                entry.phase = Phase::Ready;
                entry.error = None;
            }
            Err(error) => {
                entry.provider = None;
                entry.phase = error.phase();
                entry.error = Some(error);
                entry.retry_at = now.saturating_add(super::FAILURE_TTL);
            }
        }
        self.revision = self.revision.saturating_add(1);
        true
    }
}
