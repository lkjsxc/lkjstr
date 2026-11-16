//! A current delivered key can guide background work without moving the retained window.
use super::Session;
use crate::engine::protocol::Input;
impl Session {
    pub(super) fn reading(&self, sub: String, key: Option<String>) -> Vec<Input> {
        if !self.queries.contains_key(&sub) {
            return vec![];
        }
        let id = match key {
            None => None,
            Some(key) => {
                if key.len() > 256 {
                    return vec![];
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
        vec![Input::Reading { sub, id }]
    }
}
