//! A current delivered key can guide background work without moving the retained window.
use super::Session;
use crate::engine::protocol::Input;
impl Session {
    pub(super) fn reading(
        &self,
        sub: String,
        key: Option<String>,
        engine: &crate::engine::Engine,
    ) -> Vec<Input> {
        if !self.queries.contains_key(&sub) {
            return vec![];
        }
        let id = match key {
            None => None,
            Some(key) => {
                if key.len() > 256 {
                    return vec![];
                }
                if let Some(anchor) = self.search_header_anchor(&sub, &key) {
                    return self.reading(sub, anchor, engine);
                }
                let row = self
                    .delivered
                    .get(&sub)
                    .and_then(|rows| rows.iter().find(|row| row["key"] == key));
                let Some(row) = row else {
                    return vec![];
                };
                let row = row.get("note").unwrap_or(row);
                if row["kind"] != "note" {
                    return vec![];
                }
                let Some(id) = row["id"]
                    .as_str()
                    .filter(|id| lkjstr_protocol::is_event_id(id))
                else {
                    return vec![];
                };
                Some(id.into())
            }
        };
        let mut selected =
            self.cache_read_inputs(&sub, &id.iter().cloned().collect::<Vec<_>>(), engine);
        selected.insert(0, Input::Reading { sub, id });
        selected
    }
}
