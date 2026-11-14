//! Feed query and relay request scopes.
use super::Ui;
use lkjstr_core::plan::{MENTION_KINDS, NOTE_KINDS, Want};
use lkjstr_core::store::Query;
use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Source {
    Home,
    Global,
    Notifications,
    Profile(String),
}

impl Source {
    pub(super) fn authors(&self, ui: Ui, me: &Option<String>) -> Option<Vec<String>> {
        match self {
            Source::Home => {
                let me = me.clone()?;
                // Without a follow list yet, Home still shows your own notes.
                let mut follows = ui.app.with(|rt| rt.store.follows(&me)).unwrap_or_default();
                follows.push(me);
                Some(follows)
            }
            Source::Profile(pubkey) => Some(vec![pubkey.clone()]),
            _ => None,
        }
    }

    pub(super) fn want(
        &self,
        authors: &Option<Vec<String>>,
        me: &Option<String>,
        until: Option<u64>,
        limit: usize,
    ) -> Option<Want> {
        let limit = limit as u64;
        Some(match self {
            Source::Home | Source::Profile(_) => Want::Notes {
                authors: authors.clone()?,
                until,
                limit,
            },
            Source::Global => Want::Global { until, limit },
            Source::Notifications => Want::Mentions {
                pubkey: me.clone()?,
                until,
                limit: limit * 2,
            },
        })
    }

    pub(super) fn query(
        &self,
        authors: &Option<Vec<String>>,
        me: &Option<String>,
        limit: usize,
    ) -> Option<Query> {
        let base = Query {
            limit,
            kinds: NOTE_KINDS.to_vec(),
            ..Query::default()
        };
        Some(match self {
            Source::Home | Source::Profile(_) => Query {
                authors: Some(authors.clone()?.into_iter().collect::<HashSet<_>>()),
                ..base
            },
            Source::Global => base,
            Source::Notifications => Query {
                mention: Some(me.clone()?),
                exclude_author: me.clone(),
                kinds: MENTION_KINDS.to_vec(),
                ..base
            },
        })
    }
}
