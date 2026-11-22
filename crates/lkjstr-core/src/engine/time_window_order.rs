//! Time pivots use the same source-scoped repost for order and row presentation.
use crate::{
    engine::{acts, protocol::Query, query, rich, rows},
    store::{Event, Store},
};
use lkjstr_protocol::NostrFilter;

pub(in crate::engine) struct Order<'a> {
    store: &'a Store,
    query: &'a Query,
    filter: NostrFilter,
    authors: Option<Vec<String>>,
}

impl<'a> Order<'a> {
    pub(in crate::engine) fn new(store: &'a Store, query: &'a Query) -> Self {
        Self {
            store,
            query,
            filter: query::filter(store, query),
            authors: rich::authors(store, query),
        }
    }

    fn reposts<'b>(&'b self, id: &'b str) -> impl Iterator<Item = Event> + 'b {
        acts::reposts(self.store, id).filter(|event| {
            query::accepts(self.store, self.query, event, &self.filter, &self.authors)
        })
    }

    pub(super) fn at(&self, event: &Event) -> u64 {
        if self.query.source == crate::engine::protocol::Source::Profile
            && self.query.filters.show.as_deref() == Some("all")
        {
            return event.created_at;
        }
        self.reposts(&event.id)
            .map(|repost| repost.created_at)
            .max()
            .unwrap_or(event.created_at)
    }

    pub(in crate::engine) fn project(&self, row: &mut rows::Row) {
        if self.query.source == crate::engine::protocol::Source::Profile
            && self.query.filters.show.as_deref() == Some("all")
        {
            row.reposted_at = None;
            row.reposts.clear();
            row.window_reading_at = Some(row.created_at);
            return;
        }
        row.reposted_at = None;
        row.reposts = self
            .reposts(&row.id)
            .map(|repost| {
                row.reposted_at = row.reposted_at.max(Some(repost.created_at));
                rows::author(self.store, &repost.pubkey)
            })
            .collect();
        row.reposts.sort_by(|a, b| a.pubkey.cmp(&b.pubkey));
        row.reposts.dedup_by(|a, b| a.pubkey == b.pubkey);
        row.window_reading_at = Some(row.reposted_at.unwrap_or(row.created_at));
    }
}
