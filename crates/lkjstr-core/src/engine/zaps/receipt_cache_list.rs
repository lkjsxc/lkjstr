use super::super::{Failure, Providers, ReceiptCursor, ReceiptPage, ReceiptRow, Result, Target};
use super::Receipts;
use crate::store::Store;

impl Receipts {
    pub fn page(
        &self,
        store: &Store,
        providers: &Providers,
        target: &Target,
        before: Option<&ReceiptCursor>,
        limit: usize,
        now: u64,
    ) -> Result<ReceiptPage> {
        if !(1..=super::super::receipt_list::MAX_ROWS).contains(&limit)
            || before.is_some_and(|c| {
                c.at > super::super::MAX_MSAT || lkjstr_nips::unhex::<32>(&c.id).is_err()
            })
        {
            return Err(Failure::Rejected);
        }
        let mut rows: Vec<_> = self
            .index
            .get(target)
            .into_iter()
            .flat_map(|i| &i.ids)
            .filter_map(|id| self.get(store, id))
            .filter(|v| &v.target == target)
            .filter(|v| {
                before.is_none_or(|c| (v.created_at, v.id.as_str()) < (c.at, c.id.as_str()))
            })
            .collect();
        rows.sort_unstable_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
        let more = rows.len() > limit;
        rows.truncate(limit);
        let cursor = if more {
            rows.last().map(|v| ReceiptCursor {
                at: v.created_at,
                id: v.id.clone(),
            })
        } else {
            None
        };
        Ok(ReceiptPage {
            target: target.clone(),
            rows: rows.into_iter().map(ReceiptRow::from).collect(),
            total: self.total(store, providers, target, now),
            cursor,
            more,
        })
    }
}
