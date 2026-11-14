use super::{
    Engine,
    protocol::{Output, Patch, Source},
    query, rows,
};
impl Engine {
    pub(super) fn render(&mut self, sub: &str, full: bool) {
        let Some(v) = self.views.get_mut(sub) else {
            return;
        };
        v.dirty = false;
        if matches!(v.query.source, Source::Diagnostics | Source::Relays) {
            self.outgoing.push(Output::Diagnostics {
                sub: sub.into(),
                data: serde_json::json!({
                    "storedEvents": self.store.len(),"eventPayloadBytes":self.store.payload_bytes(),"verifyQueueBytes":self.queue_bytes, "verifyQueue": self.queue.len(),
                    "verified": self.verified, "rejected": self.rejected, "dropped": self.dropped,
                    "metrics":self.metrics,"persistenceQueue":self.pending.len(),
                    "relays": self.network.stats(), "views": self.views.len()
                }),
            });
            return;
        }
        let events = query::events(&self.store, &v.query);
        let anchor = v
            .anchor
            .as_ref()
            .and_then(|id| events.iter().position(|e| e.id == *id));
        let at = anchor.unwrap_or(0);
        let start = at.saturating_sub(v.before);
        let end = at
            .saturating_add(v.after)
            .saturating_add(1)
            .min(events.len());
        let items: Vec<_> = events[start.min(end)..end]
            .iter()
            .map(|e| {
                let mut r = rows::row(&self.store, e, v.query.account.as_deref(), 0);
                r.hidden_reason = query::hidden(&self.store, &v.query, e).or(r.hidden_reason);
                r
            })
            .collect();
        if full {
            self.outgoing.push(Output::Rows {
                sub: sub.into(),
                items: items.clone(),
                at_top: start == 0,
                at_bottom: end == events.len(),
            });
        } else {
            let mut ops: Vec<_> = v
                .rows
                .iter()
                .filter(|old| !items.iter().any(|r| r.id == old.id))
                .map(|r| Patch::Remove { id: r.id.clone() })
                .collect();
            for (index, item) in items.iter().enumerate() {
                if v.rows.get(index) != Some(item) {
                    ops.push(Patch::Upsert {
                        index,
                        item: Box::new(item.clone()),
                    });
                }
            }
            if !ops.is_empty() {
                self.outgoing.push(Output::Patch {
                    sub: sub.into(),
                    ops,
                });
            }
            if v.anchor.is_some() && start > 0 {
                self.outgoing.push(Output::Fresh {
                    sub: sub.into(),
                    count: start,
                });
            }
        }
        v.rows = items;
    }
}
