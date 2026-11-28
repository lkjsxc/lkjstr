//! Finite, low-priority NIP-65 discovery for visible author queries and readers.
use super::{
    Engine,
    protocol::{Query, Source},
};
use lkjstr_protocol::NostrFilter;
use std::collections::BTreeSet;
impl Engine {
    pub(super) fn outbox_wants(&self, now: u64) -> Vec<(String, NostrFilter, Query)> {
        let mut wants = Vec::new();
        for (sub, view) in self.views.iter().filter(|(_, v)| v.visible) {
            if !matches!(
                view.query.source,
                Source::Home
                    | Source::TheirHome
                    | Source::Profile
                    | Source::Thread
                    | Source::Notifications
                    | Source::Global
                    | Source::Search
                    | Source::Hashtag
            ) {
                continue;
            }
            let primary = super::query::filter(&self.store, &view.query);
            let mut authors: BTreeSet<_> =
                primary.authors.into_iter().flatten().take(6000).collect();
            authors.extend(view.query.account.clone());
            if view.query.source == Source::Profile {
                authors.extend(view.query.target.clone());
            }
            // Nearby row authors seed future profile/thread routes without opening their sockets yet.
            authors.extend(
                super::hydration::authors(
                    &self.store,
                    view,
                    &self.network,
                    self.signed_out_global_filter,
                    &self.private_lists,
                )
                .into_keys()
                .take(120),
            );
            let mut authors: Vec<_> = authors
                .into_iter()
                .filter(|author| {
                    lkjstr_protocol::is_pubkey(author)
                        && !self.network.metadata_fresh(&self.store, author, 10002, now)
                })
                .collect();
            let chunk_size = self
                .network
                .optimizer
                .decide_plan(
                    crate::optimizer::features::Features {
                        profile: true,
                        ..Default::default()
                    },
                    &[],
                )
                .author_chunk;
            // The profile target controls the displayed header and its note routes.
            // Keep it separate from speculative nearby authors, within the same batch budget.
            let target =
                view.query.target.as_ref().filter(|target| {
                    view.query.source == Source::Profile && authors.contains(target)
                });
            if let Some(target) = target {
                authors.retain(|author| author != target);
                wants.push((
                    sub.clone(),
                    NostrFilter {
                        authors: Some(vec![target.clone()]),
                        kinds: Some(vec![10002]),
                        limit: Some(1),
                        ..Default::default()
                    },
                    Query {
                        source: Source::Profile,
                        account: view.query.account.clone(),
                        target: Some(target.clone()),
                        ..Default::default()
                    },
                ));
            }
            let budget = (6000 / chunk_size).saturating_sub(usize::from(target.is_some()));
            for chunk in authors.chunks(chunk_size).take(budget) {
                wants.push((
                    format!("~prefetch:outbox:{sub}"),
                    NostrFilter {
                        authors: Some(chunk.to_vec()),
                        kinds: Some(vec![10002]),
                        limit: Some(chunk.len() as u64),
                        ..Default::default()
                    },
                    Query {
                        source: Source::People,
                        ..Default::default()
                    },
                ));
            }
        }
        wants
    }
}
