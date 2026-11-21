use super::{
    Engine,
    protocol::{Output, Patch, Source},
    query, rows,
};
#[path = "window_projection.rs"]
pub(super) mod projection;
#[path = "window_selection.rs"]
mod selection;
pub(super) use selection::{reason, selection};

pub(super) const HEAD_ROWS: usize = 6800;

pub(super) struct Selection {
    pub raw: std::ops::Range<usize>,
    pub held: Vec<Option<super::global::Held>>,
    pub quota: usize,
}
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
        let events = super::time_window::events(&self.store, v, &self.private_lists);
        let selected = selection(
            &self.store,
            &self.network,
            v,
            self.signed_out_global_filter,
            &events,
            &self.private_lists,
        );
        let (start, end) = (selected.raw.start, selected.raw.end);
        let (fresh, own_head) = if v.time_window.is_some() {
            (0, false)
        } else {
            projection::fresh(&self.store, &v.query, &events[..start])
        };
        let window = &events[start..end];
        let order = v
            .time_window
            .as_ref()
            .map(|_| super::time_window::Order::new(&self.store, &v.query));
        let items: Vec<_> = window
            .iter()
            .zip(selected.held)
            .filter(|(_, reason)| reason.is_none())
            .map(|(e, _)| {
                let mut r = rows::row_with_lists(
                    &self.store,
                    e,
                    v.query.account.as_deref(),
                    0,
                    &self.private_lists,
                );
                r.hidden_reason =
                    query::hidden_with_lists(&self.store, &v.query, e, &self.private_lists)
                        .or(r.hidden_reason);
                if let Some(order) = &order {
                    order.project(&mut r);
                }
                r
            })
            .collect();
        v.source_exhausted = super::history::exhausted(&self.network, &self.store, v);
        let at_bottom = end == events.len() && v.source_exhausted;
        if full || at_bottom != v.at_bottom {
            self.outgoing.push(Output::Rows {
                sub: sub.into(),
                items: items.clone(),
                at_top: fresh == 0 && v.time_window.is_none(),
                at_bottom,
            });
        } else {
            let present: std::collections::BTreeSet<_> =
                items.iter().map(|row| row.id.as_str()).collect();
            let previous: std::collections::BTreeMap<_, _> =
                v.rows.iter().map(|row| (row.id.as_str(), row)).collect();
            let mut ops: Vec<_> = v
                .rows
                .iter()
                .filter(|old| !present.contains(old.id.as_str()))
                .map(|r| Patch::Remove { id: r.id.clone() })
                .collect();
            for (index, item) in items.iter().enumerate() {
                if previous.get(item.id.as_str()) != Some(&item) {
                    ops.push(Patch::Upsert {
                        index,
                        item: Box::new(item.clone()),
                    });
                }
            }
            if !ops.is_empty()
                || v.rows
                    .iter()
                    .map(|row| &row.id)
                    .ne(items.iter().map(|row| &row.id))
                || v.query.filters.notifications == Some(true)
                || matches!(
                    v.query.source,
                    Source::Thread
                        | Source::Bookmarks
                        | Source::Channels
                        | Source::Channel
                        | Source::Profile
                        | Source::Followers
                        | Source::Following
                        | Source::People
                        | Source::Mutes
                        | Source::List
                        | Source::Notifications
                        | Source::MediaServers
                        | Source::Emoji
                )
            {
                self.outgoing.push(Output::Patch {
                    sub: sub.into(),
                    ops,
                    order: items.iter().map(|row| row.id.clone()).collect(),
                });
            }
        }
        self.outgoing.push(Output::Fresh {
            sub: sub.into(),
            count: fresh,
            own_head,
        });
        let owner = super::time_window_older::owner(&self.store, sub, v);
        if let Some(pivot) = &mut v.time_window {
            let follow_list = super::time_window::follow_list(&self.store, &v.query);
            let older = owner.map_or(super::protocol::TimeEdge::CacheOnly, |owner| {
                let row_time = |row: &rows::Row| row.reposted_at.unwrap_or(row.created_at);
                let older = items.partition_point(|row| row_time(row) > pivot.at / 1000);
                let through = items.get(older + v.after - 1).map(row_time);
                self.network.advance_older(&owner, &self.store, through);
                self.network.older_edge(&owner, &self.store)
            });
            pivot.report(sub, &items, follow_list, older, full, &mut self.outgoing);
        }
        v.at_bottom = at_bottom;
        v.rows = items;
        if query::signed_out(&v.query) {
            self.outgoing.push(Output::Status {
                sub: sub.into(),
                state: "not-found".into(),
                asked_relays: 0,
                answered_relays: 0,
            });
        }
    }
}
