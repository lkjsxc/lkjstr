//! Current reading intent precedes retained history without new geometry work.
use super::{Engine, View, protocol::Source, rows::Row, zaps::Target};
use crate::store::Store;
use std::collections::BTreeSet;
#[path = "zap_demand.rs"]
mod demand;
#[derive(Default)]
pub(super) struct Demand {
    views: demand::Selection,
    badges: demand::Selection,
}
impl Engine {
    pub(super) fn zap_visible(&mut self, now: u64) -> Vec<Target> {
        let mut views: demand::Groups = self
            .views
            .iter()
            .filter(|(_, v)| {
                v.visible
                    && !matches!(
                        v.query.source,
                        Source::Diagnostics | Source::Relays | Source::People
                    )
            })
            .map(|(sub, view)| (sub.clone(), near(&self.store, view)))
            .collect();
        if let Some(focused) = &self.network.focused_sub
            && let Some(at) = views.iter().position(|(s, _)| s == focused)
        {
            views.swap(0, at);
        }
        let badges = if self.network.optimizer.hidden {
            vec![]
        } else {
            self.discovery_accounts
                .iter()
                .take(32)
                .map(|account| {
                    let mut seen = BTreeSet::new();
                    let targets = self
                        .store
                        .feed(&crate::store::Query {
                            kinds: vec![9735],
                            mention: Some(account.clone()),
                            limit: 200,
                            ..Default::default()
                        })
                        .iter()
                        .filter_map(|raw| receipt_target(raw))
                        .filter(|t| seen.insert(t.clone()))
                        .collect();
                    (account.clone(), targets)
                })
                .collect()
        };
        let pending = |t: &Target| self.zaps.target_pending(&self.store, t, now);
        let mut targets = self.zap_demand.views.select(&views, 800, pending);
        targets.extend(self.zap_demand.badges.select(&badges, 200, pending));
        targets
    }
}
fn near(store: &Store, view: &View) -> Vec<Target> {
    let at = view
        .reading
        .as_ref()
        .or(view.anchor.as_ref())
        .and_then(|id| {
            view.rows
                .iter()
                .position(|r| matches_anchor(store, r, id, view))
        })
        .unwrap_or(0);
    let mut out = vec![];
    let mut seen = BTreeSet::new();
    for distance in 0..=60 {
        let positions = [
            at.checked_add(distance).filter(|n| *n < view.rows.len()),
            (distance > 0).then(|| at.checked_sub(distance)).flatten(),
        ];
        for index in positions.into_iter().flatten() {
            visit(store, &view.rows[index], &mut out, &mut seen, 0);
        }
    }
    out
}
pub(super) fn matches_anchor(store: &Store, row: &Row, id: &str, view: &View) -> bool {
    row.id == id
        || store.get(&row.id).is_some_and(|raw| {
            super::rich::anchored(store, &raw, id, &view.query)
                || (matches!(raw.kind, 6 | 7 | 9735)
                    && receipt_target(&raw) == Some(Target::Event { id: id.into() }))
        })
}
fn visit(
    store: &Store,
    row: &Row,
    out: &mut Vec<Target>,
    seen: &mut BTreeSet<Target>,
    depth: usize,
) {
    if out.len() >= 128 || row.hidden_reason.is_some() || matches!(row.kind, 4 | 13 | 14 | 1059) {
        return;
    }
    let candidate = if row.kind == 9735 {
        store.get(&row.id).and_then(|raw| receipt_target(&raw))
    } else if store.referencing(&row.id).iter().any(|r| r.kind == 9735) {
        Some(Target::Event { id: row.id.clone() })
    } else {
        None
    };
    if let Some(target) = candidate
        && seen.insert(target.clone())
    {
        out.push(target);
    }
    if let Some(raw) = store
        .get(&row.id)
        .filter(|event| super::acts::is_act(event.kind))
    {
        let chain = super::acts::resolve(store, &raw);
        let mut targets: Vec<_> = chain
            .links
            .iter()
            .filter(|event| event.kind == 9735)
            .filter_map(|event| receipt_target(event))
            .collect();
        if let Some(note) = chain.note {
            let target = Target::Event {
                id: note.id.clone(),
            };
            if store
                .referencing(&note.id)
                .iter()
                .any(|event| event.kind == 9735 && receipt_target(event) == Some(target.clone()))
            {
                targets.push(target);
            }
        }
        for target in targets {
            if out.len() < 128 && seen.insert(target.clone()) {
                out.push(target);
            }
        }
    }
    if depth < 2 {
        for part in &row.content {
            if let super::rows::Segment::Quote { row: Some(row), .. } = part {
                visit(store, row, out, seen, depth + 1);
            }
        }
    }
}
fn receipt_target(raw: &lkjstr_protocol::NostrEvent) -> Option<Target> {
    let unique = |name| {
        lkjstr_nips::event::unique(&raw.tags, name)
            .ok()
            .flatten()
            .filter(|id| lkjstr_protocol::is_event_id(id))
    };
    unique("e")
        .map(|id| Target::Event { id: id.into() })
        .or_else(|| {
            unique("p").map(|pubkey| Target::Profile {
                pubkey: pubkey.into(),
            })
        })
}
