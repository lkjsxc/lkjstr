//! Visible read dependencies and reuse observations shared with durable metadata.
use super::super::{
    Engine,
    protocol::Source,
    rows::{Row, Segment},
};
use crate::cache::{MetadataAccess, Record};
use std::collections::{BTreeMap, BTreeSet};

pub(super) struct Inputs {
    pub own: BTreeSet<String>,
    pub held: BTreeSet<String>,
    pub visible: BTreeSet<String>,
    pub affinity: BTreeMap<String, u64>,
}

fn authors(row: &Row, out: &mut BTreeSet<String>) {
    if row.hidden_reason.is_some() {
        return;
    }
    out.insert(row.author.pubkey.clone());
    out.extend(row.reposts.iter().map(|author| author.pubkey.clone()));
    if let Some(author) = row.reply.as_ref().and_then(|reply| reply.author.as_ref()) {
        out.insert(author.pubkey.clone());
    }
    for part in &row.content {
        match part {
            Segment::Mention { author } => {
                out.insert(author.pubkey.clone());
            }
            Segment::Quote { row: Some(row), .. } => authors(row, out),
            _ => {}
        }
    }
}

impl Engine {
    pub(super) fn retention_inputs(&self) -> Inputs {
        let mut own: BTreeSet<_> = self.discovery_accounts.iter().cloned().collect();
        own.extend(self.saved_retention_accounts.iter().cloned());
        own.extend(
            self.views
                .values()
                .filter_map(|view| view.query.account.clone()),
        );
        let mut held: BTreeSet<_> = self
            .views
            .values()
            .flat_map(|view| view.rows.iter().map(|row| row.id.clone()))
            .collect();
        let mut visible = BTreeSet::new();
        let mut affinity = BTreeMap::new();
        for view in self.views.values().filter(|view| view.visible) {
            for row in &view.rows {
                authors(row, &mut visible);
            }
            if matches!(view.query.source, Source::Profile | Source::TheirHome)
                && let Some(target) = &view.query.target
            {
                visible.insert(target.clone());
            }
            if view.query.source == Source::TheirHome
                && let Some(target) = &view.query.target
            {
                // This public graph is reuse context, never account or mute authority.
                affinity.insert(target.clone(), 64);
                for person in self
                    .store
                    .follows(target)
                    .unwrap_or_default()
                    .into_iter()
                    .take(6000)
                {
                    affinity.entry(person).or_insert(32);
                }
                if let Some(list) = self.store.replaceable(target, 3) {
                    held.insert(list.id.clone());
                }
            }
        }
        for person in &visible {
            affinity.insert(person.clone(), 64);
        }
        Inputs {
            own,
            held,
            visible,
            affinity,
        }
    }

    /// Optimization hints and verified dependencies for the ordinary cache transaction.
    /// Bounds follow 128 visible views, each with at most 6000 requested rows/authors.
    pub fn cache_metadata_observation(&self, now_ms: u64) -> (MetadataAccess, Vec<Record>) {
        let input = self.retention_inputs();
        let mut access = MetadataAccess {
            minute: now_ms / 60_000,
            authors: input.affinity,
            pinned: BTreeSet::new(),
        };
        for owner in &input.own {
            access.authors.insert(owner.clone(), 64);
            for author in self
                .store
                .follows(owner)
                .unwrap_or_default()
                .into_iter()
                .take(6000)
            {
                access.authors.entry(author).or_insert(32);
            }
            for kind in [0, 3, 10000, 10002, 10030, 10063] {
                if let Some(event) = self.store.replaceable(owner, kind) {
                    access.pinned.insert(event.id.clone());
                }
            }
        }
        let mut rows = BTreeMap::new();
        for author in input.visible {
            if let Some(event) = self.store.replaceable(&author, 0)
                && let Ok(row) = Record::verified(&event)
            {
                rows.insert(row.id.clone(), row);
            }
        }
        for id in input.held {
            if let Some(event) = self.store.get(&id)
                && event.kind == 3
            {
                access.pinned.insert(id.clone());
                if let Ok(row) = Record::verified(&event) {
                    rows.insert(id, row);
                }
            }
        }
        (access, rows.into_values().collect())
    }
}
