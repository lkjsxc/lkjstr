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
        let unavailable = selected
            .held
            .iter()
            .filter(|reason| **reason == Some(super::global::Held::UnavailableRepost))
            .count();
        let order = v
            .time_window
            .as_ref()
            .map(|_| super::time_window::Order::new(&self.store, &v.query));
        let items: Vec<_> = window
            .iter()
            .zip(selected.held)
            .filter(|(_, held)| super::global::has_slot(*held))
            .map(|(e, held)| {
                let hidden = held.and_then(super::global::Held::reason);
                let mut r = if let Some(reason) = hidden {
                    super::visibility::covered_row(&self.store, e, reason)
                } else {
                    rows::row_with_lists(
                        &self.store,
                        e,
                        v.query.account.as_deref(),
                        0,
                        &self.private_lists,
                    )
                };
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
        let edges = super::time_window_relay::edges(&mut self.network, &self.store, sub, v, &items);
        if let Some(pivot) = &mut v.time_window {
            let follow_list = super::time_window::follow_list(&self.store, &v.query);
            pivot.report(sub, &items, follow_list, edges, full, &mut self.outgoing);
        }
        v.at_bottom = at_bottom;
        v.rows = items;
        self.outgoing.push(Output::Visibility {
            sub: sub.into(),
            invalid_deliveries: v.invalid_deliveries,
            unavailable_reposts: unavailable,
        });
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
