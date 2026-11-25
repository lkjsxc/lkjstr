//! A durable token is separate from current live and historical-provider evidence.
use super::*;
impl ReadContexts {
    pub fn evidence(
        &self,
        store: &Store,
        receipts: &crate::engine::zaps::Receipts,
        target: &str,
    ) -> Option<ContextEvidence> {
        let entry = self.committed.get(target)?;
        let restored =
            entry.members.iter().all(|(id, (author, _))| {
                store.lease(id).is_some() || store.was_deleted(id, author)
            }) && entry
                .members
                .iter()
                .filter(|(_, (_, kind))| *kind == 9735)
                .all(|(id, (author, _))| {
                    store.was_deleted(id, author)
                        || entry.context.zaps.iter().any(|zap| {
                            &zap.id == id
                                && receipts
                                    .cached(store, id)
                                    .is_some_and(|live| zap.pending() || live.digest == zap.digest)
                        })
                });
        let live = Context::events(store, target).map(|events| {
            let mut ids: BTreeSet<_> = events.into_keys().collect();
            receipts.context_ids(store, &mut ids);
            ids
        });
        let committed: BTreeSet<_> = entry
            .members
            .iter()
            .filter(|(_, (_, kind))| *kind != 5)
            .map(|(id, _)| id)
            .collect();
        let current = restored
            && live.as_ref().is_some_and(|ids| {
                ids.iter().collect::<BTreeSet<_>>() == committed
                    && entry.context.zaps.iter().all(|zap| {
                        receipts
                            .cached(store, &zap.id)
                            .is_some_and(|live| live.digest == zap.digest)
                    })
            });
        Some(ContextEvidence {
            lineage: entry.context.lineage.clone(),
            generation: entry.context.generation.to_string(),
            token: entry.context.token.clone(),
            restored,
            current,
        })
    }
    pub(in crate::engine::cache) fn restore_deletions(&mut self, store: &Store) {
        let targets: Vec<_> = self
            .committed
            .iter()
            .filter(|(_, entry)| {
                entry.members.iter().any(|(id, (author, kind))| {
                    *kind != 5 && store.lease(id).is_none() && store.was_deleted(id, author)
                })
            })
            .map(|(id, _)| id.clone())
            .collect();
        for target in targets {
            self.dirty(&target);
        }
    }
}
