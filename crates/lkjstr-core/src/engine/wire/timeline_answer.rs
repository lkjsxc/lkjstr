//! The per-window part of a Timeline answer: positions of the delivered rows (plus the return
//! row), the window's anchor and whether relay history remains. A finished index answers from its
//! own lookup. While a replacement builds (older history or live notes arrived), a moved window is
//! answered from the prior finished lookup with the prior calendar counts, so the rail never loses
//! the reading place or a seek's landing for the length of a rebuild.
use super::Session;
use crate::engine::Engine;
use serde_json::{Value, json};
use std::collections::BTreeMap;

/// Key -> (UTC month start, ordinal in the month, row time in ms). Bound: one store-sized map.
pub(super) type Lookup = BTreeMap<String, (u64, usize, u64)>;

fn position(lookup: &Lookup, key: &str) -> Option<Value> {
    let (month, offset, at) = lookup.get(key)?;
    Some(json!({"key":key,"month":month,"offset":offset,"at":at}))
}

impl Session {
    /// Updates `positions`, `older` and `anchor` for the current window. Returns true on change.
    pub(super) fn window_fields(
        &self,
        sub: &str,
        lookup: &Lookup,
        e: &Engine,
        value: &mut Value,
    ) -> bool {
        let mut positions: Vec<_> = self
            .delivered
            .get(sub)
            .into_iter()
            .flatten()
            .filter_map(|r| position(lookup, r["key"].as_str()?))
            .collect();
        if let Some(key) = self.return_keys.get(sub)
            && let Some(p) = position(lookup, key)
            && !positions.iter().any(|p| p["key"].as_str() == Some(key))
        {
            positions.push(p);
        }
        // Exhaustion is engine policy; a short local window says nothing about relay history.
        let older = self.view(sub, e).is_none_or(|v| !v.source_exhausted);
        let positions = json!(positions);
        let anchor = self.windows.get(sub).and_then(|(key, _, _)| key.as_deref());
        if value["positions"] == positions
            && value["older"] == older
            && value["anchor"].as_str() == anchor
        {
            return false;
        }
        value["positions"] = positions;
        value["older"] = json!(older);
        if let Some(key) = anchor {
            value["anchor"] = json!(key);
        } else if let Some(map) = value.as_object_mut() {
            map.remove("anchor");
        }
        true
    }
}
