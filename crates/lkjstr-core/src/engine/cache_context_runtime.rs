//! Restore complete public contexts before views and acknowledge only durable commits.
use super::{ContextBatch, Engine};
use crate::cache::context::{CONTEXT_BYTES, CONTEXT_RECORDS, CONTEXT_TARGETS, Context};

impl Engine {
    pub(in crate::engine) fn cache_read(&mut self, sub: &str, ids: &[String], now: u64) {
        let Some(view) = self.views.get(sub).filter(|view| view.visible) else {
            return;
        };
        let ids: Vec<_> = ids
            .iter()
            .take(32)
            .filter(|id| {
                view.rows.iter().any(|row| {
                    row.hidden_reason.is_none()
                        && crate::engine::zap_visible::matches_anchor(&self.store, row, id, view)
                })
            })
            .cloned()
            .collect();
        self.read_contexts.touch(&ids, now);
    }
    pub fn restore_contexts(&mut self, contexts: Vec<Context>) -> Result<(), &'static str> {
        if contexts.len() > CONTEXT_TARGETS
            || contexts.iter().map(|c| c.rows.len()).sum::<usize>() > CONTEXT_RECORDS
            || serde_json::to_vec(&contexts)
                .map_err(|_| "read context encoding failed")?
                .len()
                > CONTEXT_BYTES
        {
            return Err("read contexts exceed budget");
        }
        // Validate the complete manifest before changing retention or live evidence.
        for context in &contexts {
            context.checked()?;
            if context.lineage.is_empty() {
                return Err("uncommitted read context");
            }
        }
        let mut rows: Vec<_> = contexts
            .iter()
            .flat_map(|context| context.rows.iter().cloned())
            .collect();
        rows.sort_by_key(|row| (row.kind != Some(5), row.id.clone()));
        self.store.pin_contexts(&rows)?;
        self.trim_store();
        self.restore_cache(&rows);
        for context in &contexts {
            if context.deleted() {
                self.store.confirm_verified_deletion(&context.target);
            }
        }
        let proofs: Vec<_> = contexts
            .iter()
            .flat_map(|context| context.zaps.iter().cloned())
            .collect();
        self.zaps
            .receipts
            .restore_checked(&self.store, &proofs)
            .map_err(|_| "zap context restore failed")?;
        self.read_contexts.install(contexts)?;
        self.read_contexts.restore_deletions(&self.store);
        self.read_contexts
            .receipts_restored(self.zaps.receipts.revision());
        // Prime retained receipt candidates before any row can project a zero total.
        self.zap_tick(self.network.now);
        self.invalidate();
        Ok(())
    }
    pub fn contexts_committed(
        &mut self,
        batch: &ContextBatch,
        contexts: Option<Vec<Context>>,
    ) -> Result<(), &'static str> {
        if let Some(contexts) = contexts {
            self.restore_contexts(contexts)?;
        }
        self.read_contexts
            .committed(batch, self.zaps.receipts.revision());
        Ok(())
    }
}
