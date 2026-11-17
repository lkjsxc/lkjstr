//! Only visible, delivered public note IDs may select a durable contributor context.
use super::Session;
use crate::engine::{Engine, protocol::Input};

impl Session {
    pub(super) fn cache_read_inputs(
        &self,
        sub: &str,
        ids: &[String],
        engine: &Engine,
    ) -> Vec<Input> {
        if self.preview_hidden
            || self
                .timeline_visible
                .as_ref()
                .is_some_and(|visible| !visible.contains(sub))
            || !self.public_cache_allowed(sub, engine)
        {
            return vec![];
        }
        let Some(delivered) = self.delivered.get(sub) else {
            return vec![];
        };
        let ids: Vec<_> = ids
            .iter()
            .take(32)
            .filter(|id| {
                lkjstr_protocol::is_event_id(id)
                    && delivered.iter().any(|row| {
                        let row = row.get("note").unwrap_or(row);
                        row["kind"] == "note" && row["id"] == **id && row.get("hidden").is_none()
                    })
            })
            .cloned()
            .collect();
        if ids.is_empty() {
            vec![]
        } else {
            vec![Input::CacheRead {
                sub: sub.to_owned(),
                ids,
            }]
        }
    }
}

#[cfg(test)]
#[path = "cache_read_test.rs"]
mod tests;
