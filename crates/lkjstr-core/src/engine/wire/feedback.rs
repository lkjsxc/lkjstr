//! Timestamp lookup is explicitly cache-only; it never claims unseen history.
use super::{Output, Session};
use crate::engine::{Engine, list_events, query};
impl Session {
    pub fn row_at_time(&self, req: String, sub: String, at: u64, engine: &Engine) -> Output {
        let row = self
            .queries
            .get(&sub)
            .and_then(|q| q.convert())
            .and_then(|q| {
                list_events::events(&engine.store, &q, &engine.private_lists)
                    .into_iter()
                    .filter(|e| {
                        query::hidden_with_lists(&engine.store, &q, e, &engine.private_lists)
                            .is_none()
                    })
                    .find(|e| e.created_at.saturating_mul(1000) <= at)
            });
        Output::RowAtTime {
            req,
            sub,
            key: row.as_ref().map(|e| e.id.clone()),
            at: row.map(|e| e.created_at.saturating_mul(1000)),
            cached: true,
        }
    }
}
