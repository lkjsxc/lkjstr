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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::protocol::Input;
    use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

    #[test]
    fn profile_outbox_splits_target_and_speculative_authors_within_chunk_budget() {
        let key = generate_secret_key();
        let mut e = Engine::new();
        // More than one full context chunk: the visible author's notes mention
        // 135 other people, while only 120 context authors may seed discovery.
        let mut target = String::new();
        for i in 0..45 {
            let note = finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: 1 + i,
                    kind: 1,
                    content: "Note".into(),
                    tags: (0..3)
                        .map(|j| vec!["p".into(), format!("{:064x}", 1 + i * 3 + j)])
                        .collect(),
                },
                &key,
            )
            .unwrap_or_else(|_| unreachable!());
            target.clone_from(&note.pubkey);
            e.store.insert(note, None);
        }
        let account = "f".repeat(64);
        e.input(
            Input::Open {
                sub: "profile".into(),
                query: Query {
                    source: Source::Profile,
                    target: Some(target.clone()),
                    account: Some(account.clone()),
                    ..Default::default()
                },
            },
            100_001,
        );
        let context = super::super::hydration::authors(
            &e.store,
            &e.views["profile"],
            &e.network,
            e.signed_out_global_filter,
            &e.private_lists,
        );
        assert!(context.len() > 120);
        let mut expected: BTreeSet<_> = context.into_keys().take(120).collect();
        expected.insert(account);
        expected.remove(&target);
        let chunk_size = e
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
        let wants = e.outbox_wants(100_002);
        let mut speculative = BTreeSet::new();
        let mut directed = 0;
        for (owner, f, q) in &wants {
            assert_eq!(f.kinds.as_deref(), Some(&[10002][..]));
            let authors = f.authors.as_ref().unwrap_or_else(|| unreachable!());
            assert_eq!(f.limit, Some(authors.len() as u64));
            assert!(!authors.is_empty() && authors.len() <= chunk_size);
            if owner == "profile" {
                directed += 1;
                assert_eq!(q.source, Source::Profile);
                assert_eq!(authors.as_slice(), std::slice::from_ref(&target));
            } else {
                assert_eq!(owner, "~prefetch:outbox:profile");
                assert_eq!(q.source, Source::People);
                assert!(!authors.contains(&target));
                for author in authors {
                    assert!(speculative.insert(author.clone()), "duplicate author");
                }
            }
        }
        assert_eq!(directed, 1);
        assert_eq!(speculative, expected);
        assert_eq!(wants.len(), 1 + expected.len().div_ceil(chunk_size));
        assert!(wants.len() <= 6000 / chunk_size);
    }
}
