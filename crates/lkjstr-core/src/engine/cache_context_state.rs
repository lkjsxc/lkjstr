//! Per-target durable authority is distinct from live, uncommitted contributors.
use crate::{
    cache::context::{CONTEXT_RECORDS, CONTEXT_TARGETS, Context},
    store::Store,
};
use lkjstr_protocol::{NostrEvent, tags::tag_values};
use serde::Serialize;
#[path = "cache_context_evidence.rs"]
mod evidence;
#[path = "cache_context_policy.rs"]
mod policy;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Serialize)]
pub struct ContextEvidence {
    pub lineage: String,
    /// Decimal string: consumers must not round this through a JavaScript Number.
    pub generation: String,
    pub token: String,
    pub restored: bool,
    pub current: bool,
}
#[derive(Default)]
pub struct ContextBatch {
    pub contexts: Vec<Context>,
    revisions: BTreeMap<String, u64>,
    receipt_revision: u64,
}
struct Committed {
    context: Context,
    members: BTreeMap<String, (String, u64)>,
}
#[derive(Default)]
pub struct ReadContexts {
    reads: BTreeMap<String, u64>,
    committed: BTreeMap<String, Committed>,
    members: BTreeMap<String, BTreeSet<String>>,
    dirty: BTreeMap<String, u64>,
    clock: u64,
    receipt_revision: u64,
    // Current committed public mute identity for at most 128 recently used accounts.
    policies: BTreeMap<String, (String, u64)>,
    // Transient public lookup intent; bounded by 128 views and 1600 IDs per view.
    pub(super) references: BTreeMap<String, Vec<String>>,
}
impl ReadContexts {
    fn dirty(&mut self, target: &str) {
        self.clock = self.clock.saturating_add(1);
        self.dirty.insert(target.to_owned(), self.clock);
    }
    pub(super) fn touch(&mut self, ids: &[String], now: u64) {
        for id in ids.iter().take(32) {
            if self
                .reads
                .get(id)
                .is_some_and(|seen| now.saturating_sub(*seen) < 10000)
            {
                continue;
            }
            self.reads.insert(id.clone(), now);
            self.dirty(id);
        }
        while self.reads.len() > CONTEXT_TARGETS {
            let Some(old) = self
                .reads
                .iter()
                .min_by_key(|(id, seen)| (**seen, *id))
                .map(|(id, _)| id.clone())
            else {
                break;
            };
            self.reads.remove(&old);
            self.dirty.remove(&old);
        }
    }
    /// Called only after signature verification, including locally signed events.
    pub fn changed(&mut self, event: &NostrEvent) {
        if !matches!(event.kind, 1 | 5 | 6 | 7 | 16 | 42 | 9735 | 30023) {
            return;
        }
        let mut targets = BTreeSet::new();
        for id in std::iter::once(event.id.clone())
            .chain(tag_values(event, "e"))
            .chain(tag_values(event, "q"))
        {
            if self.reads.contains_key(&id) {
                targets.insert(id.clone());
            }
            if let Some(owners) = self.members.get(&id) {
                targets.extend(owners.iter().cloned());
            }
        }
        for target in &targets {
            if self.reads.contains_key(target) {
                self.dirty(target);
            }
        }
        // Track a new reply before its next flush so a later grandchild also
        // invalidates the root context. The index has the same hard record bound.
        if self.members.len() < CONTEXT_RECORDS && !targets.is_empty() {
            self.members
                .entry(event.id.clone())
                .or_default()
                .extend(targets);
        }
    }
    pub fn pending(&self) -> bool {
        !self.dirty.is_empty()
    }
    pub(super) fn receipts_restored(&mut self, revision: u64) {
        self.receipt_revision = revision;
    }
    pub fn receipts_changed(&mut self, revision: u64) {
        if self.receipt_revision == revision {
            return;
        }
        self.receipt_revision = revision;
        let targets: Vec<_> = self
            .committed
            .iter()
            .filter(|(_, entry)| entry.members.values().any(|(_, kind)| *kind == 9735))
            .map(|(target, _)| target.clone())
            .collect();
        for target in targets {
            if self.reads.contains_key(&target) {
                self.dirty(&target);
            }
        }
    }
    pub fn batch(&self, store: &Store, receipts: &crate::engine::zaps::Receipts) -> ContextBatch {
        self.batch_with_limits(store, receipts, crate::cache::context::Limits::default())
    }
    pub fn batch_with_limits(
        &self,
        store: &Store,
        receipts: &crate::engine::zaps::Receipts,
        limits: crate::cache::context::Limits,
    ) -> ContextBatch {
        let mut targets: Vec<_> = self.dirty.keys().collect();
        targets.sort_by_key(|id| std::cmp::Reverse(self.reads.get(*id).copied().unwrap_or(0)));
        let mut limits = limits.bounded();
        // Include the enclosing journal, separators and generation in the byte budget.
        limits.bytes = limits.bytes.saturating_sub(1024);
        let mut contexts = Vec::new();
        for target in targets {
            if contexts.len() >= limits.targets {
                break;
            }
            let Some(seen) = self.reads.get(target) else {
                continue;
            };
            let Ok(Some(mut context)) = Context::capture_bounded(store, target, *seen, limits)
            else {
                continue;
            };
            if receipts
                .checkpoint_bounded(store, &mut context, limits)
                .is_err()
            {
                continue;
            }
            let Ok(bytes) = serde_json::to_vec(&context).map(|encoded| encoded.len() + 1) else {
                continue;
            };
            if context.rows.len() > limits.records || bytes > limits.bytes {
                continue;
            }
            limits.records -= context.rows.len();
            limits.bytes -= bytes;
            contexts.push(context);
        }
        ContextBatch {
            contexts,
            revisions: self.dirty.clone(),
            receipt_revision: receipts.revision(),
        }
    }
    pub(super) fn committed(&mut self, batch: &ContextBatch, receipt_revision: u64) {
        // The first capture can precede a provider answer. Its first committed
        // context was absent from receipts_changed's earlier membership scan.
        if batch.receipt_revision != receipt_revision {
            let changed: Vec<_> = batch
                .revisions
                .keys()
                .filter(|target| {
                    self.committed
                        .get(*target)
                        .is_some_and(|entry| entry.members.values().any(|(_, kind)| *kind == 9735))
                })
                .cloned()
                .collect();
            for target in changed {
                self.dirty(&target);
            }
        }
        for (target, revision) in &batch.revisions {
            if self.dirty.get(target) == Some(revision) {
                self.dirty.remove(target);
            }
        }
    }
    pub(super) fn install(&mut self, contexts: Vec<Context>) -> Result<(), &'static str> {
        let mut committed = BTreeMap::new();
        let mut members: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for context in contexts {
            if context.lineage.is_empty() {
                return Err("uncommitted read context");
            }
            let events = context.checked()?;
            let identities = events
                .into_iter()
                .map(|(id, event)| {
                    members
                        .entry(id.clone())
                        .or_default()
                        .insert(context.target.clone());
                    (id, (event.pubkey, event.kind))
                })
                .collect();
            self.reads
                .entry(context.target.clone())
                .and_modify(|seen| *seen = (*seen).max(context.seen_at))
                .or_insert(context.seen_at);
            committed.insert(
                context.target.clone(),
                Committed {
                    context,
                    members: identities,
                },
            );
        }
        self.committed = committed;
        self.members = members;
        // Reuse the same recency bound without creating another dirty touch.
        self.touch(&[], 0);
        Ok(())
    }
}
