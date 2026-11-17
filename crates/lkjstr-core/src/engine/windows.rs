use super::{
    Engine,
    protocol::{Output, Patch, Source},
    query, rows,
};
#[path = "window_projection.rs"]
pub(super) mod projection;

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
        let events = super::list_events::events(&self.store, &v.query, &self.private_lists);
        let selected = selection(
            &self.store,
            &self.network,
            v,
            self.signed_out_global_filter,
            &events,
            &self.private_lists,
        );
        let (start, end) = (selected.raw.start, selected.raw.end);
        let fresh = projection::count(&self.store, &v.query, &events[..start]);
        let window = &events[start..end];
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
                r
            })
            .collect();
        v.source_exhausted = super::history::exhausted(&self.network, &self.store, v);
        let at_bottom = end == events.len() && v.source_exhausted;
        if full || at_bottom != v.at_bottom {
            self.outgoing.push(Output::Rows {
                sub: sub.into(),
                items: items.clone(),
                at_top: fresh == 0,
                at_bottom,
            });
        } else {
            let present: std::collections::BTreeSet<_> =
                items.iter().map(|row| row.id.as_str()).collect();
            let mut ops: Vec<_> = v
                .rows
                .iter()
                .filter(|old| !present.contains(old.id.as_str()))
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
            if !ops.is_empty()
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
                });
            }
        }
        self.outgoing.push(Output::Fresh {
            sub: sub.into(),
            count: fresh,
        });
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

fn plan(
    store: &crate::store::Store,
    v: &super::View,
    events: &[crate::store::Event],
) -> (usize, usize) {
    let at = v
        .anchor
        .as_ref()
        .and_then(|id| {
            events
                .iter()
                .position(|e| super::rich::anchored(store, e, id, &v.query))
        })
        .unwrap_or(0);
    let mut start = at;
    let mut above = 0;
    while start > 0 && above < v.before {
        start -= 1;
        if !projection::unavailable(store, &v.query, &events[start]) {
            above += 1;
        }
    }
    // Keep adjacent invisible targets owned when the first note is anchored.
    while start > 0 && projection::unavailable(store, &v.query, &events[start - 1]) {
        start -= 1;
    }
    (start, above.saturating_add(v.after).saturating_add(1))
}

/// Refill from raw rows so every retained anchor can reach older cached notes.
/// Hydration and history use this same raw span, including withheld authors.
pub(super) fn selection(
    store: &crate::store::Store,
    network: &super::network::Network,
    v: &super::View,
    enabled: bool,
    events: &[crate::store::Event],
    private: &super::settings::PrivateLists,
) -> Selection {
    let (start, quota) = plan(store, v, events);
    let held = if enabled && v.query.account.is_none() && v.query.source == Source::Global {
        super::global::classify_window(
            store,
            &events[start..],
            |p| network.profile_absent(p),
            |e| projection::unavailable(store, &v.query, e),
            quota,
        )
    } else {
        let mut visible = 0;
        events[start..]
            .iter()
            .scan((), |_, event| {
                if visible >= quota {
                    return None;
                }
                // Person membership is independent of contact-list payloads and note mutes.
                let reason = if !super::acts::notification_visible(store, &v.query, event)
                    || (v.query.source != Source::Followers
                        && query::hidden_with_lists(store, &v.query, event, private).is_some())
                {
                    Some(super::global::Held::Filtered)
                } else if projection::unavailable(store, &v.query, event) {
                    Some(super::global::Held::UnavailableRepost)
                } else {
                    None
                };
                if reason.is_none() {
                    visible += 1;
                }
                Some(reason)
            })
            .collect()
    };
    Selection {
        raw: start..start + held.len(),
        held,
        quota,
    }
}
